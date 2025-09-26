// Simple test script to verify the pipeline components
import { scrapeGreenhouse } from './sources/greenhouse';
import { scrapeLever } from './sources/lever';
import { scrapeFromUrls } from './sources/sitemapGeneric';
import { sha256 } from './lib/hash';
import { makeUniqueSlug } from './lib/slug';
import { classifyJobType, parseSalary, toISO } from './lib/normalize';

async function testComponents() {
  console.log('Testing job ingestion components...\n');

  // Test utility functions
  console.log('1. Testing utility functions:');
  const testHash = sha256('test-job-title|test-company|https://example.com/apply');
  console.log('✓ Hash generation:', testHash.slice(0, 8) + '...');
  
  const testSlug = makeUniqueSlug('Software Engineer', 'Test Company', 'London', testHash);
  console.log('✓ Slug generation:', testSlug);
  
  const jobType = classifyJobType('Graduate Software Engineer - Summer Internship');
  console.log('✓ Job type classification:', jobType);
  
  const salary = parseSalary('£35,000 - £45,000 per annum');
  console.log('✓ Salary parsing:', salary);
  
  const isoDate = toISO('2024-01-15');
  console.log('✓ Date conversion:', isoDate);
  
  console.log('\n2. Testing source adapters:');
  
  // Test Greenhouse (with a real board)
  try {
    console.log('Testing Greenhouse adapter...');
    const greenhouseJobs = await scrapeGreenhouse('imperialcollege');
    console.log(`✓ Greenhouse: Found ${greenhouseJobs.length} jobs`);
    if (greenhouseJobs.length > 0) {
      console.log(`  Sample: ${greenhouseJobs[0].title} at ${greenhouseJobs[0].company.name}`);
    }
  } catch (error: any) {
    console.log('✗ Greenhouse test failed:', error?.message || error);
  }
  
  // Test Lever (with a real company)
  try {
    console.log('Testing Lever adapter...');
    const leverJobs = await scrapeLever('arup');
    console.log(`✓ Lever: Found ${leverJobs.length} jobs`);
    if (leverJobs.length > 0) {
      console.log(`  Sample: ${leverJobs[0].title} at ${leverJobs[0].company.name}`);
    }
  } catch (error: any) {
    console.log('✗ Lever test failed:', error?.message || error);
  }
  
  console.log('\n3. Testing generic scraper:');
  try {
    // Test with a simple HTML page
    const testUrls = ['https://httpbin.org/html'];
    const genericJobs = await scrapeFromUrls(testUrls, 'test:httpbin');
    console.log(`✓ Generic scraper: Processed ${genericJobs.length} URLs`);
  } catch (error: any) {
    console.log('✗ Generic scraper test failed:', error?.message || error);
  }
  
  console.log('\n✅ Component tests completed!');
}

// Run tests if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  testComponents().catch(console.error);
}

export { testComponents };
