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

  // Deduplicate jobs within this batch
  const uniqueJobs = deduplicateJobs(jobs);
  const dedupRemoved = jobs.length - uniqueJobs.length;
  if (dedupRemoved > 0) {
    const dedupPercent = Math.round((dedupRemoved / jobs.length) * 100);
    console.log(`🔄 Deduplication: Removed ${dedupRemoved} duplicate jobs (${jobs.length} → ${uniqueJobs.length}, ${dedupPercent}% removed)`);
    
    // Warn if too many are being removed (might indicate hash generation issues)
    if (dedupPercent > 50) {
      console.warn(`⚠️  High deduplication rate (${dedupPercent}%) - this might indicate hash generation issues`);
    }
  } else {
    console.log(`📊 Deduplicated ${jobs.length} jobs to ${uniqueJobs.length} unique jobs`);
  }
  
  // Validate jobs before sending to Strapi
  let validationFailures = 0;
  const validJobs = uniqueJobs.filter(job => {
    const validation = validateJobForUpsert(job);
    if (!validation.valid) {
      validationFailures++;
      if (validationFailures <= 5) { // Only log first 5 failures to avoid spam
        console.log(`❌ Job validation failed: ${validation.reason} - "${job.title}" at ${job.company?.name}`);
      }
      return false;
    }
    return true;
  });
  if (validationFailures > 0) {
    console.log(`⚠️  ${validationFailures} jobs failed validation (${uniqueJobs.length} → ${validJobs.length} valid)`);
  } else {
    console.log(`✅ ${validJobs.length} jobs passed validation`);
  }

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
  
  if (validJobs.length > totalProcessed) {
    const lost = validJobs.length - totalProcessed - skipped;
    if (lost > 0) {
      console.warn(`⚠️  ${lost} jobs were lost during ingestion (${validJobs.length} sent but only ${totalProcessed} processed)`);
    }
  }
  
  return result;
}

// Enhanced deduplication logic
function deduplicateJobs(jobs: CanonicalJob[]): CanonicalJob[] {
  const seen = new Map<string, CanonicalJob>();
  const seenHashes = new Set<string>();
  const seenSecondary = new Set<string>();
  const duplicates: string[] = [];
  let hashDuplicates = 0;
  let secondaryDuplicates = 0;
  
  for (const job of jobs) {
    // Primary key: hash (most reliable)
    if (seenHashes.has(job.hash)) {
      hashDuplicates++;
      duplicates.push(`Hash: ${job.hash.substring(0, 8)}...`);
      continue;
    }
    
    // Secondary key: applyUrl + company + title (fallback)
    const secondaryKey = `${job.applyUrl}|${job.company.name}|${job.title}`;
    if (seenSecondary.has(secondaryKey)) {
      secondaryDuplicates++;
      duplicates.push(`Secondary: ${job.title.substring(0, 30)}...`);
      continue;
    }
    
    // Store the job and mark both keys as seen
    seen.set(job.hash, job);
    seenHashes.add(job.hash);
    seenSecondary.add(secondaryKey);
  }
  
  if (duplicates.length > 0) {
    console.log(`🔄 Removed ${duplicates.length} duplicate jobs (${hashDuplicates} by hash, ${secondaryDuplicates} by secondary key)`);
    
    // Warn if too many hash duplicates (might indicate hash generation issues)
    if (hashDuplicates > duplicates.length * 0.8) {
      console.warn(`⚠️  High hash collision rate (${hashDuplicates}/${duplicates.length}) - hash generation might need improvement`);
    }
  }
  
  return Array.from(seen.values()).filter(job => job.hash);
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
