import { chromium, Browser, Page } from 'playwright';
import { smartFetch } from './smartFetcher';
import { fetchWithCloudflareBypass } from './cloudflareBypass';
import { aggressiveExtractJobs } from './aggressiveJobExtractor';
import * as cheerio from 'cheerio';
import { CanonicalJob } from '../types';

/**
 * Hybrid scraper that tries multiple strategies in order
 * Strategy 1: Simplified Direct Scraping
 * Strategy 2: Playwright Browser Automation
 * Strategy 3: ScraperAPI Fallback
 */
export class HybridScraper {
  private browser: Browser | null = null;

  /**
   * Scrape a URL using hybrid approach
   */
  async scrapeUrl(url: string, boardName: string, boardKey: string): Promise<CanonicalJob[]> {
    console.log(`🔄 Hybrid scraping: ${url}`);
    
    // Strategy 1: Simplified Direct Scraping
    try {
      console.log(`  📡 Strategy 1: Simplified Direct Scraping...`);
      const jobs = await this.simplifiedDirectScrape(url, boardName, boardKey);
      if (jobs.length > 0) {
        console.log(`  ✅ Strategy 1 successful: ${jobs.length} jobs`);
        return jobs;
      }
    } catch (error) {
      console.log(`  ⚠️  Strategy 1 failed: ${error instanceof Error ? error.message : String(error)}`);
    }

    // Strategy 2: Playwright Browser Automation
    try {
      console.log(`  🎭 Strategy 2: Playwright Browser Automation...`);
      const jobs = await this.playwrightScrape(url, boardName, boardKey);
      if (jobs.length > 0) {
        console.log(`  ✅ Strategy 2 successful: ${jobs.length} jobs`);
        return jobs;
      }
    } catch (error) {
      console.log(`  ⚠️  Strategy 2 failed: ${error instanceof Error ? error.message : String(error)}`);
    }

    // Strategy 3: ScraperAPI Fallback
    try {
      console.log(`  🔐 Strategy 3: ScraperAPI Fallback...`);
      const jobs = await this.scraperAPIScrape(url, boardName, boardKey);
      if (jobs.length > 0) {
        console.log(`  ✅ Strategy 3 successful: ${jobs.length} jobs`);
        return jobs;
      }
    } catch (error) {
      console.log(`  ⚠️  Strategy 3 failed: ${error instanceof Error ? error.message : String(error)}`);
    }

    console.log(`  ❌ All strategies failed for ${url}`);
    return [];
  }

  /**
   * Strategy 1: Simplified Direct Scraping
   */
  private async simplifiedDirectScrape(url: string, boardName: string, boardKey: string): Promise<CanonicalJob[]> {
    const { html } = await smartFetch(url);
    const $ = cheerio.load(html);
    return aggressiveExtractJobs($, boardName, boardKey, url);
  }

  /**
   * Strategy 2: Playwright Browser Automation
   */
  private async playwrightScrape(url: string, boardName: string, boardKey: string): Promise<CanonicalJob[]> {
    if (!this.browser) {
      this.browser = await chromium.launch({
        headless: process.env.PLAYWRIGHT_HEADLESS === 'true',
        args: ['--no-sandbox', '--disable-setuid-sandbox']
      });
    }

    const page = await this.browser.newPage();
    
    try {
      // Set realistic user agent and headers
      await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
      
      // Navigate to the page
      await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });
      
      // Wait for potential dynamic content
      await page.waitForTimeout(3000);
      
      // Get the HTML content
      const html = await page.content();
      const $ = cheerio.load(html);
      
      return aggressiveExtractJobs($, boardName, boardKey, url);
    } finally {
      await page.close();
    }
  }

  /**
   * Strategy 3: ScraperAPI Fallback
   */
  private async scraperAPIScrape(url: string, boardName: string, boardKey: string): Promise<CanonicalJob[]> {
    const { html } = await fetchWithCloudflareBypass(url);
    const $ = cheerio.load(html);
    return aggressiveExtractJobs($, boardName, boardKey, url);
  }

  /**
   * Close the browser
   */
  async close(): Promise<void> {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
  }
}

/**
 * Scrape multiple URLs with hybrid approach
 */
export async function scrapeUrlsWithHybrid(
  urls: string[], 
  boardName: string, 
  boardKey: string
): Promise<CanonicalJob[]> {
  const scraper = new HybridScraper();
  const allJobs: CanonicalJob[] = [];
  
  try {
    for (const url of urls) {
      try {
        const jobs = await scraper.scrapeUrl(url, boardName, boardKey);
        allJobs.push(...jobs);
        
        // Add delay between requests
        await new Promise(resolve => setTimeout(resolve, 2000));
      } catch (error) {
        console.warn(`Failed to scrape ${url}:`, error instanceof Error ? error.message : String(error));
      }
    }
  } finally {
    await scraper.close();
  }
  
  return allJobs;
}
