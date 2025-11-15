/**
 * Script to scrape job listings from gradcracker.com
 * 
 * Usage:
 *   npm run jobs:scrape-gradcracker
 *   npm run jobs:scrape-gradcracker -- --path="/search/aerospace/engineering-graduate-jobs" --pages=3
 */

import { scrapeGradcrackerJobs } from '../lib/gradcrackerScraper';
import { writeFileSync } from 'fs';
import { join } from 'path';

async function main() {
  // Parse command line arguments
  const args = process.argv.slice(2);
  let path = '/search/all-disciplines/engineering-graduate-jobs';
  let maxPages = 1;
  let headless = true;
  let outputFile: string | null = null;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--path' && args[i + 1]) {
      path = args[i + 1];
      i++;
    } else if (arg === '--pages' && args[i + 1]) {
      maxPages = parseInt(args[i + 1], 10);
      i++;
    } else if (arg === '--headless' && args[i + 1]) {
      headless = args[i + 1] === 'true';
      i++;
    } else if (arg === '--output' && args[i + 1]) {
      outputFile = args[i + 1];
      i++;
    } else if (arg === '--help' || arg === '-h') {
      console.log(`
Usage: npm run jobs:scrape-gradcracker [options]

Options:
  --path <path>      Search path (default: /search/all-disciplines/engineering-graduate-jobs)
  --pages <number>   Number of pages to scrape (default: 1)
  --headless <true|false>  Run browser in headless mode (default: true)
  --output <file>    Output file path for JSON results
  --help, -h         Show this help message

Examples:
  npm run jobs:scrape-gradcracker
  npm run jobs:scrape-gradcracker -- --path="/search/aerospace/engineering-graduate-jobs" --pages=3
  npm run jobs:scrape-gradcracker -- --headless=false --output=gradcracker-jobs.json
      `);
      process.exit(0);
    }
  }

  console.log('Starting Gradcracker scraper...');
  console.log(`Path: ${path}`);
  console.log(`Max pages: ${maxPages}`);
  console.log(`Headless: ${headless}`);

  try {
    const jobs = await scrapeGradcrackerJobs(path, {
      maxPages,
      headless,
    });

    console.log(`\n✅ Successfully scraped ${jobs.length} jobs`);

    // Display summary
    if (jobs.length > 0) {
      console.log('\nSample jobs:');
      jobs.slice(0, 5).forEach((job, index) => {
        console.log(`${index + 1}. ${job.title} at ${job.company.name}`);
        console.log(`   Location: ${job.location || 'N/A'}`);
        console.log(`   URL: ${job.applyUrl || job.sourceUrl}`);
        console.log('');
      });
    }

    // Save to file if specified
    if (outputFile) {
      const outputPath = join(process.cwd(), outputFile);
      writeFileSync(outputPath, JSON.stringify(jobs, null, 2), 'utf-8');
      console.log(`\n✅ Results saved to ${outputPath}`);
    } else {
      // Save to default location
      const defaultOutput = join(process.cwd(), 'gradcracker-jobs.json');
      writeFileSync(defaultOutput, JSON.stringify(jobs, null, 2), 'utf-8');
      console.log(`\n✅ Results saved to ${defaultOutput}`);
    }

    // Display statistics
    const companies = new Set(jobs.map(j => j.company));
    const locations = new Set(jobs.map(j => j.location).filter(Boolean));
    
    console.log('\n📊 Statistics:');
    console.log(`   Total jobs: ${jobs.length}`);
    console.log(`   Unique companies: ${companies.size}`);
    console.log(`   Unique locations: ${locations.size}`);
  } catch (error) {
    console.error('❌ Error scraping gradcracker:', error);
    process.exit(1);
  }
}

main();

