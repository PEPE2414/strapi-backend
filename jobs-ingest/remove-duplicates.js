const fetch = require('node-fetch');

// Load environment variables from .env file if it exists
try {
  require('dotenv').config();
} catch (e) {
  // dotenv not available, continue without it
}

// Configuration
const STRAPI_URL = process.env.STRAPI_URL || 'http://localhost:1337';
const STRAPI_API_TOKEN = process.env.STRAPI_API_TOKEN;

console.log('🔍 Environment check:');
console.log(`   STRAPI_URL: ${STRAPI_URL}`);
console.log(`   STRAPI_API_TOKEN: ${STRAPI_API_TOKEN ? 'Set (length: ' + STRAPI_API_TOKEN.length + ')' : 'Not set'}`);

if (!STRAPI_API_TOKEN) {
  console.error('❌ STRAPI_API_TOKEN environment variable is required');
  console.error('   Please set it using: set STRAPI_API_TOKEN=your_token_here');
  console.error('   Or create a .env file with: STRAPI_API_TOKEN=your_token_here');
  process.exit(1);
}

// Function to get all jobs from Strapi
async function getAllJobs() {
  console.log('📥 Fetching all jobs from Strapi...');
  
  let allJobs = [];
  let page = 1;
  const pageSize = 100;
  
  while (true) {
    try {
      const url = `${STRAPI_URL}/content-manager/collection-types/api::job.job?pagination[page]=${page}&pagination[pageSize]=${pageSize}&populate=*`;
      console.log(`🔗 Fetching: ${url}`);
      console.log(`🔑 Using token: ${STRAPI_API_TOKEN.substring(0, 20)}...`);
      
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
async function deleteJob(jobId) {
  try {
    const response = await fetch(`${STRAPI_URL}/content-manager/collection-types/api::job.job/${jobId}`, {
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

// Function to test API connection
async function testApiConnection() {
  console.log('🧪 Testing API connection...');
  
  try {
    const response = await fetch(`${STRAPI_URL}/content-manager/collection-types/api::job.job?pagination[page]=1&pagination[pageSize]=1`, {
      headers: {
        'Authorization': `Bearer ${STRAPI_API_TOKEN}`,
        'Content-Type': 'application/json'
      }
    });
    
    console.log(`📊 Test response: ${response.status} ${response.statusText}`);
    
    if (response.ok) {
      const data = await response.json();
      console.log(`✅ API connection successful! Found ${data.meta?.pagination?.total || 0} total jobs`);
      return true;
    } else {
      const errorText = await response.text();
      console.error(`❌ API test failed:`, errorText);
      return false;
    }
  } catch (error) {
    console.error(`❌ API test error:`, error.message);
    return false;
  }
}

// Function to remove duplicates
async function removeDuplicates() {
  try {
    console.log('🚀 Starting duplicate removal process...');
    console.log(`🔗 Strapi URL: ${STRAPI_URL}`);
    
    // Test API connection first
    const apiWorking = await testApiConnection();
    if (!apiWorking) {
      console.error('❌ API connection failed. Please check your URL and token.');
      process.exit(1);
    }
    
    // Get all jobs
    const allJobs = await getAllJobs();
    
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
    
    // Confirm before deletion
    console.log(`\n⚠️  This will delete ${duplicates.length} duplicate jobs.`);
    console.log('   Press Ctrl+C to cancel, or wait 10 seconds to continue...');
    
    await new Promise(resolve => setTimeout(resolve, 10000));
    
    // Delete duplicates
    console.log(`\n🗑️  Deleting ${duplicates.length} duplicate jobs...`);
    
    let deletedCount = 0;
    let errorCount = 0;
    
    for (const dup of duplicates) {
      const success = await deleteJob(dup.duplicate.id);
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
