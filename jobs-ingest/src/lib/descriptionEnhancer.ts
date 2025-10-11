import { get } from './fetcher';
import { llmAssist } from './llm';
import * as cheerio from 'cheerio';

/**
 * Enhances job descriptions by scraping the apply URL when description is missing or poor quality
 */

const MIN_DESCRIPTION_LENGTH = 200; // Minimum acceptable description length
const MAX_SCRAPE_TIME = 10000; // 10 seconds max per job

/**
 * Check if a job needs description enhancement
 */
export function needsDescriptionEnhancement(job: any): boolean {
  // No description at all
  if (!job.descriptionText && !job.descriptionHtml) {
    return true;
  }
  
  // Description is too short (likely incomplete)
  const textLength = job.descriptionText?.length || 0;
  const htmlLength = job.descriptionHtml?.length || 0;
  
  if (textLength < MIN_DESCRIPTION_LENGTH && htmlLength < MIN_DESCRIPTION_LENGTH * 2) {
    return true;
  }
  
  return false;
}

/**
 * Extract job description from apply URL
 */
async function scrapeJobDescription(applyUrl: string): Promise<string | null> {
  try {
    console.log(`  📄 Enhancing description from: ${applyUrl}`);
    
    // Set a timeout to prevent hanging
    const timeoutPromise = new Promise<null>((resolve) => {
      setTimeout(() => resolve(null), MAX_SCRAPE_TIME);
    });
    
    const scrapePromise = (async () => {
      const { html } = await get(applyUrl);
      const $ = cheerio.load(html);
      
      // Remove unwanted elements
      $('script, style, nav, header, footer, iframe, .advertisement, .ads').remove();
      
      // Try to find job description with common selectors
      const selectors = [
        // Common job description containers
        '[class*="job-description"]',
        '[class*="description"]',
        '[id*="job-description"]',
        '[id*="description"]',
        '.job-details',
        '.position-description',
        'article',
        'main',
        '[role="main"]',
        // Greenhouse
        '.content',
        // Lever
        '.posting-description',
        // Workday
        '[data-automation-id="jobPostingDescription"]',
        // Generic
        '.content-wrapper',
        '.job-content'
      ];
      
      for (const selector of selectors) {
        const element = $(selector);
        if (element.length > 0) {
          const text = element.text().trim();
          if (text.length > MIN_DESCRIPTION_LENGTH) {
            return element.html() || text;
          }
        }
      }
      
      // Fallback: get body text
      const bodyText = $('body').text().trim();
      if (bodyText.length > MIN_DESCRIPTION_LENGTH) {
        return bodyText;
      }
      
      return null;
    })();
    
    // Race between scraping and timeout
    const result = await Promise.race([scrapePromise, timeoutPromise]);
    
    if (result && result.length > MIN_DESCRIPTION_LENGTH) {
      return result;
    }
    
    return null;
    
  } catch (error) {
    console.warn(`  ⚠️  Failed to scrape description from ${applyUrl}:`, error instanceof Error ? error.message : String(error));
    return null;
  }
}

/**
 * Clean and format description using LLM
 */
async function cleanDescription(rawDescription: string): Promise<string | null> {
  try {
    // Truncate if too long (LLM token limits)
    const truncated = rawDescription.substring(0, 8000);
    
    const cleaned = await llmAssist({
      instruction: 'Extract and clean the job description. Remove navigation, headers, footers, and boilerplate. Keep only the essential job information: role description, responsibilities, requirements, and benefits. Format as clean plain text. Limit to ~800 words.',
      text: truncated,
      maxOut: 600
    });
    
    return cleaned || null;
    
  } catch (error) {
    console.warn(`  ⚠️  Failed to clean description with LLM:`, error instanceof Error ? error.message : String(error));
    return null;
  }
}

/**
 * Main function to enhance a job's description
 */
export async function enhanceJobDescription(job: any): Promise<boolean> {
  try {
    // Check if enhancement is needed
    if (!needsDescriptionEnhancement(job)) {
      return false; // No enhancement needed
    }
    
    console.log(`  🔍 Job needs description enhancement: ${job.title} at ${job.company?.name}`);
    
    // Try to scrape the apply URL
    const rawDescription = await scrapeJobDescription(job.applyUrl);
    
    if (!rawDescription) {
      console.log(`  ⚠️  Could not scrape description from apply URL`);
      return false;
    }
    
    console.log(`  ✅ Scraped description (${rawDescription.length} chars), cleaning with LLM...`);
    
    // Clean with LLM
    const cleanedDescription = await cleanDescription(rawDescription);
    
    if (!cleanedDescription || cleanedDescription.length < MIN_DESCRIPTION_LENGTH) {
      console.log(`  ⚠️  Cleaned description too short or failed`);
      return false;
    }
    
    // Update the job object
    job.descriptionText = cleanedDescription;
    job.descriptionHtml = rawDescription;
    
    console.log(`  ✅ Enhanced description (${cleanedDescription.length} chars)`);
    return true;
    
  } catch (error) {
    console.warn(`  ❌ Failed to enhance job description:`, error instanceof Error ? error.message : String(error));
    return false;
  }
}

/**
 * Batch enhance multiple jobs with rate limiting
 */
export async function enhanceJobDescriptions(jobs: any[], maxEnhancements: number = 50): Promise<number> {
  let enhancedCount = 0;
  let attemptedCount = 0;
  
  console.log(`\n🔍 Checking ${jobs.length} jobs for description enhancement...`);
  
  for (const job of jobs) {
    // Stop if we've hit the max enhancements limit
    if (attemptedCount >= maxEnhancements) {
      console.log(`⏸️  Reached max enhancement limit (${maxEnhancements}), stopping`);
      break;
    }
    
    // Check if enhancement needed
    if (!needsDescriptionEnhancement(job)) {
      continue;
    }
    
    attemptedCount++;
    
    // Try to enhance
    const success = await enhanceJobDescription(job);
    if (success) {
      enhancedCount++;
    }
    
    // Rate limiting: wait between enhancements
    await new Promise(resolve => setTimeout(resolve, 2000)); // 2 second delay
  }
  
  console.log(`✅ Enhanced ${enhancedCount}/${attemptedCount} job descriptions`);
  return enhancedCount;
}

