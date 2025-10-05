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
  console.log(`📊 Deduplicated ${jobs.length} jobs to ${uniqueJobs.length} unique jobs`);
  
  // Validate jobs before sending to Strapi
  const validJobs = uniqueJobs.filter(job => {
    const validation = validateJobForUpsert(job);
    if (!validation.valid) {
      console.log(`❌ Job validation failed: ${validation.reason} - "${job.title}" at ${job.company?.name}`);
      return false;
    }
    return true;
  });
  console.log(`✅ ${validJobs.length} jobs passed validation (${uniqueJobs.length - validJobs.length} failed)`);

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
  console.log(`✅ Successfully ingested ${result.count || validJobs.length} jobs to Strapi`);
  return result;
}

// Enhanced deduplication logic
function deduplicateJobs(jobs: CanonicalJob[]): CanonicalJob[] {
  const seen = new Map<string, CanonicalJob>();
  const seenHashes = new Set<string>();
  const seenSecondary = new Set<string>();
  const duplicates: string[] = [];
  
  for (const job of jobs) {
    // Primary key: hash (most reliable)
    if (seenHashes.has(job.hash)) {
      duplicates.push(`Hash: ${job.hash}`);
      continue;
    }
    
    // Secondary key: applyUrl + company + title (fallback)
    const secondaryKey = `${job.applyUrl}|${job.company.name}|${job.title}`;
    if (seenSecondary.has(secondaryKey)) {
      duplicates.push(`Secondary: ${secondaryKey}`);
      continue;
    }
    
    // Store the job and mark both keys as seen
    seen.set(job.hash, job);
    seenHashes.add(job.hash);
    seenSecondary.add(secondaryKey);
  }
  
  if (duplicates.length > 0) {
    console.log(`🔄 Removed ${duplicates.length} duplicate jobs`);
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
  
  // Check job description quality (temporarily disabled for debugging)
  const description = job.descriptionText || job.descriptionHtml || '';
  const cleanDescription = description.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
  if (cleanDescription.length < 1) {
    return { valid: false, reason: `No description provided` };
  }
  
  // Log description length for debugging
  console.log(`📝 Job "${job.title}" description length: ${cleanDescription.length} chars`);
  
  // Company page URL is now optional (removed requirement)
  // Apply URL aggregator filter removed to allow major job boards
  
  return { valid: true };
}
