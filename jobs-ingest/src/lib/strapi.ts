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
      const result = await res.json();
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
  const res = await fetch(`${BASE}/jobs/ingest`, {
    method:'POST',
    headers:{
      'content-type':'application/json',
      'x-seed-secret': SECRET
    },
    body: JSON.stringify({ data: jobs })
  });
  
  if (!res.ok) {
    const errorText = await res.text();
    console.error(`Strapi ingest failed: ${res.status} - ${errorText}`);
    console.error('Request details:', {
      url: `${BASE}/jobs/ingest`,
      secretHeader: 'x-seed-secret',
      secretLength: SECRET?.length || 0,
      jobsCount: jobs.length
    });
    throw new Error(`Strapi ingest failed: ${res.status} - ${errorText}`);
  }
  
  const result = await res.json();
  console.log(`✅ Successfully ingested ${jobs.length} jobs to Strapi`);
  return result;
}
