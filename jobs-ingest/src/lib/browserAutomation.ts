import { chromium, Browser, Page, BrowserContext } from 'playwright';
import { HttpsProxyAgent } from 'https-proxy-agent';

/**
 * Browser automation using Playwright with SmartProxy support
 * Used for JavaScript-rendered content and sites that block non-browser requests
 */

let browserInstance: Browser | null = null;
let browserContext: BrowserContext | null = null;

/**
 * Get or create a browser instance (singleton pattern)
 * Automatically installs browsers if not already installed
 */
async function getBrowser(): Promise<Browser> {
  if (!browserInstance) {
    console.log('🌐 Launching Playwright browser...');
    try {
      browserInstance = await chromium.launch({
        headless: true, // Required for Railway/server environments
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-accelerated-2d-canvas',
          '--no-first-run',
          '--no-zygote',
          '--disable-gpu',
          '--disable-blink-features=AutomationControlled'
        ]
      });
      console.log('✅ Browser launched successfully');
    } catch (error) {
      // If browser not installed, try to install it now
      if (error instanceof Error && error.message.includes('Executable doesn\'t exist')) {
        console.log('📦 Browser not found, installing Chromium...');
        const { execSync } = require('child_process');
        try {
          execSync('npx playwright install chromium --with-deps', { stdio: 'inherit', timeout: 300000 }); // 5 min timeout
          console.log('✅ Chromium installed, launching browser...');
          browserInstance = await chromium.launch({
            headless: true,
            args: [
              '--no-sandbox',
              '--disable-setuid-sandbox',
              '--disable-dev-shm-usage',
              '--disable-accelerated-2d-canvas',
              '--no-first-run',
              '--no-zygote',
              '--disable-gpu',
              '--disable-blink-features=AutomationControlled'
            ]
          });
          console.log('✅ Browser launched successfully');
        } catch (installError) {
          console.error('❌ Failed to install Chromium:', installError instanceof Error ? installError.message : String(installError));
          throw new Error('Playwright browser is not available. Please ensure Chromium is installed.');
        }
      } else {
        throw error;
      }
    }
  }
  return browserInstance;
}

/**
 * Get or create a browser context with SmartProxy support
 */
async function getBrowserContext(useProxy: boolean = true): Promise<BrowserContext> {
  const browser = await getBrowser();
  
  // Check if we should use SmartProxy
  const smartproxyUsername = process.env.SMARTPROXY_USERNAME;
  const smartproxyPassword = process.env.SMARTPROXY_PASSWORD;
  const smartproxyEndpoint = process.env.SMARTPROXY_ENDPOINT;
  
  const hasSmartProxy = !!(smartproxyUsername && smartproxyPassword && smartproxyEndpoint);
  
  if (useProxy && hasSmartProxy) {
    // Create new context with proxy for each request (better IP rotation)
    const proxyUrl = `http://${smartproxyUsername}:${smartproxyPassword}@${smartproxyEndpoint}`;
    console.log('🔐 Using SmartProxy with browser automation');
    
    return await browser.newContext({
      proxy: {
        server: proxyUrl,
        username: smartproxyUsername,
        password: smartproxyPassword
      },
      viewport: { width: 1920, height: 1080 },
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      locale: 'en-GB',
      timezoneId: 'Europe/London',
      // Add realistic browser fingerprints
      extraHTTPHeaders: {
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-GB,en;q=0.9',
        'Accept-Encoding': 'gzip, deflate, br',
        'DNT': '1',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1',
        'Sec-Fetch-Dest': 'document',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'none',
        'Cache-Control': 'max-age=0'
      }
    });
  } else {
    // Create context without proxy
    return await browser.newContext({
      viewport: { width: 1920, height: 1080 },
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      locale: 'en-GB',
      timezoneId: 'Europe/London',
      extraHTTPHeaders: {
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-GB,en;q=0.9',
        'Accept-Encoding': 'gzip, deflate, br',
        'DNT': '1',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1'
      }
    });
  }
}

/**
 * Fetch HTML content using Playwright browser automation
 * @param url - URL to fetch
 * @param useProxy - Whether to use SmartProxy (default: true)
 * @param waitForSelector - Optional CSS selector to wait for before extracting content
 * @param timeout - Timeout in milliseconds (default: 30000)
 */
export async function fetchWithBrowser(
  url: string,
  useProxy: boolean = true,
  waitForSelector?: string,
  timeout: number = 30000
): Promise<{ html: string; url: string; headers: any }> {
  let context: BrowserContext | null = null;
  let page: Page | null = null;
  
  try {
    console.log(`🌐 Fetching with browser: ${url}`);
    
    context = await getBrowserContext(useProxy);
    page = await context.newPage();
    
    // Set longer timeout for slow-loading pages
    page.setDefaultTimeout(timeout);
    page.setDefaultNavigationTimeout(timeout);
    
    // Navigate to the page
    const response = await page.goto(url, {
      waitUntil: 'networkidle', // Wait for network to be idle (better for JS-rendered content)
      timeout: timeout
    });
    
    if (!response) {
      throw new Error('No response received from page');
    }
    
    // Wait for optional selector if provided (useful for JS-rendered content)
    if (waitForSelector) {
      try {
        await page.waitForSelector(waitForSelector, { timeout: 10000 });
      } catch (error) {
        console.warn(`⚠️  Selector ${waitForSelector} not found, continuing anyway`);
      }
    }
    
    // Wait a bit for any remaining JavaScript to execute
    await page.waitForTimeout(2000);
    
    // Get the final HTML content
    const html = await page.content();
    const finalUrl = page.url();
    const headers = response.headers();
    
    console.log(`✅ Browser fetch successful: ${html.length} chars`);
    
    return {
      html,
      url: finalUrl,
      headers
    };
    
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.warn(`⚠️  Browser fetch failed for ${url}: ${errorMsg}`);
    throw error;
  } finally {
    // Clean up page and context
    if (page) {
      try {
        await page.close();
      } catch (error) {
        // Ignore cleanup errors
      }
    }
    if (context) {
      try {
        await context.close();
      } catch (error) {
        // Ignore cleanup errors
      }
    }
  }
}

/**
 * Check if browser automation is available
 */
export function isBrowserAvailable(): boolean {
  return true; // Playwright is always available if installed
}

/**
 * Close browser instance (call this at the end of scraping)
 */
export async function closeBrowser(): Promise<void> {
  if (browserContext) {
    try {
      await browserContext.close();
      browserContext = null;
    } catch (error) {
      // Ignore cleanup errors
    }
  }
  
  if (browserInstance) {
    try {
      await browserInstance.close();
      browserInstance = null;
      console.log('🔒 Browser closed');
    } catch (error) {
      // Ignore cleanup errors
    }
  }
}

/**
 * Get browser status information
 */
export function getBrowserStatus(): string {
  const smartproxyUsername = process.env.SMARTPROXY_USERNAME;
  const smartproxyPassword = process.env.SMARTPROXY_PASSWORD;
  const smartproxyEndpoint = process.env.SMARTPROXY_ENDPOINT;
  
  const hasSmartProxy = !!(smartproxyUsername && smartproxyPassword && smartproxyEndpoint);
  
  if (hasSmartProxy) {
    return '🌐 Playwright browser automation with SmartProxy enabled';
  } else {
    return '🌐 Playwright browser automation (no proxy)';
  }
}

