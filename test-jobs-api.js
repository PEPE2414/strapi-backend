// Simple test script for jobs API endpoints
console.log('🧪 Testing Jobs API Endpoints...');

const BASE_URL = process.env.STRAPI_API_URL || 'https://api.effort-free.co.uk/api';
const SECRET = process.env.STRAPI_INGEST_SECRET || 'changeme';

async function testJobsAPI() {
  try {
    console.log('📡 Testing Strapi connection...');
    console.log('Base URL:', BASE_URL);
    console.log('Secret set:', !!SECRET && SECRET !== 'changeme');
    
    // Test 1: Check if jobs endpoint exists
    console.log('\n1️⃣ Testing jobs endpoint...');
    const jobsResponse = await fetch(`${BASE_URL}/jobs`);
    console.log('Jobs endpoint status:', jobsResponse.status);
    
    if (jobsResponse.ok) {
      const jobsData = await jobsResponse.json();
      console.log('Jobs count:', jobsData.data?.length || 0);
    }
    
    // Test 2: Test ingest endpoint
    console.log('\n2️⃣ Testing ingest endpoint...');
    const testJob = {
      data: [{
        source: 'test:manual',
        sourceUrl: 'https://example.com/test-job',
        title: 'Test Graduate Engineer',
        company: { name: 'Test Company' },
        applyUrl: 'https://example.com/apply',
        jobType: 'graduate',
        slug: 'test-graduate-engineer-test-company-12345678',
        hash: 'test-hash-12345678'
      }]
    };
    
    const ingestResponse = await fetch(`${BASE_URL}/jobs/ingest`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-seed-secret': SECRET
      },
      body: JSON.stringify(testJob)
    });
    
    console.log('Ingest endpoint status:', ingestResponse.status);
    
    if (ingestResponse.ok) {
      const ingestData = await ingestResponse.json();
      console.log('Ingest response:', ingestData);
    } else {
      const errorText = await ingestResponse.text();
      console.log('Ingest error:', errorText);
    }
    
    // Test 3: Test recommendations endpoint
    console.log('\n3️⃣ Testing recommendations endpoint...');
    const recResponse = await fetch(`${BASE_URL}/jobs/recommendations`);
    console.log('Recommendations endpoint status:', recResponse.status);
    
    console.log('\n✅ API tests completed!');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

// Run the test
testJobsAPI();
