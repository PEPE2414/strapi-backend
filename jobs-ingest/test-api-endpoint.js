const fetch = require('node-fetch');

// Load environment variables
try {
  require('dotenv').config();
} catch (e) {
  // dotenv not available, continue without it
}

const STRAPI_URL = process.env.STRAPI_URL || 'http://localhost:1337';
const STRAPI_API_TOKEN = process.env.STRAPI_API_TOKEN;

console.log('🔍 Testing different API endpoints...');
console.log(`🔗 Base URL: ${STRAPI_URL}`);
console.log(`🔑 Token: ${STRAPI_API_TOKEN ? 'Set (length: ' + STRAPI_API_TOKEN.length + ')' : 'Not set'}`);

// Test different possible endpoints
const endpoints = [
  `${STRAPI_URL}/api/jobs`,
  `${STRAPI_URL}/jobs`,
  `${STRAPI_URL}/api/job`,
  `${STRAPI_URL}/job`,
  `${STRAPI_URL}/api/content-manager/collection-types/api::job.job`,
  `${STRAPI_URL}/api/content-manager/collection-types/application::job.job`
];

async function testEndpoint(url) {
  try {
    console.log(`\n🧪 Testing: ${url}`);
    
    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${STRAPI_API_TOKEN}`,
        'Content-Type': 'application/json'
      }
    });
    
    console.log(`   Status: ${response.status} ${response.statusText}`);
    
    if (response.ok) {
      const data = await response.json();
      console.log(`   ✅ SUCCESS! Found ${data.data?.length || 0} jobs`);
      console.log(`   📊 Total: ${data.meta?.pagination?.total || 'unknown'}`);
      return true;
    } else {
      const errorText = await response.text();
      console.log(`   ❌ Failed: ${errorText.substring(0, 100)}...`);
      return false;
    }
  } catch (error) {
    console.log(`   ❌ Error: ${error.message}`);
    return false;
  }
}

async function testAllEndpoints() {
  console.log('\n🚀 Testing all possible endpoints...\n');
  
  for (const endpoint of endpoints) {
    const success = await testEndpoint(endpoint);
    if (success) {
      console.log(`\n🎉 FOUND WORKING ENDPOINT: ${endpoint}`);
      console.log('   Use this URL in your duplicate removal script!');
      break;
    }
  }
  
  console.log('\n📋 If none worked, try these:');
  console.log('   1. Check your Strapi admin panel for the correct API URL');
  console.log('   2. Make sure your API token has the right permissions');
  console.log('   3. Verify the content type is called "job" (not "jobs")');
}

// Run the test
if (require.main === module) {
  testAllEndpoints();
}

module.exports = { testAllEndpoints, testEndpoint };
