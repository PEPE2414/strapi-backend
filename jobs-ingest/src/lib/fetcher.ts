import { request } from 'undici';

// Rotate user agents to avoid detection - updated with more realistic ones
const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Safari/605.1.15',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:122.0) Gecko/20100101 Firefox/122.0',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.1 Safari/605.1.15'
];

function getRandomUserAgent(): string {
  return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
}

export async function get(url: string, headers: Record<string,string> = {}, retries: number = 3): Promise<{url: string, headers: any, html: string}> {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      // Use different user agent for each attempt
      const userAgent = getRandomUserAgent();
      
      // Add random delay before request to mimic human behavior
      const randomDelay = Math.random() * 2000 + 1000; // 1-3 seconds
      await new Promise(resolve => setTimeout(resolve, randomDelay));
      
      // Implement timeout using Promise.race
      const requestPromise = request(url, {
        method: 'GET',
        headers: { 
          'user-agent': userAgent,
          'accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
          'accept-language': 'en-GB,en;q=0.9,en-US;q=0.8',
          'accept-encoding': 'gzip, deflate, br, zstd',
          'cache-control': 'max-age=0',
          'sec-ch-ua': '"Not_A Brand";v="8", "Chromium";v="120", "Google Chrome";v="120"',
          'sec-ch-ua-mobile': '?0',
          'sec-ch-ua-platform': '"Windows"',
          'sec-fetch-dest': 'document',
          'sec-fetch-mode': 'navigate',
          'sec-fetch-site': 'none',
          'sec-fetch-user': '?1',
          'upgrade-insecure-requests': '1',
          'dnt': '1',
          'connection': 'keep-alive',
          ...headers 
        },
        maxRedirections: 5
      });
      
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('Request timeout')), 30000); // 30 second timeout
      });
      
      const res = await Promise.race([requestPromise, timeoutPromise]);
      
      if (res.statusCode >= 400) {
        if (attempt < retries) {
          if (res.statusCode === 403) {
            // For 403 errors, wait much longer and be more conservative
            const delay = (attempt + 1) * 30000 + Math.random() * 15000; // 30-45s, 60-75s, 90-105s
            console.warn(`403 error for ${url}, attempt ${attempt + 1}/${retries + 1}, waiting ${Math.round(delay/1000)}s...`);
            await new Promise(resolve => setTimeout(resolve, delay));
            continue;
          } else if (res.statusCode === 429) {
            // Rate limited, wait much longer
            const delay = (attempt + 1) * 60000 + Math.random() * 30000; // 1-1.5min, 2-2.5min, 3-3.5min
            console.warn(`429 rate limited for ${url}, waiting ${Math.round(delay/1000)}s...`);
            await new Promise(resolve => setTimeout(resolve, delay));
            continue;
          } else if (res.statusCode >= 500) {
            // Server error, retry with exponential backoff
            const delay = Math.pow(2, attempt) * 5000 + Math.random() * 5000;
            console.warn(`Server error ${res.statusCode} for ${url}, waiting ${Math.round(delay/1000)}s...`);
            await new Promise(resolve => setTimeout(resolve, delay));
            continue;
          }
        }
        throw new Error(`GET ${url} -> ${res.statusCode}`);
      }
      
      const html = await res.body.text();
      return { url: (res as any).url ?? url, headers: res.headers, html };
    } catch (error) {
      if (attempt < retries) {
        // More conservative exponential backoff with jitter: 5s, 10s, 20s
        const delay = Math.pow(2, attempt) * 5000 + Math.random() * 5000;
        console.warn(`Request failed for ${url}, attempt ${attempt + 1}/${retries + 1}, waiting ${Math.round(delay/1000)}s...`);
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }
      throw error;
    }
  }
  throw new Error('Max retries exceeded');
}
export async function headResolve(url: string) {
  try {
    const res = await request(url, { method: 'HEAD', maxRedirections: 5 });
    return (res as any).url ?? url;
  } catch { return url; }
}
