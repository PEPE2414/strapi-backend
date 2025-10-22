import { smartFetch } from './smartFetcher';
import { aggressiveExtractJobs } from './aggressiveJobExtractor';
import * as cheerio from 'cheerio';
import { CanonicalJob } from '../types';

/**
 * Direct scraper for graduate job boards
 * Uses known working URLs and aggressive extraction
 */
export async function scrapeGraduateBoardsDirect(): Promise<CanonicalJob[]> {
  const allJobs: CanonicalJob[] = [];
  
  // Direct URLs that are more likely to work
  const boardUrls = {
    gradcracker: [
      'https://www.gradcracker.com/search/graduate-jobs',
      'https://www.gradcracker.com/search/internships',
      'https://www.gradcracker.com/search/placements',
      'https://www.gradcracker.com/jobs',
      'https://www.gradcracker.com/'
    ],
    targetjobs: [
      'https://targetjobs.co.uk/uk/en/search/offers',
      'https://targetjobs.co.uk/graduate-jobs',
      'https://targetjobs.co.uk/search',
      'https://targetjobs.co.uk/'
    ],
    prospects: [
      'https://www.prospects.ac.uk/graduate-jobs',
      'https://www.prospects.ac.uk/jobs',
      'https://www.prospects.ac.uk/'
    ],
    brightnetwork: [
      'https://www.brightnetwork.co.uk/graduate-jobs',
      'https://www.brightnetwork.co.uk/jobs',
      'https://www.brightnetwork.co.uk/'
    ],
    ratemyplacement: [
      'https://www.ratemyplacement.co.uk/placements',
      'https://www.ratemyplacement.co.uk/internships',
      'https://www.ratemyplacement.co.uk/'
    ]
  };
  
  for (const [boardKey, urls] of Object.entries(boardUrls)) {
    console.log(`\n🎯 Direct scraping ${boardKey}...`);
    
    for (const url of urls) {
      try {
        console.log(`  🔄 Scraping: ${url}`);
        const { html } = await smartFetch(url);
        const $ = cheerio.load(html);
        
        console.log(`  📊 Fetched ${html.length} chars, parsing...`);
        
        // Use aggressive extraction
        const jobs = aggressiveExtractJobs($, boardKey, boardKey, url);
        
        if (jobs.length > 0) {
          console.log(`  ✅ Found ${jobs.length} jobs on ${url}`);
          allJobs.push(...jobs);
        } else {
          console.log(`  ⚠️  No jobs found on ${url}`);
        }
        
        // Add delay between requests
        await new Promise(resolve => setTimeout(resolve, 2000));
        
      } catch (error) {
        console.warn(`  ❌ Failed to scrape ${url}:`, error instanceof Error ? error.message : String(error));
      }
    }
  }
  
  console.log(`\n📊 Direct scraping completed: ${allJobs.length} total jobs`);
  return allJobs;
}

/**
 * Scrape a specific graduate job board with multiple strategies
 */
export async function scrapeBoardWithStrategies(boardKey: string, baseUrl: string): Promise<CanonicalJob[]> {
  const jobs: CanonicalJob[] = [];
  
  // Strategy 1: Try main search pages
  const searchUrls = [
    `${baseUrl}/search/graduate-jobs`,
    `${baseUrl}/search/internships`,
    `${baseUrl}/search/placements`,
    `${baseUrl}/graduate-jobs`,
    `${baseUrl}/internships`,
    `${baseUrl}/placements`,
    `${baseUrl}/jobs`,
    `${baseUrl}/`
  ];
  
  for (const url of searchUrls) {
    try {
      console.log(`  🔄 Trying: ${url}`);
      const { html } = await smartFetch(url);
      const $ = cheerio.load(html);
      
      const pageJobs = aggressiveExtractJobs($, boardKey, boardKey, url);
      if (pageJobs.length > 0) {
        console.log(`  ✅ Found ${pageJobs.length} jobs on ${url}`);
        jobs.push(...pageJobs);
      }
      
      await new Promise(resolve => setTimeout(resolve, 1000));
    } catch (error) {
      console.log(`  ❌ Failed: ${url}`);
    }
  }
  
  return jobs;
}
