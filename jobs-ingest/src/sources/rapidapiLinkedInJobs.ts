import { scrapeJSearch } from './jsearch';
import { scrapeLinkedInJobs } from './linkedinJobs';
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
  
  console.log(`\n📊 Combined API scraping: ${allJobs.length} total jobs`);
  return allJobs;
}
