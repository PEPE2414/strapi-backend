const fetch = require('node-fetch');

// Load environment variables
try {
  require('dotenv').config();
} catch (e) {
  // dotenv not available, continue without it
}

const STRAPI_URL = process.env.STRAPI_URL || 'http://localhost:1337';
const STRAPI_API_TOKEN = process.env.STRAPI_API_TOKEN;

console.log('🔍 Discovering Strapi API structure...');
console.log(`🔗 Base URL: ${STRAPI_URL}`);
console.log(`🔑 Token: ${STRAPI_API_TOKEN ? 'Set (length: ' + STRAPI_API_TOKEN.length + ')' : 'Not set'}`);

async function testBasicEndpoints() {
  console.log('\n🧪 Testing basic Strapi endpoints...\n');
  
  const basicEndpoints = [
    `${STRAPI_URL}/api`,
    `${STRAPI_URL}/api/`,
    `${STRAPI_URL}/api/content-manager/collection-types`,
    `${STRAPI_URL}/api/content-manager/collection-types/`,
    `${STRAPI_URL}/api/content-types`,
    `${STRAPI_URL}/api/content-types/`,
    `${STRAPI_URL}/api/schemas`,
    `${STRAPI_URL}/api/schemas/`
  ];
  
  for (const endpoint of basicEndpoints) {
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
        console.log(`   ✅ SUCCESS!`);
        console.log(`   📊 Response keys: ${Object.keys(data).join(', ')}`);
        
        // If it's a collection types response, show the available types
        if (data.data && Array.isArray(data.data)) {
          console.log(`   📋 Available content types:`);
          data.data.forEach((type, index) => {
            console.log(`      ${index + 1}. ${type.uid || type.attributes?.uid || 'unknown'}`);
          });
        }
        
        return endpoint;
      } else {
        const errorText = await response.text();
        console.log(`   ❌ Failed: ${errorText.substring(0, 100)}...`);
      }
    } catch (error) {
      console.log(`   ❌ Error: ${error.message}`);
    }
    
    console.log('');
  }
  
  return null;
}

async function testJobEndpoints(baseUrl) {
  console.log('\n🧪 Testing job-related endpoints...\n');
  
  const jobEndpoints = [
    `${baseUrl}/api/jobs`,
    `${baseUrl}/api/job`,
    `${baseUrl}/api/job-listings`,
    `${baseUrl}/api/job-listings`,
    `${baseUrl}/api/graduate-jobs`,
    `${baseUrl}/api/graduate-job`,
    `${baseUrl}/api/placements`,
    `${baseUrl}/api/placement`,
    `${baseUrl}/api/internships`,
    `${baseUrl}/api/internship`
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
        console.log(`   ✅ SUCCESS! Found ${data.data?.length || 0} items`);
        console.log(`   📊 Total: ${data.meta?.pagination?.total || 'unknown'}`);
        return endpoint;
      } else {
        const errorText = await response.text();
        console.log(`   ❌ Failed: ${errorText.substring(0, 100)}...`);
      }
    } catch (error) {
      console.log(`   ❌ Error: ${error.message}`);
    }
    
    console.log('');
  }
  
  return null;
}

async function discoverApi() {
  try {
    // Test basic endpoints first
    const workingBase = await testBasicEndpoints();
    
    if (workingBase) {
      console.log(`\n🎉 Found working base endpoint: ${workingBase}`);
      
      // Test job endpoints
      const workingJobEndpoint = await testJobEndpoints(workingBase.replace('/api', '').replace('/api/', ''));
      
      if (workingJobEndpoint) {
        console.log(`\n🎉 FOUND WORKING JOB ENDPOINT: ${workingJobEndpoint}`);
        console.log('   Use this URL in your duplicate removal script!');
      } else {
        console.log('\n❌ No job endpoints found. You may need to:');
        console.log('   1. Check your Strapi admin panel for the correct content type name');
        console.log('   2. Make sure the content type is published and accessible');
        console.log('   3. Verify your API token has the right permissions');
      }
    } else {
      console.log('\n❌ No working endpoints found. Please check:');
      console.log('   1. Your Strapi URL is correct');
      console.log('   2. Your API token is valid and has the right permissions');
      console.log('   3. Your Strapi instance is running and accessible');
    }
    
  } catch (error) {
    console.error('❌ Error during API discovery:', error.message);
  }
}

// Run the discovery
if (require.main === module) {
  discoverApi();
}

module.exports = { discoverApi, testBasicEndpoints, testJobEndpoints };
