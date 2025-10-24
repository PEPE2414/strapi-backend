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

// Function to normalize text for comparison
function normalizeText(text) {
  if (!text) return '';
  return text.toString()
    .toLowerCase()
    .trim()
    .replace(/[^\w\s]/g, '') // Remove special characters
    .replace(/\s+/g, ' '); // Replace multiple spaces with single space
}

// Function to identify duplicates
function findDuplicates(jobs) {
  console.log('🔍 Analyzing jobs for duplicates...');
  
  const duplicates = [];
  const seen = new Map();
  
  for (const job of jobs) {
    try {
      // Handle different job structures
      const title = job.attributes?.title || job.title || '';
      const company = job.attributes?.company || job.company || '';
      
      // Skip jobs with missing title only (company can be empty)
      if (!title) {
        console.log(`⚠️  Skipping job with missing title: title="${title}"`);
        continue;
      }
      
      // Normalize text for better comparison
      const normalizedTitle = normalizeText(title);
      const normalizedCompany = normalizeText(company);
      
      // Create key using normalized title + company
      const key = normalizedCompany ? `${normalizedTitle}_${normalizedCompany}` : normalizedTitle;
      
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
    } catch (error) {
      console.log(`⚠️  Error processing job: ${error.message}`);
      console.log(`   Job structure:`, JSON.stringify(job, null, 2).substring(0, 200) + '...');
      continue;
    }
  }
  
  console.log(`🔍 Found ${duplicates.length} duplicate pairs`);
  return duplicates;
}

