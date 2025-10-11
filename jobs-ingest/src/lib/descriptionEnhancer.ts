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
 * Only enhances jobs with NO description at all
 */
export function needsDescriptionEnhancement(job: any): boolean {
  // Only enhance if there's absolutely no description
  if (!job.descriptionText && !job.descriptionHtml) {
    return true;
  }
  
  // If there's any description at all, don't enhance
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
      
      // Try each selector and collect candidates
      const candidates: Array<{ selector: string; html: string; text: string; length: number }> = [];
      
      for (const selector of selectors) {
        const element = $(selector);
        if (element.length > 0) {
          const text = element.text().trim();
          const html = element.html() || '';
          if (text.length > MIN_DESCRIPTION_LENGTH) {
            candidates.push({
              selector,
              html,
              text,
              length: text.length
            });
          }
        }
      }
      
      // If we found candidates, pick the best one (longest, most likely to be description)
      if (candidates.length > 0) {
        // Sort by length (longer is usually better for descriptions)
        candidates.sort((a, b) => b.length - a.length);
        const best = candidates[0];
        console.log(`  📋 Found description using selector: ${best.selector} (${best.length} chars)`);
        return best.html;
      }
      
      // Fallback: get body text (will need heavy LLM cleaning)
      const bodyText = $('body').text().trim();
      if (bodyText.length > MIN_DESCRIPTION_LENGTH) {
        console.log(`  ⚠️  Using full body text as fallback (${bodyText.length} chars) - may include navigation`);
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
    // Truncate if too long, but try to keep the middle section where job description usually is
    let textToClean = rawDescription;
    if (rawDescription.length > 10000) {
      // For very long content, take middle section (skip navigation at start and footer at end)
      const skipStart = Math.floor(rawDescription.length * 0.1); // Skip first 10%
      const skipEnd = Math.floor(rawDescription.length * 0.1);   // Skip last 10%
      textToClean = rawDescription.substring(skipStart, rawDescription.length - skipEnd);
      console.log(`  ✂️  Truncated long content: ${rawDescription.length} → ${textToClean.length} chars (kept middle section)`);
    }
    
    const cleaned = await llmAssist({
      instruction: 'Extract ONLY the job description from this HTML content. Remove navigation menus, headers, footers, cookie notices, and any non-job-description content. Keep the core job information: role description, key responsibilities, requirements, and benefits. If you cannot find a clear job description, return "NO_DESCRIPTION_FOUND". Format as clean plain text without HTML tags.',
      text: textToClean.substring(0, 8000), // Final safety limit
      maxOut: 600
    });
    
    // Check if LLM couldn't find a description
    if (cleaned && cleaned.includes('NO_DESCRIPTION_FOUND')) {
      console.log(`  ⚠️  LLM could not find a clear job description in the content`);
      return null;
    }
    
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

