/**
 * Test script to diagnose API key issues
 * Run with: npm run jobs:test-keys
 */

import { scrapeRapidAPIActiveJobs } from './src/sources/rapidapiActiveJobs';
import { scrapeLinkedInJobs } from './src/sources/linkedinJobs';

async function testAPIKeys() {
  console.log('🔍 Testing API Keys...\n');
  
  // Check environment variables
  console.log('📋 Environment Variables:');
  console.log(`  RAPIDAPI_KEY: ${process.env.RAPIDAPI_KEY ? '✅ Set' : '❌ Not set'}`);
  console.log(`  LINKEDIN_API_KEY: ${process.env.LINKEDIN_API_KEY ? '✅ Set' : '❌ Not set'}`);
  console.log();
  
  // Test RapidAPI Active Jobs DB
  console.log('🧪 Testing RapidAPI Active Jobs DB...');
  try {
    if (!process.env.RAPIDAPI_KEY) {
      console.log('❌ RAPIDAPI_KEY not set, skipping test');
    } else {
      console.log('✅ RAPIDAPI_KEY is set, attempting to scrape...');
      const jobs = await scrapeRapidAPIActiveJobs();
      console.log(`📊 Results: ${jobs.length} jobs found`);
      if (jobs.length > 0) {
        console.log(`✅ Sample job: ${jobs[0].title} at ${jobs[0].company.name}`);
      }
    }
  } catch (error) {
    console.error('❌ RapidAPI test failed:', error);
  }
  
  console.log();
  
  // Test LinkedIn Jobs API
  console.log('🧪 Testing LinkedIn Jobs API...');
  try {
    if (!process.env.RAPIDAPI_KEY) {
      console.log('❌ RAPIDAPI_KEY not set, skipping test');
    } else {
      console.log('✅ RAPIDAPI_KEY is set, attempting to scrape...');
      const jobs = await scrapeLinkedInJobs();
      console.log(`📊 Results: ${jobs.length} jobs found`);
      if (jobs.length > 0) {
        console.log(`✅ Sample job: ${jobs[0].title} at ${jobs[0].company.name}`);
      }
    }
  } catch (error) {
    console.error('❌ LinkedIn test failed:', error);
  }
  
  console.log('\n✅ API Key testing complete');
}

testAPIKeys().catch(console.error);

