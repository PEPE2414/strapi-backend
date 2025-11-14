import { request } from 'undici';
import { fetchWithCloudflareBypass } from './cloudflareBypass';

/**
 * Efficient fetcher that tries the most likely to work strategies first
 * Reduces runtime by avoiding unnecessary attempts
 */
export async function efficientFetch(url: string): Promise<{ url: string; headers: any; html: string }> {
  console.log(`⚡ Efficient fetching: ${url}`);
  
  // Strategy 1: Try direct fetch with realistic headers (most likely to work)
  try {
    console.log(`  📡 Trying direct fetch...`);
    const result = await fetchDirectWithHeaders(url);
    console.log(`  ✅ Direct fetch successful: ${result.html.length} chars`);
    return result;
  } catch (error) {
    console.log(`  ⚠️  Direct fetch failed: ${error instanceof Error ? error.message : String(error)}`);
  }
  
  // Strategy 2: Try Smartproxy (if available, only if direct fails)
  try {
    console.log(`  🔐 Trying Smartproxy...`);
    const result = await fetchWithCloudflareBypass(url);
    console.log(`  ✅ Smartproxy successful: ${result.html.length} chars`);
    return result;
  } catch (error) {
    console.log(`  ⚠️  Smartproxy failed: ${error instanceof Error ? error.message : String(error)}`);
  }
  
  // Strategy 3: Try with mobile user agent (often works when desktop fails)
  try {
    console.log(`  📱 Trying mobile user agent...`);
    const result = await fetchWithMobileUserAgent(url);
    console.log(`  ✅ Mobile fetch successful: ${result.html.length} chars`);
    return result;
  } catch (error) {
    console.log(`  ⚠️  Mobile fetch failed: ${error instanceof Error ? error.message : String(error)}`);
  }
  
  throw new Error(`All efficient fetch strategies failed for ${url}`);
}

/**
 * Direct fetch with realistic headers
 */
async function fetchDirectWithHeaders(url: string): Promise<{ url: string; headers: any; html: string }> {
  const headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
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
 * Fetch with mobile user agent
 */
async function fetchWithMobileUserAgent(url: string): Promise<{ url: string; headers: any; html: string }> {
  const headers = {
    'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Mobile/15E148 Safari/604.1',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Language': 'en-GB,en;q=0.9',
    'Accept-Encoding': 'gzip, deflate, br',
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
