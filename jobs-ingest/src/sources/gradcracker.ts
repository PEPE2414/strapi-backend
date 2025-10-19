import { get } from '../lib/fetcher';
import { fetchWithCloudflareBypass, getBypassStatus } from '../lib/cloudflareBypass';
import { smartFetch } from '../lib/smartFetcher';
import { getWorkingUrls } from '../lib/urlDiscovery';
import { extractDeadlineFromJobCard } from '../lib/deadlineExtractor';
import { extractGraduateJobs } from '../lib/graduateJobExtractor';
import { debugExtractJobs } from '../lib/debugExtractor';
import * as cheerio from 'cheerio';
import { CanonicalJob } from '../types';
import { makeUniqueSlug } from '../lib/slug';
import { sha256 } from '../lib/hash';
import { classifyJobType, parseSalary, toISO, isRelevantJobType, isUKJob } from '../lib/normalize';

export async function scrapeGradcracker(): Promise<CanonicalJob[]> {
  const jobs: CanonicalJob[] = [];
  
  try {
    console.log(`🔍 Auto-discovering working URLs for gradcracker...`);
    
    const urlPatterns = [
      'https://www.gradcracker.com/search/graduate-jobs',
      'https://www.gradcracker.com/hub/graduate-jobs',
      'https://www.gradcracker.com/jobs/graduate',
      'https://www.gradcracker.com/graduate-jobs',
      'https://www.gradcracker.com/jobs',
      'https://www.gradcracker.com/search',
      'https://www.gradcracker.com/internships',
      'https://www.gradcracker.com/placements',
      'https://www.gradcracker.com/graduate-schemes',
      'https://www.gradcracker.com/',
      'https://www.gradcracker.com/careers',
      'https://www.gradcracker.com/opportunities',
      'https://www.gradcracker.com/vacancies'
    ];
    
    const workingUrls = await getWorkingUrls(
      'gradcracker',
      urlPatterns,
      'https://www.gradcracker.com'
    );
    
    if (workingUrls.length === 0) {
      console.warn(`⚠️  No working URLs found for gradcracker`);
      return jobs;
    }
    
    console.log(`✅ Found ${workingUrls.length} working URLs for gradcracker`);
    
    // Scrape each working URL
    for (const url of workingUrls) {
      console.log(`🔄 Scraping Gradcracker: ${url}`);
      
      try {
        const { html } = await smartFetch(url);
        const $ = cheerio.load(html);
        
        console.log(`📊 Parsing page...`);
        
        // Use debug extractor for maximum job discovery
        const pageJobs = debugExtractJobs($, 'Gradcracker', 'gradcracker', url);
        if (pageJobs.length === 0) {
          console.log(`📄 No jobs found on this page`);
          continue;
        }
        
        console.log(`📦 Found ${pageJobs.length} jobs on this page`);
        jobs.push(...pageJobs);
        
        // Add delay between URLs
        await new Promise(resolve => setTimeout(resolve, 3000));
      } catch (error) {
        console.warn(`⚠️  Failed to scrape ${url}:`, error instanceof Error ? error.message : String(error));
      }
    }
    
    console.log(`📊 Gradcracker: Found ${jobs.length} total jobs`);
    return jobs;
    
  } catch (error) {
    console.warn(`Failed to scrape Gradcracker:`, error instanceof Error ? error.message : String(error));
    return jobs;
  }
}