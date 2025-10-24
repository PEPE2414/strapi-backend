const fetch = require('node-fetch');

// Load environment variables
try {
  require('dotenv').config();
} catch (e) {
  // dotenv not available, continue without it
}

const STRAPI_URL = process.env.STRAPI_URL || 'http://localhost:1337';
const STRAPI_API_TOKEN = process.env.STRAPI_API_TOKEN;

console.log('🔍 Debugging Strapi API access...');
console.log(`🔗 Base URL: ${STRAPI_URL}`);
console.log(`🔑 Token: ${STRAPI_API_TOKEN ? 'Set (length: ' + STRAPI_API_TOKEN.length + ')' : 'Not set'}`);

async function testBasicConnection() {
  console.log('\n🧪 Testing basic Strapi connection...');
  
  // Test if Strapi is responding at all
  try {
    const response = await fetch(`${STRAPI_URL}/api`, {
      headers: {
        'Authorization': `Bearer ${STRAPI_API_TOKEN}`,
        'Content-Type': 'application/json'
      }
    });
    
    console.log(`📊 Basic API response: ${response.status} ${response.statusText}`);
    
    if (response.ok) {
      const data = await response.json();
      console.log(`✅ Strapi is responding!`);
      console.log(`📊 Available endpoints:`, Object.keys(data));
      return true;
    } else {
      const errorText = await response.text();
      console.log(`❌ Basic API failed: ${errorText}`);
      return false;
    }
  } catch (error) {
    console.log(`❌ Connection error: ${error.message}`);
    return false;
  }
}

async function testContentManager() {
  console.log('\n🧪 Testing Content Manager API...');
  
  try {
    const response = await fetch(`${STRAPI_URL}/api/content-manager/collection-types`, {
      headers: {
        'Authorization': `Bearer ${STRAPI_API_TOKEN}`,
        'Content-Type': 'application/json'
      }
    });
    
    console.log(`📊 Content Manager response: ${response.status} ${response.statusText}`);
    
    if (response.ok) {
      const data = await response.json();
      console.log(`✅ Content Manager API working!`);
      console.log(`📊 Available collection types:`, data.data?.map(item => item.uid || item.attributes?.uid) || 'No data');
      return data;
    } else {
      const errorText = await response.text();
      console.log(`❌ Content Manager failed: ${errorText}`);
      return null;
    }
  } catch (error) {
    console.log(`❌ Content Manager error: ${error.message}`);
    return null;
  }
}

async function testDirectJobAccess() {
  console.log('\n🧪 Testing direct job access...');
  
  const jobEndpoints = [
    `${STRAPI_URL}/api/jobs`,
    `${STRAPI_URL}/api/job`,
    `${STRAPI_URL}/api/content-manager/collection-types/api::job.job`,
    `${STRAPI_URL}/api/content-manager/collection-types/api::job.job?pagination[page]=1&pagination[pageSize]=1`
  ];
  
  for (const endpoint of jobEndpoints) {
    try {
      console.log(`🔗 Testing: ${endpoint}`);
      
      const response = await fetch(endpoint, {
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
        return endpoint;
      } else {
        const errorText = await response.text();
        console.log(`   ❌ Failed: ${errorText.substring(0, 100)}...`);
      }
    } catch (error) {
      console.log(`   ❌ Error: ${error.message}`);
    }
  }
  
  return null;
}

async function debugStrapi() {
  console.log('🚀 Starting Strapi API debugging...\n');
  
  // Test 1: Basic connection
  const basicWorking = await testBasicConnection();
  if (!basicWorking) {
    console.log('\n❌ Basic Strapi connection failed. Check:');
    console.log('   1. Your Strapi URL is correct');
    console.log('   2. Your Strapi instance is running');
    console.log('   3. Your API token is valid');
    return;
  }
  
  // Test 2: Content Manager
  const contentManagerData = await testContentManager();
  if (contentManagerData) {
    console.log('\n✅ Content Manager API is working!');
    
    // Test 3: Direct job access
    const workingJobEndpoint = await testDirectJobAccess();
    if (workingJobEndpoint) {
      console.log(`\n🎉 FOUND WORKING JOB ENDPOINT: ${workingJobEndpoint}`);
      console.log('   Use this URL in your duplicate removal script!');
    } else {
      console.log('\n❌ No job endpoints found. Possible issues:');
      console.log('   1. The content type might not be published');
      console.log('   2. The content type might have a different name');
      console.log('   3. The API structure might be different');
    }
  } else {
    console.log('\n❌ Content Manager API not accessible. Check:');
    console.log('   1. Your API token has the right permissions');
    console.log('   2. The content type is published');
    console.log('   3. Your Strapi version supports the Content Manager API');
  }
}

// Run the debug
if (require.main === module) {
  debugStrapi();
}

module.exports = { debugStrapi, testBasicConnection, testContentManager, testDirectJobAccess };
