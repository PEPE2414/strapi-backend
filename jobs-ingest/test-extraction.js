const { smartFetch } = require('./dist/lib/smartFetcher');
const { debugExtractJobs } = require('./dist/lib/debugExtractor');
const cheerio = require('cheerio');

async function testExtraction() {
  console.log('🧪 Testing job extraction on graduate job boards...\n');
  
  const testUrls = [
    'https://www.gradcracker.com/search/graduate-jobs',
    'https://targetjobs.co.uk/uk/en/search/offers',
    'https://www.prospects.ac.uk/graduate-jobs',
    'https://www.milkround.com/jobs',
    'https://www.brightnetwork.co.uk/graduate-jobs',
    'https://www.ratemyplacement.co.uk/placements'
  ];
  
  for (const url of testUrls) {
    try {
      console.log(`\n🔍 Testing: ${url}`);
      console.log('─'.repeat(80));
      
      // Fetch the page
      const { html } = await smartFetch(url);
      const $ = cheerio.load(html);
      
      console.log(`📊 Page loaded: ${html.length} characters`);
      
      // Extract jobs
      const jobs = debugExtractJobs($, 'Test', 'test', url);
      
      console.log(`📋 Found ${jobs.length} jobs`);
      
      if (jobs.length > 0) {
        console.log('📝 Sample jobs:');
        jobs.slice(0, 3).forEach((job, i) => {
          console.log(`  ${i + 1}. "${job.title}" at ${job.company.name}`);
        });
      } else {
        console.log('❌ No jobs found');
      }
      
    } catch (error) {
      console.error(`❌ Error testing ${url}:`, error.message);
    }
    
    // Add delay between tests
    await new Promise(resolve => setTimeout(resolve, 2000));
  }
  
  console.log('\n✅ Test completed!');
}

testExtraction().catch(console.error);
