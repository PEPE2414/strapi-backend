import { scrapeRapidAPIActiveJobs } from './rapidapiActiveJobs';
import { scrapeLinkedInJobs } from './linkedinJobs';
import { CanonicalJob } from '../types';

/**
 * Combined scraper for RapidAPI Active Jobs DB and LinkedIn Jobs API
 * Searches for graduate jobs, internships, and placements in UK
 */
export async function scrapeRapidAPILinkedInJobs(): Promise<CanonicalJob[]> {
  const allJobs: CanonicalJob[] = [];
  
  console.log('🔄 Scraping RapidAPI + LinkedIn Jobs APIs...');
  
  // Scrape RapidAPI Active Jobs DB
  try {
    console.log('\n📡 Scraping RapidAPI Active Jobs DB...');
    const rapidApiJobs = await scrapeRapidAPIActiveJobs();
    allJobs.push(...rapidApiJobs);
    console.log(`✅ RapidAPI: Found ${rapidApiJobs.length} jobs`);
  } catch (error) {
    console.warn('❌ RapidAPI Active Jobs DB failed:', error instanceof Error ? error.message : String(error));
  }
  
  // Scrape LinkedIn Jobs API
  try {
    console.log('\n💼 Scraping LinkedIn Jobs API...');
    const linkedInJobs = await scrapeLinkedInJobs();
    allJobs.push(...linkedInJobs);
    console.log(`✅ LinkedIn: Found ${linkedInJobs.length} jobs`);
  } catch (error) {
    console.warn('❌ LinkedIn Jobs API failed:', error instanceof Error ? error.message : String(error));
  }
  
  console.log(`\n📊 Combined API scraping: ${allJobs.length} total jobs`);
  return allJobs;
}
