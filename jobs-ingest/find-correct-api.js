const fetch = require('node-fetch');

const STRAPI_URL = 'https://api.effort-free.co.uk';
const STRAPI_API_TOKEN = '96d89335d94b24008cdb9e31deab7ab37df1617ee3f076a40691d15be51b9004b46a6da2976cb463d47ff92807a657a8ca43a4e4c64777c4272b1653113f9edf99098a46a81402c52e263fd4d36890f93127dfedbceabcfd86fb3dcd082907cf18b5a96364d7e7837de04a6a0782b3c15f3becce4ae43068b6e315b7f3239190';

console.log('🔍 Discovering the correct Strapi API structure...');
console.log(`🔗 Base URL: ${STRAPI_URL}`);
console.log(`🔑 Token: ${STRAPI_API_TOKEN.substring(0, 20)}...`);

async function testEndpoint(url, description) {
  try {
    console.log(`\n🧪 Testing: ${description}`);
    console.log(`🔗 URL: ${url}`);
    
    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${STRAPI_API_TOKEN}`,
        'Content-Type': 'application/json'
      }
    });
    
    console.log(`📊 Status: ${response.status} ${response.statusText}`);
    
    if (response.ok) {
      const data = await response.json();
      console.log(`✅ SUCCESS!`);
      console.log(`📊 Found ${data.data?.length || 0} items`);
      console.log(`📊 Total: ${data.meta?.pagination?.total || 'unknown'}`);
      return { success: true, url, data };
    } else {
      const errorText = await response.text();
      console.log(`❌ Failed: ${errorText.substring(0, 100)}...`);
      return { success: false, url, error: errorText };
    }
  } catch (error) {
    console.log(`❌ Error: ${error.message}`);
    return { success: false, url, error: error.message };
  }
}

async function discoverCorrectAPI() {
  console.log('\n🚀 Testing all possible API endpoints...\n');
  
  const endpoints = [
    // Content Manager API variations
    {
      url: `${STRAPI_URL}/content-manager/collection-types/api::job.job`,
      description: 'Content Manager API - Job collection type'
    },
    {
      url: `${STRAPI_URL}/content-manager/collection-types/api::job.job?pagination[page]=1&pagination[pageSize]=1`,
      description: 'Content Manager API - Job with pagination'
    },
    {
      url: `${STRAPI_URL}/api/content-manager/collection-types/api::job.job`,
      description: 'Content Manager API with /api prefix'
    },
    {
      url: `${STRAPI_URL}/api/content-manager/collection-types/api::job.job?pagination[page]=1&pagination[pageSize]=1`,
      description: 'Content Manager API with /api prefix and pagination'
    },
    
    // Direct API variations
    {
      url: `${STRAPI_URL}/api/jobs`,
      description: 'Direct Jobs API'
    },
    {
      url: `${STRAPI_URL}/api/job`,
      description: 'Direct Job API (singular)'
    },
    {
      url: `${STRAPI_URL}/jobs`,
      description: 'Jobs API without /api'
    },
    {
      url: `${STRAPI_URL}/job`,
      description: 'Job API without /api (singular)'
    },
    
    // Content Types API
    {
      url: `${STRAPI_URL}/api/content-types`,
      description: 'Content Types API'
    },
    {
      url: `${STRAPI_URL}/api/content-types/`,
      description: 'Content Types API with slash'
    },
    
    // Schemas API
    {
      url: `${STRAPI_URL}/api/schemas`,
      description: 'Schemas API'
    },
    {
      url: `${STRAPI_URL}/api/schemas/`,
      description: 'Schemas API with slash'
    }
  ];
  
  let workingEndpoints = [];
  
  for (const endpoint of endpoints) {
    const result = await testEndpoint(endpoint.url, endpoint.description);
    if (result.success) {
      workingEndpoints.push(result);
    }
  }
  
  console.log('\n📊 SUMMARY:');
  if (workingEndpoints.length > 0) {
    console.log(`✅ Found ${workingEndpoints.length} working endpoints:`);
    workingEndpoints.forEach((endpoint, index) => {
      console.log(`   ${index + 1}. ${endpoint.url}`);
      console.log(`      Found ${endpoint.data.data?.length || 0} items`);
    });
    
    // Use the first working endpoint
    const workingEndpoint = workingEndpoints[0];
    console.log(`\n🎉 RECOMMENDED ENDPOINT: ${workingEndpoint.url}`);
    console.log('   Use this URL in your duplicate removal script!');
    
    return workingEndpoint.url;
  } else {
    console.log('❌ No working endpoints found.');
    console.log('\n🔍 Troubleshooting suggestions:');
    console.log('   1. Check if your API token has the right permissions');
    console.log('   2. Verify the content type is published');
    console.log('   3. Check if your Strapi version uses a different API structure');
    console.log('   4. Try accessing the admin panel to verify the content type exists');
    
    return null;
  }
}

// Run the discovery
if (require.main === module) {
  discoverCorrectAPI();
}

module.exports = { discoverCorrectAPI, testEndpoint };
