const fetch = require('node-fetch');

// Load environment variables
try {
  require('dotenv').config();
} catch (e) {
  // dotenv not available, continue without it
}

const STRAPI_URL = process.env.STRAPI_URL || 'http://localhost:1337';
const STRAPI_API_TOKEN = process.env.STRAPI_API_TOKEN || '96d89335d94b24008cdb9e31deab7ab37df1617ee3f076a40691d15be51b9004b46a6da2976cb463d47ff92807a657a8ca43a4e4c64777c4272b1653113f9edf99098a46a81402c52e263fd4d36890f93127dfedbceabcfd86fb3dcd082907cf18b5a96364d7e7837de04a6a0782b3c15f3becce4ae43068b6e315b7f3239190';

console.log('🔍 Testing with admin panel authentication...');
console.log(`🔗 Base URL: ${STRAPI_URL}`);
console.log(`🔑 Token: ${STRAPI_API_TOKEN ? 'Set (length: ' + STRAPI_API_TOKEN.length + ')' : 'Not set'}`);

async function testWithAdminToken() {
  console.log('\n🧪 Testing API with admin panel token...');
  
  try {
    const response = await fetch(`${STRAPI_URL}/content-manager/collection-types/api::job.job?pagination[page]=1&pagination[pageSize]=1`, {
      headers: {
        'Authorization': `Bearer ${STRAPI_API_TOKEN}`,
        'Content-Type': 'application/json'
      }
    });
    
    console.log(`📊 Response: ${response.status} ${response.statusText}`);
    
    if (response.ok) {
      const data = await response.json();
      console.log(`✅ SUCCESS! Found ${data.data?.length || 0} jobs`);
      console.log(`📊 Total: ${data.meta?.pagination?.total || 'unknown'}`);
      return true;
    } else {
      const errorText = await response.text();
      console.log(`❌ Failed: ${errorText}`);
      return false;
    }
  } catch (error) {
    console.log(`❌ Error: ${error.message}`);
    return false;
  }
}

async function testAlternativeAuth() {
  console.log('\n🧪 Testing alternative authentication methods...');
  
  // Test 1: Try without Bearer prefix
  try {
    console.log('🔗 Testing without Bearer prefix...');
    const response = await fetch(`${STRAPI_URL}/content-manager/collection-types/api::job.job?pagination[page]=1&pagination[pageSize]=1`, {
      headers: {
        'Authorization': STRAPI_API_TOKEN,
        'Content-Type': 'application/json'
      }
    });
    
    console.log(`   Status: ${response.status} ${response.statusText}`);
    if (response.ok) {
      console.log(`   ✅ SUCCESS without Bearer prefix!`);
      return true;
    }
  } catch (error) {
    console.log(`   ❌ Error: ${error.message}`);
  }
  
  // Test 2: Try with different header name
  try {
    console.log('🔗 Testing with X-API-Key header...');
    const response = await fetch(`${STRAPI_URL}/content-manager/collection-types/api::job.job?pagination[page]=1&pagination[pageSize]=1`, {
      headers: {
        'X-API-Key': STRAPI_API_TOKEN,
        'Content-Type': 'application/json'
      }
    });
    
    console.log(`   Status: ${response.status} ${response.statusText}`);
    if (response.ok) {
      console.log(`   ✅ SUCCESS with X-API-Key header!`);
      return true;
    }
  } catch (error) {
    console.log(`   ❌ Error: ${error.message}`);
  }
  
  return false;
}

async function main() {
  console.log('🚀 Testing Strapi authentication...\n');
  
  // Test 1: Standard Bearer token
  const standardAuth = await testWithAdminToken();
  
  if (!standardAuth) {
    // Test 2: Alternative authentication methods
    const alternativeAuth = await testAlternativeAuth();
    
    if (!alternativeAuth) {
      console.log('\n❌ All authentication methods failed.');
      console.log('\n🔍 Troubleshooting suggestions:');
      console.log('   1. Check if your API token has the right permissions');
      console.log('   2. Try creating a new API token with Full access');
      console.log('   3. Check if the content type is published');
      console.log('   4. Verify your Strapi version and API structure');
    }
  }
}

// Run the test
if (require.main === module) {
  main();
}

module.exports = { testWithAdminToken, testAlternativeAuth, main };
