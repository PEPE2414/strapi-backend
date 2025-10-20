import { request } from 'undici';
import { fetchWithCloudflareBypass } from './cloudflareBypass';

/**
 * Ultra-aggressive fetcher that tries every possible method to avoid 403 errors
 * This is the most comprehensive fetching strategy possible
 */
export async function ultraFetch(url: string): Promise<{ url: string; headers: any; html: string }> {
  console.log(`🚀 Ultra fetching: ${url}`);
  
  // Strategy 1: Try with different user agents and headers
  const strategies = [
    () => fetchWithRotatingUserAgent(url),
    () => fetchWithMobileUserAgent(url),
    () => fetchWithOldBrowser(url),
    () => fetchWithDifferentReferer(url),
    () => fetchWithMinimalHeaders(url),
    () => fetchWithMaximalHeaders(url),
    () => fetchWithDelayedRequest(url),
    () => fetchWithCloudflareBypass(url)
  ];
  
  for (let i = 0; i < strategies.length; i++) {
    try {
      console.log(`  🔄 Trying strategy ${i + 1}/${strategies.length}...`);
      const result = await strategies[i]();
      console.log(`  ✅ Strategy ${i + 1} successful: ${result.html.length} chars`);
      return result;
    } catch (error) {
      console.log(`  ⚠️  Strategy ${i + 1} failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  
  throw new Error(`All ultra fetch strategies failed for ${url}`);
}

/**
 * Fetch with rotating user agents
 */
async function fetchWithRotatingUserAgent(url: string): Promise<{ url: string; headers: any; html: string }> {
  const userAgents = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) Gecko/20100101 Firefox/121.0',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Safari/605.1.15',
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/118.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/118.0.0.0 Safari/537.36'
  ];
  
  const userAgent = userAgents[Math.floor(Math.random() * userAgents.length)];
  
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

/**
 * Fetch with old browser user agent
 */
async function fetchWithOldBrowser(url: string): Promise<{ url: string; headers: any; html: string }> {
  const headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 6.1; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/80.0.3987.149 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8',
    'Accept-Language': 'en-GB,en;q=0.9',
    'Accept-Encoding': 'gzip, deflate',
    'Connection': 'keep-alive',
    'Upgrade-Insecure-Requests': '1',
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
 * Fetch with different referer
 */
async function fetchWithDifferentReferer(url: string): Promise<{ url: string; headers: any; html: string }> {
  const referers = [
    'https://www.google.com/',
    'https://www.bing.com/',
    'https://duckduckgo.com/',
    'https://www.yahoo.com/',
    'https://www.ecosia.org/',
    'https://www.startpage.com/',
    'https://search.brave.com/',
    'https://www.baidu.com/',
    'https://yandex.com/',
    'https://www.searchencrypt.com/'
  ];
  
  const referer = referers[Math.floor(Math.random() * referers.length)];
  
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
    'Sec-Fetch-Site': 'cross-site',
    'Cache-Control': 'max-age=0',
    'Referer': referer,
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
 * Fetch with minimal headers
 */
async function fetchWithMinimalHeaders(url: string): Promise<{ url: string; headers: any; html: string }> {
  const headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
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
 * Fetch with maximal headers
 */
async function fetchWithMaximalHeaders(url: string): Promise<{ url: string; headers: any; html: string }> {
  const headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
    'Accept-Language': 'en-GB,en-US;q=0.9,en;q=0.8',
    'Accept-Encoding': 'gzip, deflate, br',
    'DNT': '1',
    'Connection': 'keep-alive',
    'Upgrade-Insecure-Requests': '1',
    'Sec-Fetch-Dest': 'document',
    'Sec-Fetch-Mode': 'navigate',
    'Sec-Fetch-Site': 'none',
    'Sec-Fetch-User': '?1',
    'Cache-Control': 'max-age=0',
    'Referer': 'https://www.google.com/',
    'Origin': 'https://www.google.com',
    'Sec-Ch-Ua': '"Not_A Brand";v="8", "Chromium";v="120", "Google Chrome";v="120"',
    'Sec-Ch-Ua-Mobile': '?0',
    'Sec-Ch-Ua-Platform': '"Windows"',
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
 * Fetch with delayed request
 */
async function fetchWithDelayedRequest(url: string): Promise<{ url: string; headers: any; html: string }> {
  // Add random delay
  await new Promise(resolve => setTimeout(resolve, Math.random() * 3000 + 1000));
  
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
