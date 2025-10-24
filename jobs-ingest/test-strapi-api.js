const fetch = require('node-fetch');

// Load environment variables
try {
  require('dotenv').config();
} catch (e) {
  // dotenv not available, continue without it
}

const STRAPI_URL = process.env.STRAPI_URL || 'http://localhost:1337';
const STRAPI_API_TOKEN = process.env.STRAPI_API_TOKEN;

console.log('🔍 Testing Strapi API access...');
console.log(`🔗 Base URL: ${STRAPI_URL}`);
console.log(`🔑 Token: ${STRAPI_API_TOKEN ? 'Set (length: ' + STRAPI_API_TOKEN.length + ')' : 'Not set'}`);

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
      console.log(`📊 Response structure:`, JSON.stringify(data, null, 2).substring(0, 500) + '...');
      return { success: true, data };
    } else {
      const errorText = await response.text();
      console.log(`❌ Failed: ${errorText}`);
      return { success: false, error: errorText };
    }
  } catch (error) {
    console.log(`❌ Error: ${error.message}`);
    return { success: false, error: error.message };
  }
}

async function testAllEndpoints() {
  console.log('\n🚀 Testing all possible endpoints...\n');
  
  const endpoints = [
    {
      url: `${STRAPI_URL}/api/content-manager/collection-types/api::job.job`,
      description: 'Content Manager API - Job collection type'
    },
    {
      url: `${STRAPI_URL}/api/content-manager/collection-types/api::job.job?pagination[page]=1&pagination[pageSize]=1`,
      description: 'Content Manager API - Job collection type with pagination'
    },
    {
      url: `${STRAPI_URL}/api/content-manager/collection-types`,
      description: 'Content Manager API - All collection types'
    },
    {
      url: `${STRAPI_URL}/api/content-manager/collection-types/`,
      description: 'Content Manager API - All collection types (with slash)'
    },
    {
      url: `${STRAPI_URL}/api/content-types`,
      description: 'Content Types API'
    },
    {
      url: `${STRAPI_URL}/api/content-types/`,
      description: 'Content Types API (with slash)'
    },
    {
      url: `${STRAPI_URL}/api/schemas`,
      description: 'Schemas API'
    },
    {
      url: `${STRAPI_URL}/api/schemas/`,
      description: 'Schemas API (with slash)'
    },
    {
      url: `${STRAPI_URL}/api/jobs`,
      description: 'Direct Jobs API'
    },
    {
      url: `${STRAPI_URL}/api/job`,
      description: 'Direct Job API (singular)'
    }
  ];
  
  let workingEndpoints = [];
  
  for (const endpoint of endpoints) {
    const result = await testEndpoint(endpoint.url, endpoint.description);
    if (result.success) {
      workingEndpoints.push({ url: endpoint.url, description: endpoint.description, data: result.data });
    }
  }
  
  console.log('\n📊 SUMMARY:');
  if (workingEndpoints.length > 0) {
    console.log(`✅ Found ${workingEndpoints.length} working endpoints:`);
    workingEndpoints.forEach((endpoint, index) => {
      console.log(`   ${index + 1}. ${endpoint.description}`);
      console.log(`      URL: ${endpoint.url}`);
    });
  } else {
    console.log('❌ No working endpoints found.');
    console.log('\n🔍 Troubleshooting suggestions:');
    console.log('   1. Check if your API token has the right permissions');
    console.log('   2. Verify the content type is published and accessible');
    console.log('   3. Check if your Strapi version uses different API structure');
    console.log('   4. Try accessing the admin panel to verify the content type exists');
  }
  
  return workingEndpoints;
}

// Run the test
if (require.main === module) {
  testAllEndpoints();
}

module.exports = { testAllEndpoints, testEndpoint };
