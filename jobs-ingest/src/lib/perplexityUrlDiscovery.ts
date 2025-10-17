import { request } from 'undici';

/**
 * Use Perplexity API to discover current working URLs for graduate job boards
 * This is a fallback when the standard URL discovery fails
 */
export async function discoverUrlsWithPerplexity(boardName: string): Promise<string[]> {
  const PERPLEXITY_API_KEY = process.env.PERPLEXITY_API_KEY;
  
  if (!PERPLEXITY_API_KEY) {
    console.log(`⚠️  PERPLEXITY_API_KEY not set, skipping Perplexity discovery for ${boardName}`);
    return [];
  }

  try {
    console.log(`🤖 Using Perplexity to discover URLs for ${boardName}...`);
    
    const query = `What are the current working job search URLs for ${boardName} graduate job board in 2024? Please provide the exact URLs for searching graduate jobs, internships, and placements.`;
    
    const response = await request('https://api.perplexity.ai/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${PERPLEXITY_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'llama-3.1-sonar-small-128k-online',
        messages: [
          {
            role: 'user',
            content: query
          }
        ],
        max_tokens: 1000,
        temperature: 0.1
      })
    });

    const data = await response.body.json() as any;
    const content = data.choices?.[0]?.message?.content || '';
    
    console.log(`📋 Perplexity response: ${content.substring(0, 200)}...`);
    
    // Extract URLs from the response
    const urlRegex = /https?:\/\/[^\s\)]+/g;
    const urls = content.match(urlRegex) || [];
    
    // Filter for the specific board domain
    const boardDomains = {
      'gradcracker': ['gradcracker.com'],
      'targetjobs': ['targetjobs.co.uk'],
      'prospects': ['prospects.ac.uk'],
      'milkround': ['milkround.com'],
      'brightnetwork': ['brightnetwork.co.uk'],
      'ratemyplacement': ['ratemyplacement.co.uk']
    };
    
    const domain = boardDomains[boardName as keyof typeof boardDomains];
    if (!domain) return [];
    
    const filteredUrls = urls.filter((url: string) => 
      domain.some(d => url.includes(d))
    );
    
    console.log(`✅ Found ${filteredUrls.length} URLs for ${boardName}:`, filteredUrls);
    
    // Test the URLs to make sure they actually work
    if (filteredUrls.length > 0) {
      const { findBestUrls } = await import('./directUrlTester');
      const workingUrls = await findBestUrls(filteredUrls);
      console.log(`✅ After testing: ${workingUrls.length} URLs actually work`);
      return workingUrls;
    }
    
    return filteredUrls;
    
  } catch (error) {
    console.warn(`❌ Perplexity discovery failed for ${boardName}:`, error instanceof Error ? error.message : String(error));
    return [];
  }
}

/**
 * Get working URLs using multiple discovery methods
 */
export async function getWorkingUrlsMultiMethod(
  boardName: string,
  knownPatterns: string[],
  baseUrl?: string
): Promise<string[]> {
  console.log(`\n🔍 Multi-method URL discovery for ${boardName}...`);
  
  // Method 1: Try known patterns first
  const { getWorkingUrls } = await import('./urlDiscovery');
  let urls = await getWorkingUrls(boardName, knownPatterns, baseUrl, 0); // No cache
  
  if (urls.length > 0) {
    console.log(`✅ Standard discovery found ${urls.length} URLs for ${boardName}`);
    return urls;
  }
  
  // Method 2: Try Perplexity API
  console.log(`⚠️  Standard discovery failed, trying Perplexity...`);
  const perplexityUrls = await discoverUrlsWithPerplexity(boardName);
  
  if (perplexityUrls.length > 0) {
    console.log(`✅ Perplexity found ${perplexityUrls.length} URLs for ${boardName}`);
    return perplexityUrls;
  }
  
  // Method 3: Try fallback URLs
  console.log(`⚠️  Perplexity failed, trying fallback URLs...`);
  const { getFallbackUrls } = await import('./fallbackUrls');
  const fallbackUrls = getFallbackUrls(boardName);
  
  if (fallbackUrls.length > 0) {
    console.log(`🔄 Testing ${fallbackUrls.length} fallback URLs...`);
    const { findBestUrls } = await import('./directUrlTester');
    const workingFallbackUrls = await findBestUrls(fallbackUrls);
    
    if (workingFallbackUrls.length > 0) {
      console.log(`✅ Fallback URLs found ${workingFallbackUrls.length} working URLs for ${boardName}`);
      return workingFallbackUrls;
    }
  }
  
  // Method 4: Try base URL as absolute last resort
  if (baseUrl) {
    console.log(`⚠️  All methods failed, trying base URL: ${baseUrl}`);
    try {
      const { fetchWithCloudflareBypass } = await import('./cloudflareBypass');
      const { html } = await fetchWithCloudflareBypass(baseUrl);
      if (html.length > 1000) {
        console.log(`✅ Base URL works: ${baseUrl}`);
        return [baseUrl];
      }
    } catch (error) {
      console.log(`❌ Base URL failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  
  console.log(`❌ All discovery methods failed for ${boardName}`);
  return [];
}
