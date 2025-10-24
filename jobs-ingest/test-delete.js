const fetch = require('node-fetch');

const STRAPI_URL = 'https://api.effort-free.co.uk';
const STRAPI_API_TOKEN = '96d89335d94b24008cdb9e31deab7ab37df1617ee3f076a40691d15be51b9004b46a6da2976cb463d47ff92807a657a8ca43a4e4c64777c4272b1653113f9edf99098a46a81402c52e263fd4d36890f93127dfedbceabcfd86fb3dcd082907cf18b5a96364d7e7837de04a6a0782b3c15f3becce4ae43068b6e315b7f3239190';

async function testDelete() {
  console.log('🧪 Testing delete functionality...');
  
  // First, get a job to test with
  console.log('📥 Fetching a job to test with...');
  
  const response = await fetch(`${STRAPI_URL}/content-manager/collection-types/api::job.job?pagination[page]=1&pagination[pageSize]=1`, {
    headers: {
      'Authorization': `Bearer ${STRAPI_API_TOKEN}`,
      'Content-Type': 'application/json'
    }
  });
  
  if (!response.ok) {
    console.log(`❌ Failed to fetch jobs: ${response.status} ${response.statusText}`);
    return;
  }
  
  const data = await response.json();
  if (!data.data || data.data.length === 0) {
    console.log('❌ No jobs found to test with');
    return;
  }
  
  const testJob = data.data[0];
  console.log(`📋 Found test job: ID=${testJob.id}, Title="${testJob.title}"`);
  
  // Test different delete endpoints
  const deleteEndpoints = [
    `${STRAPI_URL}/content-manager/collection-types/api::job.job/${testJob.id}`,
    `${STRAPI_URL}/api/jobs/${testJob.id}`,
    `${STRAPI_URL}/api/job/${testJob.id}`,
    `${STRAPI_URL}/jobs/${testJob.id}`,
    `${STRAPI_URL}/job/${testJob.id}`
  ];
  
  for (const deleteUrl of deleteEndpoints) {
    console.log(`\n🧪 Testing delete endpoint: ${deleteUrl}`);
    
    try {
      const deleteResponse = await fetch(deleteUrl, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${STRAPI_API_TOKEN}`,
          'Content-Type': 'application/json'
        }
      });
      
      console.log(`📊 Delete response: ${deleteResponse.status} ${deleteResponse.statusText}`);
      
      if (deleteResponse.ok) {
        console.log(`✅ Delete successful!`);
        
        // Wait a moment and check if job still exists
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        const verifyResponse = await fetch(`${STRAPI_URL}/content-manager/collection-types/api::job.job/${testJob.id}`, {
          headers: {
            'Authorization': `Bearer ${STRAPI_API_TOKEN}`,
            'Content-Type': 'application/json'
          }
        });
        
        if (verifyResponse.status === 404) {
          console.log(`✅ Job successfully deleted and verified!`);
          console.log(`🎉 Working delete endpoint: ${deleteUrl}`);
          return deleteUrl;
        } else {
          console.log(`⚠️  Delete request succeeded but job still exists (status: ${verifyResponse.status})`);
        }
      } else {
        const errorText = await deleteResponse.text();
        console.log(`❌ Delete failed: ${errorText.substring(0, 100)}...`);
      }
    } catch (error) {
      console.log(`❌ Delete error: ${error.message}`);
    }
  }
  
  console.log('\n❌ No working delete endpoint found');
  return null;
}

// Run the test
if (require.main === module) {
  testDelete();
}

module.exports = { testDelete };
