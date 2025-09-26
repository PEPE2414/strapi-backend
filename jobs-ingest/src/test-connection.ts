// Test script to verify Strapi connection
import { config } from 'dotenv';
import { upsertJobs } from './lib/strapi.js';

// Load environment variables
config();

console.log('🚀 Starting test script...');

async function testConnection() {
  console.log('🧪 Testing Strapi connection...');
  console.log('📡 API URL:', process.env.STRAPI_API_URL);
  console.log('🔑 Secret set:', !!process.env.STRAPI_INGEST_SECRET);
  
  try {
    // Test with a minimal job object
    const testJob = {
      source: 'test:connection',
      sourceUrl: 'https://example.com/test',
      title: 'Test Job',
      company: { name: 'Test Company' },
      applyUrl: 'https://example.com/apply',
      jobType: 'other' as const,
      slug: 'test-job-connection',
      hash: 'test-hash-123'
    };

    console.log('📤 Sending test job to Strapi...');
    const result = await upsertJobs([testJob]);
    
    console.log('✅ Connection successful!');
    console.log('📊 Response:', result);
    
  } catch (error: any) {
    console.error('❌ Connection failed:');
    console.error('Error:', error?.message || error);
    
    if (error?.message?.includes('401') || error?.message?.includes('403')) {
      console.error('🔑 Authentication issue - check STRAPI_INGEST_SECRET');
    } else if (error?.message?.includes('404')) {
      console.error('🌐 Endpoint not found - check STRAPI_API_URL');
    } else if (error?.message?.includes('ENOTFOUND') || error?.message?.includes('ECONNREFUSED')) {
      console.error('🌐 Network issue - check if Strapi is running and accessible');
    }
  }
}

// Run test if this file is executed directly
testConnection().catch(console.error);

export { testConnection };
