import { request } from 'undici';
import { HttpsProxyAgent } from 'https-proxy-agent';

/**
 * Enhanced fetcher with Cloudflare bypass techniques
 * Uses Smartproxy residential proxies if credentials are provided
 */

// More realistic browser headers to avoid detection
const BROWSER_HEADERS = {
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
  'Accept-Language': 'en-GB,en-US;q=0.9,en;q=0.8',
  'Accept-Encoding': 'gzip, deflate, br',
  'Cache-Control': 'max-age=0',
  'Sec-Ch-Ua': '"Chromium";v="122", "Not(A:Brand";v="24", "Google Chrome";v="122"',
  'Sec-Ch-Ua-Mobile': '?0',
  'Sec-Ch-Ua-Platform': '"Windows"',
  'Sec-Fetch-Dest': 'document',
  'Sec-Fetch-Mode': 'navigate',
  'Sec-Fetch-Site': 'none',
  'Sec-Fetch-User': '?1',
  'Upgrade-Insecure-Requests': '1',
  'Dnt': '1',
  'Connection': 'keep-alive',
  'Priority': 'u=0, i'
};

// More realistic user agents (latest versions)
const REALISTIC_USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.3 Safari/605.1.15',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:123.0) Gecko/20100101 Firefox/123.0',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
];

function getRandomUserAgent(): string {
  return REALISTIC_USER_AGENTS[Math.floor(Math.random() * REALISTIC_USER_AGENTS.length)];
}

/**
 * Fetch with Smartproxy or enhanced direct fetch (fallback)
 */
export async function fetchWithCloudflareBypass(
  url: string, 
  retries: number = 4
): Promise<{ url: string; headers: any; html: string }> {
  
  // Use Smartproxy if available
  const smartproxyUsername = process.env.SMARTPROXY_USERNAME;
  const smartproxyPassword = process.env.SMARTPROXY_PASSWORD;
  const smartproxyEndpoint = process.env.SMARTPROXY_ENDPOINT;
  
  if (smartproxyUsername && smartproxyPassword && smartproxyEndpoint) {
    return fetchWithSmartproxy(url, smartproxyUsername, smartproxyPassword, smartproxyEndpoint, retries);
  }
  
  // Fallback to enhanced direct fetch (no proxy)
  return fetchWithEnhancedHeaders(url, retries);
}

/**
 * Use Smartproxy residential proxies to bypass Cloudflare
 */
async function fetchWithSmartproxy(
  url: string,
  username: string,
  password: string,
  endpoint: string,
  retries: number
): Promise<{ url: string; headers: any; html: string }> {
  
  console.log(`  🔐 Using Smartproxy residential proxy...`);
  
  // Smartproxy endpoint format: gate.smartproxy.com:7000 (or 10000 for residential)
  // Build proxy URL: http://username:password@endpoint
  const proxyUrl = `http://${username}:${password}@${endpoint}`;
  
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      // Add small delay to avoid rate limits
      if (attempt > 0) {
        const delay = Math.pow(2, attempt) * 2000 + Math.random() * 1000;
        await new Promise(resolve => setTimeout(resolve, delay));
      }
      
      const userAgent = getRandomUserAgent();
      
      // Note: Most blocked sites use Playwright (which fully supports Smartproxy)
      // For HTTP requests via undici, we'll use environment variables for proxy
      // Set HTTP_PROXY and HTTPS_PROXY environment variables temporarily
      const originalHttpProxy = process.env.HTTP_PROXY;
      const originalHttpsProxy = process.env.HTTPS_PROXY;
      
      try {
        // Set proxy environment variables for undici
        process.env.HTTP_PROXY = proxyUrl;
        process.env.HTTPS_PROXY = proxyUrl;
        
        const targetUrl = new URL(url);
        
        // Use undici request (which respects HTTP_PROXY/HTTPS_PROXY env vars)
        const res = await request(url, {
          method: 'GET',
          headers: {
            'User-Agent': userAgent,
            ...BROWSER_HEADERS,
            'Referer': targetUrl.origin,
            'Origin': targetUrl.origin
          },
          maxRedirections: 5
        });
        
        if (res.statusCode >= 400) {
          if (attempt < retries) {
            const delay = Math.pow(2, attempt) * 3000 + Math.random() * 2000;
            console.warn(`  ⚠️  Smartproxy returned ${res.statusCode}, retrying in ${Math.round(delay/1000)}s...`);
            continue;
          }
          throw new Error(`Smartproxy error: ${res.statusCode}`);
        }
        
        const html = await res.body.text();
        
        // Check for Cloudflare challenge
        if (html.includes('cf-browser-verification') || 
            html.includes('Just a moment...') ||
            html.includes('Checking your browser')) {
          if (attempt < retries) {
            const delay = Math.pow(2, attempt + 2) * 5000;
            console.warn(`  🔒 Cloudflare challenge detected, retrying in ${Math.round(delay/1000)}s...`);
            continue;
          }
          throw new Error('Cloudflare challenge still present after Smartproxy');
        }
        
        console.log(`  ✅ Successfully fetched via Smartproxy (${html.length} chars)`);
        return { url: (res as any).url ?? url, headers: res.headers, html };
      } finally {
        // Restore original proxy settings
        if (originalHttpProxy !== undefined) {
          process.env.HTTP_PROXY = originalHttpProxy;
        } else {
          delete process.env.HTTP_PROXY;
        }
        if (originalHttpsProxy !== undefined) {
          process.env.HTTPS_PROXY = originalHttpsProxy;
        } else {
          delete process.env.HTTPS_PROXY;
        }
      }
      
    } catch (error) {
      if (attempt < retries) {
        const delay = Math.pow(2, attempt) * 3000 + Math.random() * 2000;
        console.warn(`  ⚠️  Smartproxy request failed, retrying in ${Math.round(delay/1000)}s...`);
        continue;
      }
      throw error;
    }
  }
  
  throw new Error('Smartproxy max retries exceeded');
}

