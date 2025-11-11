import { request } from 'undici';
import * as cheerio from 'cheerio';

type SitemapResult = {
  listingUrls: string[];
  detailUrls: string[];
};

const sitemapCache: Map<string, SitemapResult> = new Map();

async function fetchText(url: string): Promise<string | null> {
  try {
    const res = await request(url, {
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'text/plain,application/xml,text/xml,*/*;q=0.8'
      },
      maxRedirections: 5
    });
    if (res.statusCode >= 400) {
      return null;
    }
    return await res.body.text();
  } catch (error) {
    console.warn(`  ⚠️  Failed to fetch ${url}:`, error instanceof Error ? error.message : String(error));
    return null;
  }
}

function unique(items: string[]): string[] {
  return [...new Set(items)];
}

function isLikelyListing(url: string): boolean {
  const lower = url.toLowerCase();
  return /search|jobs|intern|placement|graduate|vacanc|opportunit|scheme|programme/.test(lower);
}

function isLikelyDetail(url: string): boolean {
  const lower = url.toLowerCase();
  return /job|vacanc|role|position|opportunit/.test(lower) && !/sitemap|search|feed|rss/.test(lower);
}

async function parseSitemapXml(xml: string, baseUrl: string): Promise<string[]> {
  try {
    const $ = cheerio.load(xml, { xmlMode: true });
    const urls: string[] = [];
    $('url > loc').each((_, el) => {
      const loc = $(el).text().trim();
      if (loc) urls.push(loc);
    });
    $('sitemap > loc').each((_, el) => {
      const loc = $(el).text().trim();
      if (loc) urls.push(loc);
    });
    return urls.map(url => {
      try {
        return new URL(url, baseUrl).toString();
      } catch {
        return null;
      }
    }).filter((url): url is string => Boolean(url));
  } catch (error) {
    console.warn('  ⚠️  Failed to parse sitemap XML:', error instanceof Error ? error.message : String(error));
    return [];
  }
}

async function discoverFromRobots(baseUrl: string): Promise<string[]> {
  try {
    const robotsUrl = new URL('/robots.txt', baseUrl).toString();
    const robotsTxt = await fetchText(robotsUrl);
    if (!robotsTxt) return [];

    const lines = robotsTxt.split('\n');
    const sitemapLines = lines
      .map(line => line.trim())
      .filter(line => line.toLowerCase().startsWith('sitemap:'))
      .map(line => line.split(':', 2)[1]?.trim())
      .filter(Boolean) as string[];

    return sitemapLines.map(link => {
      try {
        return new URL(link, baseUrl).toString();
      } catch {
        return null;
      }
    }).filter((url): url is string => Boolean(url));
  } catch (error) {
    console.warn('  ⚠️  Failed to read robots.txt:', error instanceof Error ? error.message : String(error));
    return [];
  }
}

export async function discoverSitemaps(boardKey: string, baseUrl?: string): Promise<SitemapResult> {
  if (!baseUrl) {
    return { listingUrls: [], detailUrls: [] };
  }

  const cacheKey = `${boardKey}:${baseUrl}`;
  const cached = sitemapCache.get(cacheKey);
  if (cached) {
    return cached;
  }

  const visited = new Set<string>();
  const sitemapQueue: string[] = [];
  const listingCandidates: string[] = [];
  const detailCandidates: string[] = [];
  const MAX_SITEMAPS = 15;
  const MAX_URLS_PER_SITEMAP = 200;

  const primarySitemaps = await discoverFromRobots(baseUrl);
  primarySitemaps.forEach(url => sitemapQueue.push(url));

  // Fallback: common sitemap locations
  if (sitemapQueue.length === 0) {
    ['/sitemap.xml', '/sitemap_index.xml', '/sitemap/sitemap.xml'].forEach(path => {
      sitemapQueue.push(new URL(path, baseUrl).toString());
    });
  }

  while (sitemapQueue.length > 0 && visited.size < MAX_SITEMAPS) {
    const sitemapUrl = sitemapQueue.shift()!;
    if (visited.has(sitemapUrl)) continue;
    visited.add(sitemapUrl);

    const xml = await fetchText(sitemapUrl);
    if (!xml || xml.length < 100) continue;

    const urls = await parseSitemapXml(xml, baseUrl);
    if (urls.length === 0) continue;

    const sitemapUrls = urls.filter(url => url.toLowerCase().includes('sitemap'));
    sitemapUrls.forEach(url => {
      if (!visited.has(url) && sitemapQueue.length < MAX_SITEMAPS) {
        sitemapQueue.push(url);
      }
    });

    const candidates = urls
      .filter(url => !url.toLowerCase().includes('sitemap'))
      .slice(0, MAX_URLS_PER_SITEMAP);

    for (const candidate of candidates) {
      if (isLikelyListing(candidate)) {
        listingCandidates.push(candidate);
      }
      if (isLikelyDetail(candidate)) {
        detailCandidates.push(candidate);
      }
    }
  }

  const result: SitemapResult = {
    listingUrls: unique(listingCandidates).slice(0, 200),
    detailUrls: unique(detailCandidates).slice(0, 400)
  };

  sitemapCache.set(cacheKey, result);
  return result;
}