// Function to test delete endpoint
async function testDeleteEndpoint(baseEndpoint) {
  try {
    console.log('🧪 Testing delete endpoint permissions...');
    
    // Try to get a single job first
    const testResponse = await fetch(`${baseEndpoint}?pagination[page]=1&pagination[pageSize]=1`, {
      headers: {
        'Authorization': `Bearer ${STRAPI_API_TOKEN}`,
        'Content-Type': 'application/json'
      }
    });
    
    if (!testResponse.ok) {
      console.log(`❌ Cannot fetch jobs for testing: ${testResponse.status}`);
      return false;
    }
    
    const testData = await testResponse.json();
    if (!testData.data || testData.data.length === 0) {
      console.log('❌ No jobs found to test delete endpoint');
      return false;
    }
    
    const testJob = testData.data[0];
    console.log(`🧪 Testing delete with job ID: ${testJob.id}`);
    
    // Try to delete the test job using the correct API endpoint
    const deleteUrl = `${STRAPI_URL}/api/jobs/${testJob.id}`;
    console.log(`🧪 Testing delete with URL: ${deleteUrl}`);
    
    const deleteResponse = await fetch(deleteUrl, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${STRAPI_API_TOKEN}`,
        'Content-Type': 'application/json'
      }
    });
    
    console.log(`📊 Delete test response: ${deleteResponse.status} ${deleteResponse.statusText}`);
    
    if (deleteResponse.ok) {
      console.log('✅ Delete endpoint test successful');
      return true;
    } else {
      const errorText = await deleteResponse.text();
      console.log(`❌ Delete endpoint test failed: ${errorText}`);
      return false;
    }
    
  } catch (error) {
    console.log(`❌ Delete endpoint test error: ${error.message}`);
    return false;
  }
}

// Function to delete a job
async function deleteJob(jobId, baseEndpoint) {
  try {
    // Use the correct API endpoint for deletion
    const deleteUrl = `${STRAPI_URL}/api/jobs/${jobId}`;
    console.log(`🗑️  Deleting job ${jobId} from: ${deleteUrl}`);
    
    const response = await fetch(deleteUrl, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${STRAPI_API_TOKEN}`,
        'Content-Type': 'application/json'
      }
    });
    
    console.log(`📊 Delete response: ${response.status} ${response.statusText}`);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ Delete failed for job ${jobId}: ${response.status} ${response.statusText}`);
      console.error(`❌ Error details: ${errorText}`);
      return false;
    }
    
    // Verify the deletion by trying to fetch the job
    console.log(`✅ Delete request successful for job ${jobId}, verifying...`);
    
    // Wait a moment for the deletion to propagate
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // Try to fetch the job to verify it's deleted using the correct API endpoint
    const verifyResponse = await fetch(`${STRAPI_URL}/api/jobs/${jobId}`, {
      headers: {
        'Authorization': `Bearer ${STRAPI_API_TOKEN}`,
        'Content-Type': 'application/json'
      }
    });
    
    if (verifyResponse.status === 404) {
      console.log(`✅ Job ${jobId} successfully deleted and verified`);
      return true;
    } else {
      console.log(`⚠️  Job ${jobId} delete request succeeded but job still exists (status: ${verifyResponse.status})`);
      return false;
    }
    
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
    
    // Test delete endpoint before proceeding
    console.log('\n🧪 Testing delete endpoint...');
    const testDelete = await testDeleteEndpoint(workingEndpoint);
    if (!testDelete) {
      console.error('❌ Delete endpoint test failed. Cannot proceed with deletions.');
      console.error('   Please check your API token permissions for DELETE operations.');
      process.exit(1);
    }
    
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
    
    // Show detailed analysis of duplicates
    console.log(`\n🔍 Detailed duplicate analysis:`);
    const duplicateGroups = new Map();
    duplicates.forEach(dup => {
      const key = dup.key;
      if (!duplicateGroups.has(key)) {
        duplicateGroups.set(key, []);
      }
      duplicateGroups.get(key).push(dup.duplicate);
    });
    
    console.log(`📊 Found ${duplicateGroups.size} unique duplicate groups:`);
    let groupIndex = 1;
    for (const [key, jobs] of duplicateGroups) {
      console.log(`   Group ${groupIndex}: "${key}" (${jobs.length} duplicates)`);
      jobs.forEach((job, index) => {
        const title = job.attributes?.title || job.title || 'Unknown';
        const company = job.attributes?.company || job.company || 'No company';
        console.log(`      ${index + 1}. ID: ${job.id} - "${title}" at ${company}`);
      });
      groupIndex++;
      if (groupIndex > 10) {
        console.log(`   ... and ${duplicateGroups.size - 10} more groups`);
        break;
      }
    }
    
    console.log(`\n📊 Duplicate Analysis:`);
    console.log(`   Total jobs: ${allJobs.length}`);
    console.log(`   Duplicate pairs: ${duplicates.length}`);
    console.log(`   Jobs to remove: ${duplicates.length}`);
    console.log(`   Jobs to keep: ${allJobs.length - duplicates.length}`);
    
    // Show some examples
    console.log(`\n📋 Example duplicates:`);
    duplicates.slice(0, 5).forEach((dup, index) => {
      const title = dup.duplicate.attributes?.title || dup.duplicate.title || 'Unknown';
      const company = dup.duplicate.attributes?.company || dup.duplicate.company || 'No company';
      console.log(`   ${index + 1}. "${title}" at ${company}`);
    });
    
    // Delete duplicates
    console.log(`\n🗑️  Deleting ${duplicates.length} duplicate jobs...`);
    
    let deletedCount = 0;
    let errorCount = 0;
    
    for (const dup of duplicates) {
      const success = await deleteJob(dup.duplicate.id, workingEndpoint);
      if (success) {
        deletedCount++;
        const title = dup.duplicate.attributes?.title || dup.duplicate.title || 'Unknown';
        const company = dup.duplicate.attributes?.company || dup.duplicate.company || 'No company';
        console.log(`✅ Deleted: "${title}" at ${company}`);
      } else {
        errorCount++;
        const title = dup.duplicate.attributes?.title || dup.duplicate.title || 'Unknown';
        const company = dup.duplicate.attributes?.company || dup.duplicate.company || 'No company';
        console.log(`❌ Failed to delete: "${title}" at ${company}`);
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
