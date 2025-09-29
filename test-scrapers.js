// Simple test script to debug scraper issues
const { scrapeGreenhouse } = require('./jobs-ingest/dist/sources/greenhouse');
const { scrapeLever } = require('./jobs-ingest/dist/sources/lever');

async function testScrapers() {
  console.log('🧪 Testing individual scrapers...\n');
  
  // Test Greenhouse
  console.log('1. Testing Greenhouse (stripe)...');
  try {
    const greenhouseJobs = await scrapeGreenhouse('stripe');
    console.log(`   Found ${greenhouseJobs.length} jobs`);
    if (greenhouseJobs.length > 0) {
      console.log(`   Sample job: ${greenhouseJobs[0].title} at ${greenhouseJobs[0].company.name}`);
    }
  } catch (error) {
    console.log(`   Error: ${error.message}`);
  }
  
  // Test Lever
  console.log('\n2. Testing Lever (netflix)...');
  try {
    const leverJobs = await scrapeLever('netflix');
    console.log(`   Found ${leverJobs.length} jobs`);
    if (leverJobs.length > 0) {
      console.log(`   Sample job: ${leverJobs[0].title} at ${leverJobs[0].company.name}`);
    }
  } catch (error) {
    console.log(`   Error: ${error.message}`);
  }
  
  console.log('\n✅ Scraper tests completed');
}

testScrapers().catch(console.error);
