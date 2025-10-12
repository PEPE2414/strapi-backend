import { request } from 'undici';

/**
 * Enhanced fetcher with Cloudflare bypass techniques
 * Supports ScraperAPI integration if API key is provided
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
 * Fetch with ScraperAPI if key is provided, otherwise use enhanced direct fetch
 */
export async function fetchWithCloudflareBypass(
  url: string, 
  retries: number = 4
): Promise<{ url: string; headers: any; html: string }> {
  
  // Check if ScraperAPI key is available
  const scraperApiKey = process.env.SCRAPER_API_KEY;
  
  if (scraperApiKey) {
    return fetchWithScraperAPI(url, scraperApiKey, retries);
  } else {
    return fetchWithEnhancedHeaders(url, retries);
  }
}

/**
 * Use ScraperAPI to bypass Cloudflare (if key is available)
 */
async function fetchWithScraperAPI(
  url: string, 
  apiKey: string, 
  retries: number
): Promise<{ url: string; headers: any; html: string }> {
  
  console.log(`  🔐 Using ScraperAPI to bypass Cloudflare...`);
  
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      // ScraperAPI URL format
      const scraperUrl = `http://api.scraperapi.com?api_key=${apiKey}&url=${encodeURIComponent(url)}&render=false`;
      
      const res = await request(scraperUrl, {
        method: 'GET',
        headers: {
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
        }
      });
      
      if (res.statusCode >= 400) {
        if (attempt < retries) {
          const delay = Math.pow(2, attempt) * 3000 + Math.random() * 2000;
          console.warn(`  ⚠️  ScraperAPI returned ${res.statusCode}, retrying in ${Math.round(delay/1000)}s...`);
          await new Promise(resolve => setTimeout(resolve, delay));
          continue;
        }
        throw new Error(`ScraperAPI error: ${res.statusCode}`);
      }
      
      const html = await res.body.text();
      console.log(`  ✅ Successfully fetched via ScraperAPI (${html.length} chars)`);
      
      return { url, headers: res.headers, html };
      
    } catch (error) {
      if (attempt < retries) {
        const delay = Math.pow(2, attempt) * 3000 + Math.random() * 2000;
        console.warn(`  ⚠️  ScraperAPI request failed, retrying in ${Math.round(delay/1000)}s...`);
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }
      throw error;
    }
  }
  
  throw new Error('ScraperAPI max retries exceeded');
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
      
      if (res.statusCode === 403) {
        if (attempt < retries) {
          // For 403, wait even longer with exponential backoff
          const delay = Math.pow(2, attempt + 2) * 10000 + Math.random() * 5000; // 40s, 80s, 160s...
          console.warn(`  🚫 403 Forbidden (Cloudflare?), waiting ${Math.round(delay/1000)}s before retry...`);
          await new Promise(resolve => setTimeout(resolve, delay));
          continue;
        }
        throw new Error(`403 Forbidden - Site is blocking scrapers. Consider using SCRAPER_API_KEY env variable.`);
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
        throw new Error(`Cloudflare challenge detected. Consider using SCRAPER_API_KEY env variable ($49/month).`);
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
  return !!process.env.SCRAPER_API_KEY;
}

/**
 * Get status message about Cloudflare bypass capability
 */
export function getBypassStatus(): string {
  if (hasCloudflareBypass()) {
    return '🔐 ScraperAPI enabled (Cloudflare bypass active)';
  } else {
    return '⚠️  No ScraperAPI key - using enhanced headers (limited Cloudflare bypass)';
  }
}

