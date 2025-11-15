import { chromium, Browser, Page, BrowserContext } from 'playwright';
import * as cheerio from 'cheerio';

/**
 * Cloudflare bypass scraper using Playwright
 * This handles Cloudflare challenges by using a real browser
 */
export class CloudflareScraper {
  private browser: Browser | null = null;
  private context: BrowserContext | null = null;

  /**
   * Initialize the browser with stealth settings
   */
  async init(options: {
    headless?: boolean;
    userAgent?: string;
    viewport?: { width: number; height: number };
  } = {}): Promise<void> {
    const {
      headless = true,
      userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      viewport = { width: 1920, height: 1080 },
    } = options;

    this.browser = await chromium.launch({
      headless,
      args: [
        '--disable-blink-features=AutomationControlled',
        '--disable-dev-shm-usage',
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-web-security',
        '--disable-features=IsolateOrigins,site-per-process',
      ],
    });

    this.context = await this.browser.newContext({
      userAgent,
      viewport,
      locale: 'en-GB',
      timezoneId: 'Europe/London',
      // Add realistic browser fingerprints
      permissions: [],
      geolocation: { longitude: -0.1276, latitude: 51.5074 }, // London
      colorScheme: 'light',
      // Add extra HTTP headers to look like a real browser
      extraHTTPHeaders: {
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
        'Accept-Language': 'en-GB,en;q=0.9',
        'Accept-Encoding': 'gzip, deflate, br',
        'DNT': '1',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1',
        'Sec-Fetch-Dest': 'document',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'none',
        'Sec-Fetch-User': '?1',
        'Cache-Control': 'max-age=0',
      },
    });

    // Add stealth scripts to avoid detection
    // Note: This code runs in the browser context, not Node.js
    // Using function syntax to avoid TypeScript errors (code runs in browser, not Node)
    await this.context.addInitScript(() => {
      // Override webdriver property
      // @ts-ignore - This runs in browser context
      Object.defineProperty(navigator, 'webdriver', {
        get: () => false,
      });

      // Override plugins
      // @ts-ignore - This runs in browser context
      Object.defineProperty(navigator, 'plugins', {
        get: () => [1, 2, 3, 4, 5],
      });

      // Override languages
      // @ts-ignore - This runs in browser context
      Object.defineProperty(navigator, 'languages', {
        get: () => ['en-GB', 'en'],
      });

      // Override permissions
      // @ts-ignore - This runs in browser context
      const originalQuery = window.navigator.permissions.query;
      // @ts-ignore - This runs in browser context
      window.navigator.permissions.query = (parameters: any) =>
        parameters.name === 'notifications'
          // @ts-ignore - This runs in browser context
          ? Promise.resolve({ state: Notification.permission } as PermissionStatus)
          : originalQuery(parameters);

      // Mock chrome object
      // @ts-ignore - This runs in browser context
      (window as any).chrome = {
        runtime: {},
      };

      // Override getBattery
      // @ts-ignore - This runs in browser context
      (navigator as any).getBattery = () =>
        Promise.resolve({
          charging: true,
          chargingTime: 0,
          dischargingTime: Infinity,
          level: 1,
        });
    });
  }

  /**
   * Scrape a URL and wait for Cloudflare challenge to complete
   */
  async scrape(url: string, options: {
    waitForSelector?: string;
    waitTime?: number;
    timeout?: number;
  } = {}): Promise<{
    html: string;
    page: Page;
  }> {
    if (!this.context) {
      throw new Error('Scraper not initialized. Call init() first.');
    }

    const {
      waitForSelector,
      waitTime = 2000, // Wait 2 seconds after page load
      timeout = 30000, // 30 second timeout
    } = options;

    const page = await this.context.newPage();

    try {
      // Navigate to the page
      await page.goto(url, {
        waitUntil: 'networkidle',
        timeout,
      });

      // Wait for Cloudflare challenge if present
      // Cloudflare challenge usually shows "Checking your browser" or similar
      const challengeSelectors = [
        'text="Checking your browser"',
        'text="Just a moment"',
        'text="Please wait"',
        '#challenge-form',
        '.cf-browser-verification',
      ];

      let challengeDetected = false;
      for (const selector of challengeSelectors) {
        try {
          await page.waitForSelector(selector, { timeout: 5000 });
          challengeDetected = true;
          console.log('Cloudflare challenge detected, waiting...');
          break;
        } catch {
          // Selector not found, continue
        }
      }

      if (challengeDetected) {
        // Wait for challenge to complete (usually takes 5-10 seconds)
        // Look for elements that appear after challenge completes
        try {
          await page.waitForFunction(
            () => {
              // @ts-ignore - This runs in browser context
              const challenge = document.querySelector('#challenge-form, .cf-browser-verification');
              // @ts-ignore - This runs in browser context
              return !challenge || (challenge as any).style.display === 'none';
            },
            { timeout: 15000 }
          );
          console.log('Cloudflare challenge completed');
        } catch {
          console.warn('Cloudflare challenge timeout, continuing anyway...');
        }
      }

      // Wait for specific selector if provided
      if (waitForSelector) {
        await page.waitForSelector(waitForSelector, { timeout: 10000 });
      }

      // Additional wait time to ensure page is fully loaded
      await page.waitForTimeout(waitTime);

      // Get the HTML content
      const html = await page.content();

      return { html, page };
    } catch (error) {
      await page.close();
      throw error;
    }
  }

  /**
   * Scrape and parse HTML with Cheerio
   */
  async scrapeAndParse(url: string, options: {
    waitForSelector?: string;
    waitTime?: number;
    timeout?: number;
  } = {}): Promise<{
    $: cheerio.CheerioAPI;
    html: string;
    page: Page;
  }> {
    const { html, page } = await this.scrape(url, options);
    const $ = cheerio.load(html);
    return { $, html, page };
  }

  /**
   * Close the browser and cleanup
   */
  async close(): Promise<void> {
    if (this.context) {
      await this.context.close();
      this.context = null;
    }
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
  }

  /**
   * Get a new page from the context
   */
  async newPage(): Promise<Page> {
    if (!this.context) {
      throw new Error('Scraper not initialized. Call init() first.');
    }
    return this.context.newPage();
  }
}

/**
 * Convenience function to scrape a single URL
 */
export async function scrapeWithCloudflareBypass(
  url: string,
  options: {
    headless?: boolean;
    waitForSelector?: string;
    waitTime?: number;
    timeout?: number;
  } = {}
): Promise<string> {
  const scraper = new CloudflareScraper();
  try {
    await scraper.init({ headless: options.headless });
    const { html } = await scraper.scrape(url, options);
    return html;
  } finally {
    await scraper.close();
  }
}

