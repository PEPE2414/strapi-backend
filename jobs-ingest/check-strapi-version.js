const fetch = require('node-fetch');

const STRAPI_URL = 'https://api.effort-free.co.uk';

async function checkStrapiVersion() {
  console.log('🔍 Checking Strapi version and API structure...');
  
  try {
    // Try to get basic info about the Strapi instance
    const response = await fetch(`${STRAPI_URL}/api`, {
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    console.log(`📊 Basic API response: ${response.status} ${response.statusText}`);
    
    if (response.ok) {
      const data = await response.json();
      console.log(`✅ Strapi is responding!`);
      console.log(`📊 Available endpoints:`, Object.keys(data));
      
      // Check for version info in headers
      const version = response.headers.get('x-powered-by');
      if (version) {
        console.log(`📊 Strapi version: ${version}`);
      }
      
      return data;
    } else {
      console.log(`❌ Basic API failed: ${response.status} ${response.statusText}`);
      return null;
    }
  } catch (error) {
    console.log(`❌ Error: ${error.message}`);
    return null;
  }
}

async function checkContentTypes() {
  console.log('\n🧪 Checking available content types...');
  
  try {
    const response = await fetch(`${STRAPI_URL}/api/content-types`, {
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    console.log(`📊 Content Types response: ${response.status} ${response.statusText}`);
    
    if (response.ok) {
      const data = await response.json();
      console.log(`✅ Content Types API working!`);
      console.log(`📊 Available content types:`, data.data?.map(item => item.uid) || 'No data');
      return data;
    } else {
      console.log(`❌ Content Types failed: ${response.status} ${response.statusText}`);
      return null;
    }
  } catch (error) {
    console.log(`❌ Error: ${error.message}`);
    return null;
  }
}

async function main() {
  console.log('🚀 Checking Strapi instance...\n');
  
  const basicInfo = await checkStrapiVersion();
  const contentTypes = await checkContentTypes();
  
  if (basicInfo || contentTypes) {
    console.log('\n✅ Strapi instance is accessible!');
    console.log('\n🔍 Next steps:');
    console.log('1. Check your API token permissions');
    console.log('2. Verify the content type is published');
    console.log('3. Try creating a new API token with Full access');
  } else {
    console.log('\n❌ Strapi instance not accessible.');
    console.log('Check your URL and make sure Strapi is running.');
  }
}

// Run the check
if (require.main === module) {
  main();
}

module.exports = { checkStrapiVersion, checkContentTypes, main };
