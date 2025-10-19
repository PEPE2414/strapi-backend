import { request } from 'undici';
import { fetchWithCloudflareBypass } from './cloudflareBypass';

/**
 * Smart fetcher that tries multiple strategies to avoid 403 errors
 * 1. Direct fetch with realistic headers
 * 2. ScraperAPI as fallback
 * 3. Multiple user agents and headers
 */
export async function smartFetch(url: string, retries: number = 3): Promise<{ url: string; headers: any; html: string }> {
  console.log(`🔍 Smart fetching: ${url}`);
  
  // Strategy 1: Try direct fetch with realistic headers first
  try {
    console.log(`  📡 Trying direct fetch...`);
    const result = await fetchDirectWithHeaders(url);
    console.log(`  ✅ Direct fetch successful: ${result.html.length} chars`);
    return result;
  } catch (error) {
    console.log(`  ⚠️  Direct fetch failed: ${error instanceof Error ? error.message : String(error)}`);
  }
  
  // Strategy 2: Try ScraperAPI as fallback
  try {
    console.log(`  🔐 Trying ScraperAPI...`);
    const result = await fetchWithCloudflareBypass(url);
    console.log(`  ✅ ScraperAPI successful: ${result.html.length} chars`);
    return result;
  } catch (error) {
    console.log(`  ⚠️  ScraperAPI failed: ${error instanceof Error ? error.message : String(error)}`);
  }
  
  // Strategy 3: Try with different user agents
  for (let i = 0; i < retries; i++) {
    try {
      console.log(`  🔄 Trying with different headers (attempt ${i + 1}/${retries})...`);
      const result = await fetchWithRotatedHeaders(url, i);
      console.log(`  ✅ Rotated headers successful: ${result.html.length} chars`);
      return result;
    } catch (error) {
      console.log(`  ⚠️  Rotated headers failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  
  throw new Error(`All fetch strategies failed for ${url}`);
}

/**
 * Direct fetch with realistic headers
 */
async function fetchDirectWithHeaders(url: string): Promise<{ url: string; headers: any; html: string }> {
  const userAgent = getRandomUserAgent();
  const headers = {
    'User-Agent': userAgent,
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
    'Accept-Language': 'en-GB,en;q=0.9',
    'Accept-Encoding': 'gzip, deflate, br',
    'DNT': '1',
    'Connection': 'keep-alive',
    'Upgrade-Insecure-Requests': '1',
    'Sec-Fetch-Dest': 'document',
    'Sec-Fetch-Mode': 'navigate',
    'Sec-Fetch-Site': 'none',
    'Cache-Control': 'max-age=0',
    'Referer': 'https://www.google.com/',
  };
  
  const response = await request(url, {
    method: 'GET',
    headers,
  });
  
  if (response.statusCode !== 200) {
    throw new Error(`HTTP ${response.statusCode}: ${response.statusCode < 400 ? 'OK' : 'Error'}`);
  }
  
  const html = await response.body.text();
  return { url, headers, html };
}

/**
 * Fetch with rotated headers and user agents
 */
async function fetchWithRotatedHeaders(url: string, attempt: number): Promise<{ url: string; headers: any; html: string }> {
  const userAgents = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) Gecko/20100101 Firefox/121.0',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Safari/605.1.15',
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
  ];
  
  const referers = [
    'https://www.google.com/',
    'https://www.bing.com/',
    'https://duckduckgo.com/',
    'https://www.yahoo.com/',
    'https://www.ecosia.org/'
  ];
  
  const userAgent = userAgents[attempt % userAgents.length];
  const referer = referers[attempt % referers.length];
  
  const headers = {
    'User-Agent': userAgent,
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
    'Accept-Language': 'en-GB,en;q=0.9',
    'Accept-Encoding': 'gzip, deflate, br',
    'DNT': '1',
    'Connection': 'keep-alive',
    'Upgrade-Insecure-Requests': '1',
    'Sec-Fetch-Dest': 'document',
    'Sec-Fetch-Mode': 'navigate',
    'Sec-Fetch-Site': 'cross-site',
    'Cache-Control': 'max-age=0',
    'Referer': referer,
  };
  
  // Add delay between attempts
  if (attempt > 0) {
    await new Promise(resolve => setTimeout(resolve, 2000 * attempt));
  }
  
  const response = await request(url, {
    method: 'GET',
    headers,
  });
  
  if (response.statusCode !== 200) {
    throw new Error(`HTTP ${response.statusCode}: ${response.statusCode < 400 ? 'OK' : 'Error'}`);
  }
  
  const html = await response.body.text();
  return { url, headers, html };
}

/**
 * Get a random realistic user agent
 */
function getRandomUserAgent(): string {
  const userAgents = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) Gecko/20100101 Firefox/121.0',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Safari/605.1.15',
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36'
  ];
  
  return userAgents[Math.floor(Math.random() * userAgents.length)];
}
