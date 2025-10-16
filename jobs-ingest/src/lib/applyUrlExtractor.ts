import { fetchWithCloudflareBypass } from './cloudflareBypass';
import * as cheerio from 'cheerio';

/**
 * Extract real company apply URL from Adzuna/Reed job pages
 * This prevents users from being redirected to job board sites
 */
export async function extractRealApplyUrl(jobBoardUrl: string): Promise<string> {
  try {
    console.log(`🔗 Extracting real apply URL from: ${jobBoardUrl}`);
    
    const { html } = await fetchWithCloudflareBypass(jobBoardUrl);
    const $ = cheerio.load(html);
    
    // Look for common apply button/link selectors
    const applySelectors = [
      'a[href*="apply"]',
      'a[href*="application"]',
      'a[href*="careers"]',
      'a[href*="jobs"]',
      '.apply-button',
      '.apply-btn',
      '.job-apply',
      '.apply-now',
      '.application-link',
      '[class*="apply"]',
      '[class*="application"]',
      'a[data-testid*="apply"]',
      'a[data-cy*="apply"]'
    ];
    
    for (const selector of applySelectors) {
      const link = $(selector).first();
      if (link.length > 0) {
        const href = link.attr('href');
        if (href && !href.includes('adzuna') && !href.includes('reed')) {
          const fullUrl = new URL(href, jobBoardUrl).toString();
          console.log(`✅ Found real apply URL: ${fullUrl}`);
          return fullUrl;
        }
      }
    }
    
    // Fallback: return original URL if no real apply URL found
    console.log(`⚠️  No real apply URL found, using original: ${jobBoardUrl}`);
    return jobBoardUrl;
    
  } catch (error) {
    console.warn(`Failed to extract apply URL from ${jobBoardUrl}:`, error);
    return jobBoardUrl;
  }
}
