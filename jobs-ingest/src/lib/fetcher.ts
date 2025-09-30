import { request } from 'undici';
export async function get(url: string, headers: Record<string,string> = {}, retries: number = 2): Promise<{url: string, headers: any, html: string}> {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await request(url, {
        method: 'GET',
        headers: { 
          'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
          'accept-language': 'en-GB,en;q=0.9',
          'accept-encoding': 'gzip, deflate, br',
          'dnt': '1',
          'connection': 'keep-alive',
          'upgrade-insecure-requests': '1',
          ...headers 
        },
        maxRedirections: 5
      });
      
      if (res.statusCode >= 400) {
        if (attempt < retries && res.statusCode === 403) {
          // Wait longer before retry for 403 errors
          await new Promise(resolve => setTimeout(resolve, 5000 + Math.random() * 5000));
          continue;
        }
        throw new Error(`GET ${url} -> ${res.statusCode}`);
      }
      
      const html = await res.body.text();
      return { url: (res as any).url ?? url, headers: res.headers, html };
    } catch (error) {
      if (attempt < retries) {
        // Exponential backoff: 2s, 4s, 8s
        const delay = Math.pow(2, attempt) * 1000 + Math.random() * 1000;
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
