const fetch = require('node-fetch');

// Load environment variables
try {
  require('dotenv').config();
} catch (e) {
  // dotenv not available, continue without it
}

const STRAPI_URL = process.env.STRAPI_URL || 'http://localhost:1337';
const STRAPI_API_TOKEN = process.env.STRAPI_API_TOKEN;

console.log('🚀 Starting robust duplicate removal process...');
console.log(`🔗 Strapi URL: ${STRAPI_URL}`);
console.log(`🔑 Token: ${STRAPI_API_TOKEN ? 'Set (length: ' + STRAPI_API_TOKEN.length + ')' : 'Not set'}`);

// Function to test different API endpoints
async function findWorkingEndpoint() {
  console.log('\n🔍 Finding working API endpoint...');
  
  const endpoints = [
    `${STRAPI_URL}/content-manager/collection-types/api::job.job`,
    `${STRAPI_URL}/api/content-manager/collection-types/api::job.job`,
    `${STRAPI_URL}/api/jobs`,
    `${STRAPI_URL}/api/job`,
    `${STRAPI_URL}/jobs`,
    `${STRAPI_URL}/job`
  ];
  
  for (const endpoint of endpoints) {
    try {
      console.log(`🧪 Testing: ${endpoint}`);
      
      const response = await fetch(`${endpoint}?pagination[page]=1&pagination[pageSize]=1`, {
        headers: {
          'Authorization': `Bearer ${STRAPI_API_TOKEN}`,
          'Content-Type': 'application/json'
        }
      });
      
      console.log(`   Status: ${response.status} ${response.statusText}`);
      
      if (response.ok) {
        const data = await response.json();
        console.log(`   ✅ SUCCESS! Found ${data.data?.length || 0} jobs`);
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

// Function to get all jobs from Strapi
async function getAllJobs(baseEndpoint) {
  console.log('📥 Fetching all jobs from Strapi...');
  
  let allJobs = [];
  let page = 1;
  const pageSize = 100;
  
  while (true) {
    try {
      const url = `${baseEndpoint}?pagination[page]=${page}&pagination[pageSize]=${pageSize}&populate=*`;
      console.log(`🔗 Fetching page ${page}: ${url}`);
      
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${STRAPI_API_TOKEN}`,
          'Content-Type': 'application/json'
        }
      });
      
      console.log(`📊 Response status: ${response.status} ${response.statusText}`);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error(`❌ API Error Response:`, errorText);
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();
      const jobs = data.data || [];
      
      if (jobs.length === 0) {
        break;
      }
      
      allJobs = allJobs.concat(jobs);
      console.log(`📦 Fetched ${jobs.length} jobs (page ${page}, total: ${allJobs.length})`);
      
      if (jobs.length < pageSize) {
        break;
      }
      
      page++;
    } catch (error) {
      console.error(`❌ Error fetching jobs (page ${page}):`, error.message);
      break;
    }
  }
  
  console.log(`✅ Total jobs fetched: ${allJobs.length}`);
  return allJobs;
}

// Function to identify duplicates
function findDuplicates(jobs) {
  console.log('🔍 Analyzing jobs for duplicates...');
  
  const duplicates = [];
  const seen = new Map();
  
  for (const job of jobs) {
    const key = `${job.attributes.title?.toLowerCase().trim()}_${job.attributes.company?.toLowerCase().trim()}_${job.attributes.location?.toLowerCase().trim()}`;
    
    if (seen.has(key)) {
      // This is a duplicate
      const original = seen.get(key);
      duplicates.push({
        original: original,
        duplicate: job,
        key: key
      });
    } else {
      seen.set(key, job);
    }
  }
  
  console.log(`🔍 Found ${duplicates.length} duplicate pairs`);
  return duplicates;
}

// Function to delete a job
async function deleteJob(jobId, baseEndpoint) {
  try {
    const deleteUrl = `${baseEndpoint}/${jobId}`;
    console.log(`🗑️  Deleting job ${jobId} from: ${deleteUrl}`);
    
    const response = await fetch(deleteUrl, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${STRAPI_API_TOKEN}`,
        'Content-Type': 'application/json'
      }
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    return true;
  } catch (error) {
    console.error(`❌ Error deleting job ${jobId}:`, error.message);
    return false;
  }
}

// Function to remove duplicates
async function removeDuplicates() {
  try {
    console.log('🚀 Starting duplicate removal process...');
    
    // Find working endpoint
    const workingEndpoint = await findWorkingEndpoint();
    if (!workingEndpoint) {
      console.error('❌ No working API endpoint found. Please check:');
      console.error('   1. Your Strapi URL is correct');
      console.error('   2. Your API token is valid and has the right permissions');
      console.error('   3. Your Strapi instance is running and accessible');
      process.exit(1);
    }
    
    console.log(`✅ Found working endpoint: ${workingEndpoint}`);
    
    // Get all jobs
    const allJobs = await getAllJobs(workingEndpoint);
    
    if (allJobs.length === 0) {
      console.log('ℹ️ No jobs found in the database');
      return;
    }
    
    // Find duplicates
    const duplicates = findDuplicates(allJobs);
    
    if (duplicates.length === 0) {
      console.log('✅ No duplicates found!');
      return;
    }
    
    console.log(`\n📊 Duplicate Analysis:`);
    console.log(`   Total jobs: ${allJobs.length}`);
    console.log(`   Duplicate pairs: ${duplicates.length}`);
    console.log(`   Jobs to remove: ${duplicates.length}`);
    console.log(`   Jobs to keep: ${allJobs.length - duplicates.length}`);
    
    // Show some examples
    console.log(`\n📋 Example duplicates:`);
    duplicates.slice(0, 5).forEach((dup, index) => {
      console.log(`   ${index + 1}. "${dup.duplicate.attributes.title}" at ${dup.duplicate.attributes.company}`);
    });
    
    // Delete duplicates
    console.log(`\n🗑️  Deleting ${duplicates.length} duplicate jobs...`);
    
    let deletedCount = 0;
    let errorCount = 0;
    
    for (const dup of duplicates) {
      const success = await deleteJob(dup.duplicate.id, workingEndpoint);
      if (success) {
        deletedCount++;
        console.log(`✅ Deleted: "${dup.duplicate.attributes.title}" at ${dup.duplicate.attributes.company}`);
      } else {
        errorCount++;
        console.log(`❌ Failed to delete: "${dup.duplicate.attributes.title}" at ${dup.duplicate.attributes.company}`);
      }
      
      // Small delay to avoid overwhelming the API
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    console.log(`\n📊 Deletion Summary:`);
    console.log(`   Successfully deleted: ${deletedCount}`);
    console.log(`   Failed to delete: ${errorCount}`);
    console.log(`   Total processed: ${duplicates.length}`);
    
    if (deletedCount > 0) {
      console.log(`\n✅ Duplicate removal completed!`);
      console.log(`   Removed ${deletedCount} duplicate jobs`);
      console.log(`   Database now has ${allJobs.length - deletedCount} unique jobs`);
    }
    
  } catch (error) {
    console.error('❌ Error during duplicate removal:', error.message);
    process.exit(1);
  }
}

// Run the script
if (require.main === module) {
  removeDuplicates();
}

module.exports = { removeDuplicates, getAllJobs, findDuplicates };