/**
 * Enhanced direct fetch with better headers and retry logic
 */
async function fetchWithEnhancedHeaders(
  url: string, 
  retries: number
): Promise<{ url: string; headers: any; html: string }> {
  
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      // Random delay before request (more human-like)
      const preDelay = 2000 + Math.random() * 3000; // 2-5 seconds
      await new Promise(resolve => setTimeout(resolve, preDelay));
      
      const userAgent = getRandomUserAgent();
      
      console.log(`  🌐 Fetching with enhanced headers (attempt ${attempt + 1}/${retries + 1})...`);
      
      const res = await request(url, {
        method: 'GET',
        headers: {
          'User-Agent': userAgent,
          ...BROWSER_HEADERS,
          // Add referrer to look more legitimate
          'Referer': new URL(url).origin,
          // Some sites check origin
          'Origin': new URL(url).origin
        },
        maxRedirections: 5
      });
      
      // In test mode, skip 404s immediately to save time
      if (process.env.TEST_MODE === 'true' && res.statusCode === 404) {
        throw new Error(`HTTP 404`);
      }
      
      if (res.statusCode === 403) {
        if (attempt < retries) {
          // For 403, wait even longer with exponential backoff
          const delay = Math.pow(2, attempt + 2) * 10000 + Math.random() * 5000; // 40s, 80s, 160s...
          console.warn(`  🚫 403 Forbidden (Cloudflare?), waiting ${Math.round(delay/1000)}s before retry...`);
          await new Promise(resolve => setTimeout(resolve, delay));
          continue;
        }
        throw new Error(`403 Forbidden - Site is blocking scrapers. Consider using Smartproxy (SMARTPROXY_USERNAME, SMARTPROXY_PASSWORD, SMARTPROXY_ENDPOINT env variables).`);
      }
      
      if (res.statusCode === 429) {
        if (attempt < retries) {
          const delay = Math.pow(2, attempt + 3) * 15000 + Math.random() * 10000; // Long delays
          console.warn(`  ⏱️  Rate limited (429), waiting ${Math.round(delay/1000)}s...`);
          await new Promise(resolve => setTimeout(resolve, delay));
          continue;
        }
        throw new Error(`429 Too Many Requests`);
      }
      
      if (res.statusCode >= 400) {
        if (attempt < retries) {
          const delay = Math.pow(2, attempt) * 5000 + Math.random() * 3000;
          console.warn(`  ⚠️  HTTP ${res.statusCode}, retrying in ${Math.round(delay/1000)}s...`);
          await new Promise(resolve => setTimeout(resolve, delay));
          continue;
        }
        throw new Error(`HTTP ${res.statusCode}`);
      }
      
      const html = await res.body.text();
      
      // Check if we got a Cloudflare challenge page
      if (html.includes('cf-browser-verification') || 
          html.includes('Just a moment...') ||
          html.includes('Checking your browser')) {
        console.warn(`  🔒 Detected Cloudflare challenge page`);
        if (attempt < retries) {
          const delay = Math.pow(2, attempt + 3) * 10000; // Very long delays
          console.warn(`  ⏳ Cloudflare detected, waiting ${Math.round(delay/1000)}s before retry...`);
          await new Promise(resolve => setTimeout(resolve, delay));
          continue;
        }
        throw new Error(`Cloudflare challenge detected. Consider using Smartproxy (SMARTPROXY_USERNAME, SMARTPROXY_PASSWORD, SMARTPROXY_ENDPOINT env variables).`);
      }
      
      console.log(`  ✅ Successfully fetched (${html.length} chars)`);
      return { url: (res as any).url ?? url, headers: res.headers, html };
      
    } catch (error) {
      if (attempt < retries) {
        const delay = Math.pow(2, attempt) * 5000 + Math.random() * 3000;
        console.warn(`  ❌ Request failed: ${error instanceof Error ? error.message : String(error)}`);
        console.warn(`  🔄 Retrying in ${Math.round(delay/1000)}s...`);
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }
      throw error;
    }
  }
  
  throw new Error('Max retries exceeded');
}

/**
 * Check if Cloudflare bypass is available
 */
export function hasCloudflareBypass(): boolean {
  return !!(process.env.SMARTPROXY_USERNAME && process.env.SMARTPROXY_PASSWORD && process.env.SMARTPROXY_ENDPOINT);
}

/**
 * Get status message about Cloudflare bypass capability
 */
export function getBypassStatus(): string {
  if (process.env.SMARTPROXY_USERNAME && process.env.SMARTPROXY_PASSWORD && process.env.SMARTPROXY_ENDPOINT) {
    return '🔐 Smartproxy enabled (residential proxies - best for mass scraping)';
  } else {
    return '⚠️  No proxy service - using enhanced headers (limited Cloudflare bypass)';
  }
}

