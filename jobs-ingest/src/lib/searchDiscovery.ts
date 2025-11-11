type SearchDiscoveryOptions = {
  domain: string;
  queries: string[];
  maxResults?: number;
};

type SearchResult = {
  url: string;
  title?: string;
};

const searchCache: Map<string, SearchResult[]> = new Map();

function uniqueUrls(results: SearchResult[], limit: number): SearchResult[] {
  const seen = new Set<string>();
  const out: SearchResult[] = [];
  for (const result of results) {
    const key = result.url.split('#')[0];
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(result);
    if (out.length >= limit) break;
  }
  return out;
}

async function useSerpApi(query: string): Promise<SearchResult[]> {
  const apiKey = process.env.SERP_API_KEY;
  if (!apiKey) return [];

  const endpoint = new URL('https://serpapi.com/search.json');
  endpoint.searchParams.set('q', query);
  endpoint.searchParams.set('engine', 'google');
  endpoint.searchParams.set('num', '20');

  const response = await fetch(endpoint, {
    headers: { 'Accept': 'application/json' }
  });
  if (!response.ok) {
    console.warn(`  ⚠️  SerpAPI request failed (${response.status})`);
    return [];
  }

  const data = await response.json() as any;
  const organic = Array.isArray(data.organic_results) ? data.organic_results : [];
  return organic
    .map((item: any) => ({
      url: String(item.link || ''),
      title: item.title
    }))
    .filter((item: SearchResult) => item.url.startsWith('http'));
}

async function useSerper(query: string): Promise<SearchResult[]> {
  const apiKey = process.env.SERPER_API_KEY;
  if (!apiKey) return [];

  const response = await fetch('https://google.serper.dev/search', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-API-KEY': apiKey
    },
    body: JSON.stringify({ q: query, num: 20 })
  });

  if (!response.ok) {
    console.warn(`  ⚠️  Serper.dev request failed (${response.status})`);
    return [];
  }

  const data = await response.json() as any;
  const organic = Array.isArray(data.organic) ? data.organic : [];
  return organic
    .map((item: any) => ({
      url: String(item.link || ''),
      title: item.title
    }))
    .filter((item: SearchResult) => item.url.startsWith('http'));
}

export async function discoverWithSearchAPI(options: SearchDiscoveryOptions): Promise<SearchResult[]> {
  const { domain, queries, maxResults = 30 } = options;
  const cacheKey = `${domain}:${maxResults}`;
  const cached = searchCache.get(cacheKey);
  if (cached) {
    return cached;
  }

  const allResults: SearchResult[] = [];

  for (const query of queries) {
    const siteQuery = `site:${domain} ${query}`;
    let results: SearchResult[] = [];

    try {
      results = await useSerpApi(siteQuery);
    } catch (error) {
      console.warn('  ⚠️  SerpAPI discovery error:', error instanceof Error ? error.message : String(error));
    }

    if (results.length === 0) {
      try {
        results = await useSerper(siteQuery);
      } catch (error) {
        console.warn('  ⚠️  Serper.dev discovery error:', error instanceof Error ? error.message : String(error));
      }
    }

    if (results.length === 0) continue;
    allResults.push(...results);
  }

  const unique = uniqueUrls(allResults, maxResults);
  searchCache.set(cacheKey, unique);
  return unique;
}


