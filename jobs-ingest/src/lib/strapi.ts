import { CanonicalJob } from '../types';

const BASE = process.env.STRAPI_API_URL || 'https://api.effort-free.co.uk/api';
const SECRET = process.env.STRAPI_INGEST_SECRET || 'changeme';

// Safe logging - don't expose secrets
console.log('🔧 Strapi config:', { 
  BASE, 
  SECRET_SET: !!SECRET && SECRET !== 'changeme' 
});

// Test authentication before attempting to ingest
export async function testAuth(): Promise<boolean> {
  try {
    const res = await fetch(`${BASE}/jobs/test-auth`, {
      method: 'GET',
      headers: {
        'x-seed-secret': SECRET
      }
    });
    
    if (res.ok) {
      const result = await res.json() as any;
      console.log('🔐 Auth test result:', result.auth);
      return result.auth?.matches || false;
    } else {
      console.error('❌ Auth test failed:', res.status);
      return false;
    }
  } catch (error) {
    console.error('❌ Auth test error:', error);
    return false;
  }
}

export async function upsertJobs(jobs: CanonicalJob[]) {
  if (jobs.length === 0) {
    console.log('No jobs to upsert');
    return { count: 0, skipped: 0, errors: 0 };
  }

  console.log(`\n📦 Processing batch of ${jobs.length} jobs...`);

  // Deduplicate jobs within this batch
  const uniqueJobs = deduplicateJobs(jobs);
  const dedupRemoved = jobs.length - uniqueJobs.length;
  if (dedupRemoved > 0) {
    const dedupPercent = Math.round((dedupRemoved / jobs.length) * 100);
    console.log(`🔄 Deduplication: Removed ${dedupRemoved} duplicate jobs (${jobs.length} → ${uniqueJobs.length}, ${dedupPercent}% removed)`);
    
    // Warn if too many are being removed (might indicate hash generation issues)
    if (dedupPercent > 50) {
      console.warn(`⚠️  High deduplication rate (${dedupPercent}%) - this might indicate hash generation issues`);
      // Log sample of duplicate hashes to debug
      const hashCounts = new Map<string, number>();
      jobs.forEach(job => {
        hashCounts.set(job.hash, (hashCounts.get(job.hash) || 0) + 1);
      });
      const duplicateHashes = Array.from(hashCounts.entries())
        .filter(([_, count]) => count > 1)
        .slice(0, 5);
      if (duplicateHashes.length > 0) {
        console.warn(`  Sample duplicate hashes: ${duplicateHashes.map(([hash, count]) => `${hash.substring(0, 8)}... (${count}x)`).join(', ')}`);
      }
    }
  } else {
    console.log(`📊 Deduplicated ${jobs.length} jobs to ${uniqueJobs.length} unique jobs`);
  }

  // Validate jobs before sending to Strapi
  let validationFailures = 0;
  const validationReasons: Record<string, number> = {};
  const validJobs = uniqueJobs.filter(job => {
    const validation = validateJobForUpsert(job);
    if (!validation.valid) {
      validationFailures++;
      const reason = validation.reason || 'unknown';
      validationReasons[reason] = (validationReasons[reason] || 0) + 1;
      if (validationFailures <= 5) { // Only log first 5 failures to avoid spam
        console.log(`❌ Job validation failed: ${reason} - "${job.title}" at ${job.company?.name}`);
      }
      return false;
    }
    return true;
  });
  if (validationFailures > 0) {
    console.log(`⚠️  ${validationFailures} jobs failed validation (${uniqueJobs.length} → ${validJobs.length} valid)`);
    console.log(`  Validation failure breakdown:`, validationReasons);
  } else {
    console.log(`✅ ${validJobs.length} jobs passed validation`);
  }
  
  console.log(`📤 Sending ${validJobs.length} jobs to Strapi...`);

  const res = await fetch(`${BASE}/jobs/ingest`, {
    method:'POST',
    headers:{
      'content-type':'application/json',
      'x-seed-secret': SECRET
    },
    body: JSON.stringify({ 
      data: validJobs,
      metadata: {
        batchSize: validJobs.length,
        timestamp: new Date().toISOString(),
        version: '2.0'
      }
    })
  });
  
  if (!res.ok) {
    const errorText = await res.text();
    console.error(`Strapi ingest failed: ${res.status} - ${errorText}`);
    console.error('Request details:', {
      url: `${BASE}/jobs/ingest`,
      secretHeader: 'x-seed-secret',
      secretLength: SECRET?.length || 0,
      jobsCount: uniqueJobs.length
    });
    throw new Error(`Strapi ingest failed: ${res.status} - ${errorText}`);
  }
  
  const result = await res.json() as any;
  const created = result.created || 0;
  const updated = result.updated || 0;
  const skipped = result.skipped || 0;
  const totalProcessed = result.count || (created + updated);
  
  console.log(`✅ Strapi ingestion: ${validJobs.length} sent → ${created} created, ${updated} updated, ${skipped} skipped (${totalProcessed} total)`);
  
  // Detailed loss analysis
  if (validJobs.length > totalProcessed) {
    const lost = validJobs.length - totalProcessed - skipped;
    if (lost > 0) {
      const lostPercent = Math.round((lost / validJobs.length) * 100);
      console.warn(`⚠️  ${lost} jobs were lost during Strapi processing (${lostPercent}% of ${validJobs.length} sent)`);
      console.warn(`  → This could indicate:`);
      console.warn(`    1. Jobs being silently rejected by Strapi (validation errors)`);
      console.warn(`    2. Database constraint violations (unique hash/slug conflicts)`);
      console.warn(`    3. Jobs being filtered out by Strapi middleware`);
    }
  }
  
  // Track pipeline loss
  const pipelineLoss = {
    input: jobs.length,
    afterDedup: uniqueJobs.length,
    afterValidation: validJobs.length,
    afterStrapi: totalProcessed,
    lostInDedup: dedupRemoved,
    lostInValidation: validationFailures,
    lostInStrapi: validJobs.length - totalProcessed - skipped
  };
  
  if (pipelineLoss.lostInStrapi > 0) {
    console.log(`\n📊 Pipeline Loss Breakdown:`);
    console.log(`  Input: ${pipelineLoss.input} jobs`);
    console.log(`  After Deduplication: ${pipelineLoss.afterDedup} jobs (lost ${pipelineLoss.lostInDedup})`);
    console.log(`  After Validation: ${pipelineLoss.afterValidation} jobs (lost ${pipelineLoss.lostInValidation})`);
    console.log(`  After Strapi: ${pipelineLoss.afterStrapi} jobs (lost ${pipelineLoss.lostInStrapi})`);
  }
  
  return result;
}

