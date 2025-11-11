import { chromium, Browser, Page, BrowserContext } from 'playwright';
import { smartFetch } from './smartFetcher';
import { fetchWithCloudflareBypass } from './cloudflareBypass';
import { aggressiveExtractJobs } from './aggressiveJobExtractor';
import * as cheerio from 'cheerio';
import { CanonicalJob } from '../types';
import { recordXHREndpoint } from './xhrDiscovery';
import { registerDetailUrls } from './urlDiscovery';

const LOAD_MORE_SELECTORS = [
  'button:has-text("Load more")',
  'button:has-text("Show more")',
  'a:has-text("Load more")',
  'a:has-text("Show more")',
  '[data-testid*="load-more"]',
  '[aria-label*="load more"]',
  '[aria-label*="show more"]'
];

/**
 * Hybrid scraper that tries multiple strategies in order
 * Strategy 1: Simplified Direct Scraping
 * Strategy 2: Playwright Browser Automation
 * Strategy 3: ScraperAPI Fallback
 */
export class HybridScraper {
  private browser: Browser | null = null;
  private contextPool: Map<string, BrowserContext> = new Map();

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

    const context = await this.getContext(boardKey);
    const page = await context.newPage();
    
    try {
      await this.attachNetworkListeners(page, boardKey);

      // Set realistic user agent and headers
      await page.setExtraHTTPHeaders({
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      });
      
      // Navigate to the page
      await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });
      await this.simulateUserBehaviour(page);
      
      // Get the HTML content
      const html = await page.content();
      const $ = cheerio.load(html);
      this.captureDetailLinks(html, url, boardKey);
      
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
      this.contextPool.clear();
    }
  }

  private async getContext(boardKey: string): Promise<BrowserContext> {
    const key = boardKey.toLowerCase();
    if (this.contextPool.has(key)) {
      return this.contextPool.get(key)!;
    }
    if (!this.browser) {
      throw new Error('Browser not initialised');
    }
    const context = await this.browser.newContext({
      viewport: {
        width: 1200 + Math.floor(Math.random() * 200),
        height: 850 + Math.floor(Math.random() * 200)
      },
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36'
    });
    this.contextPool.set(key, context);
    return context;
  }

  private async simulateUserBehaviour(page: Page): Promise<void> {
    const steps = 3 + Math.floor(Math.random() * 4);
    let lastHeight = 0;
    for (let i = 0; i < steps; i++) {
      await page.evaluate('window.scrollTo(0, document.body.scrollHeight)');
      await page.waitForTimeout(800 + Math.floor(Math.random() * 800));
      const height = await page.evaluate<number>('document.body.scrollHeight');
      if (height === lastHeight) break;
      lastHeight = height;
    }

    for (const selector of LOAD_MORE_SELECTORS) {
      try {
        const button = await page.$(selector);
        if (button) {
          await button.click({ delay: 30 });
          await page.waitForTimeout(1200 + Math.floor(Math.random() * 800));
        }
      } catch {
        // ignore
      }
    }

    try {
      const width = 200 + Math.floor(Math.random() * 400);
      const height = 200 + Math.floor(Math.random() * 200);
      await page.mouse.move(width, height);
      await page.mouse.move(width + 20, height + 10, { steps: 5 });
    } catch {
      // ignore
    }
  }

  private captureDetailLinks(html: string, currentUrl: string, boardKey: string) {
    const $ = cheerio.load(html);
    const anchors = $('a[href]')
      .map((_, el) => $(el).attr('href'))
      .get()
      .filter((href): href is string => Boolean(href));

    const detailLinks = anchors
      .map(href => {
        try {
          return new URL(href, currentUrl).toString();
        } catch {
          return null;
        }
      })
      .filter((full): full is string => Boolean(full))
      .filter(url =>
        /job|vacanc|role|position|opportunit|listing/.test(url.toLowerCase()) &&
        !/logout|login|register|bookmark|apply|javascript:void/.test(url.toLowerCase())
      );

    if (detailLinks.length > 0) {
      registerDetailUrls(boardKey, detailLinks.slice(0, 200));
    }
  }

  private async attachNetworkListeners(page: Page, boardKey: string) {
    page.on('response', async (response) => {
      try {
        const url = response.url();
        const headers = response.headers();
        const contentType = headers['content-type'];
        if (contentType && contentType.includes('application/json')) {
          recordXHREndpoint(boardKey, url, contentType);
        }
      } catch {
        // ignore
      }
    });
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
