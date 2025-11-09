import { scrapeJSearch } from './jsearch';
import { scrapeLinkedInJobs } from './linkedinJobs';
import { scrapeJobsAPI14 } from './jobsApi14';
import { scrapeGlassdoorJobs } from './glassdoorJobs';
import { CanonicalJob } from '../types';

/**
 * Combined scraper for JSearch API and LinkedIn Jobs API
 * Searches for graduate jobs, internships, and placements in UK
 */
export async function scrapeRapidAPILinkedInJobs(): Promise<CanonicalJob[]> {
  const allJobs: CanonicalJob[] = [];
  
  console.log('🔄 Scraping JSearch + LinkedIn Jobs APIs...');
  
  // Scrape JSearch API
  try {
    console.log('\n📡 Scraping JSearch API...');
    const jsearchJobs = await scrapeJSearch();
    allJobs.push(...jsearchJobs);
    console.log(`✅ JSearch: Found ${jsearchJobs.length} jobs`);
  } catch (error) {
    console.warn('❌ JSearch API failed:', error instanceof Error ? error.message : String(error));
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

  // Scrape Jobs API 14
  try {
    console.log('\n🧠 Scraping Jobs API 14 (LinkedIn enhanced feed)...');
    const jobsApi14Results = await scrapeJobsAPI14();
    allJobs.push(...jobsApi14Results);
    console.log(`✅ Jobs API 14: Found ${jobsApi14Results.length} jobs`);
  } catch (error) {
    console.warn('❌ Jobs API 14 failed:', error instanceof Error ? error.message : String(error));
  }

  // Scrape Glassdoor Real-Time API (requires job IDs)
  const glassdoorIds = (process.env.GLASSDOOR_JOB_IDS || '')
    .split(',')
    .map(id => id.trim())
    .filter(Boolean);

  if (glassdoorIds.length > 0) {
    try {
      console.log(`\n🏢 Scraping Glassdoor Real-Time API (${glassdoorIds.length} job ids)...`);
      const glassdoorJobs = await scrapeGlassdoorJobs(glassdoorIds);
      allJobs.push(...glassdoorJobs);
      console.log(`✅ Glassdoor: Found ${glassdoorJobs.length} jobs`);
    } catch (error) {
      console.warn('❌ Glassdoor Real-Time API failed:', error instanceof Error ? error.message : String(error));
    }
  }

  console.log(`\n📊 Combined API scraping: ${allJobs.length} total jobs`);
  return allJobs;
}