// Enhanced deduplication logic
function deduplicateJobs(jobs: CanonicalJob[]): CanonicalJob[] {
  const secondaryMap = new Map<string, CanonicalJob>();

  for (const job of jobs) {
    const secondaryKey = `${job.applyUrl}|${job.company.name}|${job.title}`;
    const existing = secondaryMap.get(secondaryKey);
    if (!existing) {
      secondaryMap.set(secondaryKey, job);
      continue;
    }

    if (jobTypePriority(job.jobType) > jobTypePriority(existing.jobType)) {
      secondaryMap.set(secondaryKey, job);
    }
  }

  const afterSecondary = Array.from(secondaryMap.values());

  const hashMap = new Map<string, CanonicalJob>();
  for (const job of afterSecondary) {
    const existing = hashMap.get(job.hash);
    if (!existing) {
      hashMap.set(job.hash, job);
      continue;
    }

    if (jobTypePriority(job.jobType) > jobTypePriority(existing.jobType)) {
      hashMap.set(job.hash, job);
    }
  }

  const uniqueJobs = Array.from(hashMap.values()).filter(job => job.hash);
  const removed = jobs.length - uniqueJobs.length;
  if (removed > 0) {
    console.log(`🔄 Deduplication: Removed ${removed} duplicate jobs (${jobs.length} → ${uniqueJobs.length})`);
  } else {
    console.log(`📊 Deduplicated ${jobs.length} jobs to ${uniqueJobs.length} unique jobs`);
  }

  return uniqueJobs;
}

function jobTypePriority(jobType: CanonicalJob['jobType']): number {
  switch (jobType) {
    case 'placement':
      return 3;
    case 'internship':
      return 3;
    case 'graduate':
      return 1;
    default:
      return 0;
  }
}

// Enhanced job validation before upsert
export function validateJobForUpsert(job: CanonicalJob): { valid: boolean; reason?: string } {
  // Check required fields
  if (!job.title || job.title.trim().length < 3) {
    return { valid: false, reason: 'Invalid title' };
  }
  
  if (!job.company?.name || job.company.name.trim().length < 2) {
    return { valid: false, reason: 'Invalid company name' };
  }
  
  if (!job.applyUrl || job.applyUrl.trim().length < 10) {
    return { valid: false, reason: 'Invalid apply URL' };
  }
  
  if (!job.hash || job.hash.trim().length < 10) {
    return { valid: false, reason: 'Invalid hash' };
  }
  
  if (!job.slug || job.slug.trim().length < 5) {
    return { valid: false, reason: 'Invalid slug' };
  }
  
  // Check job description quality (relaxed for maximum job discovery)
  const description = job.descriptionText || job.descriptionHtml || '';
  const cleanDescription = description.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
  if (cleanDescription.length < 1) {
    // Allow jobs without descriptions for now - we can enhance them later
    console.log(`⚠️  Job without description: "${job.title}" at ${job.company?.name}`);
  }
  
  // Log description length for debugging (only for first few to avoid spam)
  // Commented out to reduce log noise - uncomment if debugging description issues
  // console.log(`📝 Job "${job.title}" description length: ${cleanDescription.length} chars`);
  
  // Company page URL is now optional (removed requirement)
  // Apply URL aggregator filter removed to allow major job boards
  
  return { valid: true };
}
