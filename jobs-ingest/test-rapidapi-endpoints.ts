/**
 * Test script to find working RapidAPI endpoints
 * Run with: npm run jobs:test-endpoints
 */

import 'dotenv/config';

async function testEndpoints() {
  if (!process.env.RAPIDAPI_KEY) {
    console.log('❌ RAPIDAPI_KEY not set');
    return;
  }

  console.log('🔍 Testing RapidAPI endpoints...\n');
  const apiKey = process.env.RAPIDAPI_KEY;

  // Test different possible endpoints
  const endpointsToTest = [
    {
      name: 'Active Jobs DB - /search',
      url: 'https://active-jobs-db.p.rapidapi.com/search',
      host: 'active-jobs-db.p.rapidapi.com',
      body: { query: 'graduate', location: 'United Kingdom', limit: 5 }
    },
    {
      name: 'Active Jobs DB - /jobs',
      url: 'https://active-jobs-db.p.rapidapi.com/jobs',
      host: 'active-jobs-db.p.rapidapi.com',
      body: { query: 'graduate', location: 'United Kingdom', limit: 5 }
    },
    {
      name: 'Active Jobs DB - /find',
      url: 'https://active-jobs-db.p.rapidapi.com/find',
      host: 'active-jobs-db.p.rapidapi.com',
      body: { query: 'graduate', location: 'United Kingdom', limit: 5 }
    },
    {
      name: 'LinkedIn Jobs - /search',
      url: 'https://linkedin-job-search-api.p.rapidapi.com/search',
      host: 'linkedin-job-search-api.p.rapidapi.com',
      body: { query: 'graduate', location: 'United Kingdom', limit: 5 }
    }
  ];

  for (const endpoint of endpointsToTest) {
    try {
      console.log(`Testing: ${endpoint.name}`);
      console.log(`  URL: ${endpoint.url}`);
      
      const response = await fetch(endpoint.url, {
        method: 'POST',
        headers: {
          'X-RapidAPI-Key': apiKey,
          'X-RapidAPI-Host': endpoint.host,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(endpoint.body)
      });

      console.log(`  Status: ${response.status} ${response.statusText}`);
      
      if (response.ok) {
        const data = await response.json();
        console.log(`  ✅ Working! Response:`, JSON.stringify(data).substring(0, 200));
      } else {
        const errorText = await response.text();
        console.log(`  ❌ Failed: ${errorText.substring(0, 200)}`);
      }
    } catch (error) {
      console.log(`  ❌ Error: ${error instanceof Error ? error.message : String(error)}`);
    }
    
    console.log('');
    
    // Add delay between requests
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
}

testEndpoints().catch(console.error);

