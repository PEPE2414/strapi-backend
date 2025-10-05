import { request } from 'undici';

// Rotate user agents to avoid detection
const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) Gecko/20100101 Firefox/121.0',
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
      
      // Implement timeout using Promise.race
      const requestPromise = request(url, {
        method: 'GET',
        headers: { 
          'user-agent': userAgent,
          'accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8',
          'accept-language': 'en-GB,en-US;q=0.9,en;q=0.8',
          'accept-encoding': 'gzip, deflate, br',
          'cache-control': 'no-cache',
          'pragma': 'no-cache',
          'sec-ch-ua': '"Not_A Brand";v="8", "Chromium";v="120", "Google Chrome";v="120"',
          'sec-ch-ua-mobile': '?0',
          'sec-ch-ua-platform': '"Windows"',
          'sec-fetch-dest': 'document',
          'sec-fetch-mode': 'navigate',
          'sec-fetch-site': 'none',
          'sec-fetch-user': '?1',
          'upgrade-insecure-requests': '1',
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
            // For 403 errors, wait longer and try different approach
            console.warn(`403 error for ${url}, attempt ${attempt + 1}/${retries + 1}, waiting ${(attempt + 1) * 10}s...`);
            await new Promise(resolve => setTimeout(resolve, (attempt + 1) * 10000 + Math.random() * 5000));
            continue;
          } else if (res.statusCode === 429) {
            // Rate limited, wait longer
            console.warn(`429 rate limited for ${url}, waiting ${(attempt + 1) * 15}s...`);
            await new Promise(resolve => setTimeout(resolve, (attempt + 1) * 15000 + Math.random() * 5000));
            continue;
          } else if (res.statusCode >= 500) {
            // Server error, retry with exponential backoff
            const delay = Math.pow(2, attempt) * 2000 + Math.random() * 2000;
            console.warn(`Server error ${res.statusCode} for ${url}, waiting ${delay}ms...`);
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
        // Exponential backoff with jitter: 2s, 4s, 8s
        const delay = Math.pow(2, attempt) * 1000 + Math.random() * 2000;
        console.warn(`Request failed for ${url}, attempt ${attempt + 1}/${retries + 1}, waiting ${delay}ms...`);
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
