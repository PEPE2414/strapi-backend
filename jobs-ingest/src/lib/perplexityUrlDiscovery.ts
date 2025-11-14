import { fetchWithCloudflareBypass } from './cloudflareBypass';
import { smartFetch } from './smartFetcher';

/**
 * Comprehensive Perplexity-based URL discovery for all sources
 * Uses AI to find current working URLs for job boards, ATS platforms, feeds, etc.
 */

// Cache to avoid repeated Perplexity queries (24 hour TTL)
const perplexityCache: Map<string, { urls: string[]; timestamp: number }> = new Map();
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

/**
 * Main entry point for Perplexity URL discovery
 */
export async function discoverUrlsWithPerplexity(
  sourceType: string, 
  sourceKey: string,
  sourceName?: string
): Promise<string[]> {
  // Check cache first
  const cacheKey = `${sourceType}:${sourceKey}`;
  const cached = perplexityCache.get(cacheKey);
  if (cached && (Date.now() - cached.timestamp) < CACHE_TTL_MS) {
    console.log(`📦 Using cached Perplexity results for ${sourceKey} (${cached.urls.length} URLs)`);
    return cached.urls;
  }

  const queries = getPerplexityQueries(sourceType, sourceKey, sourceName);
  if (queries.length === 0) {
    return [];
  }

  const discoveredUrls: string[] = [];
  
  for (const query of queries) {
    try {
      console.log(`🤖 Perplexity discovery for ${sourceKey}: ${query}`);
      const urls = await queryPerplexityForUrls(query, sourceKey);
      discoveredUrls.push(...urls);
      
      // Add delay between queries to respect rate limits
      await new Promise(resolve => setTimeout(resolve, 2000));
    } catch (error) {
      console.warn(`⚠️  Perplexity query failed for ${sourceKey}:`, error instanceof Error ? error.message : String(error));
    }
  }
  
  // Deduplicate URLs
  const uniqueUrls = [...new Set(discoveredUrls)];
  
  // Test discovered URLs and return working ones
  const workingUrls = await testDiscoveredUrls(uniqueUrls, sourceKey);
  
  // Cache results
  if (workingUrls.length > 0) {
    perplexityCache.set(cacheKey, { urls: workingUrls, timestamp: Date.now() });
  }
  
  console.log(`✅ Perplexity discovery found ${workingUrls.length} working URLs for ${sourceKey}`);
  
  return workingUrls;
}

/**
 * Get comprehensive Perplexity queries for all source types
 */
function getPerplexityQueries(sourceType: string, sourceKey: string, sourceName?: string): string[] {
  const name = sourceName || sourceKey;
  
  // Graduate Job Boards
  if (['gradcracker', 'targetjobs', 'prospects', 'milkround', 'brightnetwork', 'ratemyplacement', 'trackr'].includes(sourceKey)) {
    return [
      `What is the current working URL for searching graduate jobs on ${name}? Provide the exact URL.`,
      `What is the current working URL for searching internships on ${name}? Provide the exact URL.`,
      `What is the current working URL for searching placements on ${name}? Provide the exact URL.`,
      `What is the current working URL for searching graduate schemes on ${name}? Provide the exact URL.`,
      `What is the current job search page URL on ${name}? Provide the exact URL.`
    ];
  }
  
  // ATS Platforms - Greenhouse
  if (sourceType === 'greenhouse' || sourceKey.startsWith('greenhouse:')) {
    const company = sourceKey.replace('greenhouse:', '') || sourceKey;
    return [
      `What is the current Greenhouse job board URL for ${company}? Format: boards.greenhouse.io/{company}/embed/job_board`,
      `What is the working Greenhouse careers page URL for ${company}?`,
      `What is the current Greenhouse API endpoint for ${company} jobs?`
    ];
  }
  
  // ATS Platforms - Lever
  if (sourceType === 'lever' || sourceKey.startsWith('lever:')) {
    const company = sourceKey.replace('lever:', '') || sourceKey;
    return [
      `What is the current Lever API endpoint for ${company}? Format: api.lever.co/v0/postings/{company}`,
      `What is the working Lever careers page URL for ${company}?`
    ];
  }
  
  // ATS Platforms - Workable
  if (sourceType === 'workable' || sourceKey.startsWith('workable:')) {
    const company = sourceKey.replace('workable:', '') || sourceKey;
    return [
      `What is the current Workable API endpoint for ${company}? Format: {company}.workable.com/api/v3/jobs`,
      `What is the working Workable careers page URL for ${company}?`
    ];
  }
  
  // ATS Platforms - Ashby
  if (sourceType === 'ashby' || sourceKey.startsWith('ashby:')) {
    const company = sourceKey.replace('ashby:', '') || sourceKey;
    return [
      `What is the current Ashby job board API endpoint for ${company}? Format: jobs.ashbyhq.com/api/non_authenticated/job_board?organization_slug={company}`,
      `What is the working Ashby careers page URL for ${company}?`
    ];
  }
  
  // ATS Platforms - Teamtailor
  if (sourceType === 'teamtailor' || sourceKey.startsWith('teamtailor:')) {
    const company = sourceKey.replace('teamtailor:', '') || sourceKey;
    return [
      `What is the current Teamtailor API endpoint for ${company}? Format: api.teamtailor.com/v1/jobs?host={company}.teamtailor.com`,
      `What is the working Teamtailor careers page URL for ${company}?`
    ];
  }
  
  // RSS Feeds
  if (sourceType === 'rss' || sourceKey === 'rss-feeds') {
    return [
      `What are the current RSS feed URLs for UK graduate job boards? Provide exact feed URLs.`,
      `What are the current RSS feed URLs for UK university career services? Provide exact feed URLs.`,
      `What are the current Atom feed URLs for UK job boards? Provide exact feed URLs.`
    ];
  }
  
  // Sitemaps
  if (sourceType === 'sitemap' || sourceKey === 'bulk-sitemaps') {
    return [
      `What are the current sitemap.xml URLs for major UK job boards? Provide exact sitemap URLs.`,
      `What are the current sitemap URLs for UK graduate job boards? Provide exact sitemap URLs.`
    ];
  }
  
  // TargetConnect Feeds
  if (sourceType === 'targetconnect' || sourceKey.includes('targetconnect')) {
    return [
      `What are the current TargetConnect API feed URLs for UK universities? Format: {university}.targetconnect.net/api/jobs/public-feed`,
      `What is the current TargetConnect API endpoint format for university job feeds?`
    ];
  }
  
  // JobTeaser Feeds
  if (sourceType === 'jobteaser' || sourceKey.includes('jobteaser')) {
    return [
      `What are the current JobTeaser API feed URLs for UK universities? Format: {university}.jobteaser.com/api/v1/jobs`,
      `What is the current JobTeaser API endpoint format for university job feeds?`
    ];
  }
  
  // Generic job board discovery
  if (sourceType === 'job-board' || sourceType === 'generic') {
    return [
      `What is the current working URL for searching jobs on ${name}? Provide the exact URL.`,
      `What is the current job search page URL on ${name}? Provide the exact URL.`,
      `What is the current careers page URL for ${name}? Provide the exact URL.`
    ];
  }
  
  return [];
}

/**
 * Query Perplexity for URLs with improved error handling and rate limiting
 */
async function queryPerplexityForUrls(query: string, sourceKey: string): Promise<string[]> {
  const PERPLEXITY_API_KEY = process.env.PERPLEXITY_API_KEY;
  
  if (!PERPLEXITY_API_KEY) {
    console.warn('⚠️  PERPLEXITY_API_KEY not found, skipping Perplexity discovery');
    return [];
  }
  
  // Try multiple model names as fallback (Perplexity model names may vary)
  const modelsToTry = [
    'sonar', // Simple model name
    'sonar-small-online', // Online variant
    'llama-3.1-sonar-small-128k', // Full model name without -online
    'llama-3.1-sonar-large-128k-online' // Alternative model
  ];
  
  for (let i = 0; i < modelsToTry.length; i++) {
    const model = modelsToTry[i];
    try {
      const response = await fetch('https://api.perplexity.ai/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${PERPLEXITY_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: model,
          messages: [
            {
              role: 'user',
              content: `${query} Please provide the exact URLs that are currently working in 2024. Include full URLs with https:// protocol.`
            }
          ],
          max_tokens: 1000, // Increased for more URLs
          temperature: 0.1,
        }),
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        // If it's a model error and not the last model, try next model
        if (errorText.includes('Invalid model') && i < modelsToTry.length - 1) {
          continue; // Try next model
        }
        throw new Error(`Perplexity API error: ${response.status} - ${errorText.substring(0, 200)}`);
      }
      
      const data = await response.json() as any;
      const content = data.choices?.[0]?.message?.content || '';
      
      // Extract URLs from the response
      const urls = extractUrlsFromText(content, sourceKey);
      if (urls.length > 0) {
        console.log(`🔍 Perplexity found ${urls.length} URLs for ${sourceKey} (using model: ${model})`);
      }
      
      return urls;
    } catch (error) {
      // If it's the last model, log the error; otherwise continue to next model
      if (i === modelsToTry.length - 1) {
        console.warn(`⚠️  Perplexity API error for ${sourceKey} (tried all models):`, error instanceof Error ? error.message : String(error));
        return [];
      }
      // Continue to next model silently
    }
  }
  
  return [];
}

/**
 * Extract URLs from text with comprehensive domain matching
 */
function extractUrlsFromText(text: string, sourceKey: string): string[] {
  const urlRegex = /https?:\/\/[^\s<>"{}|\\^`\[\]()]+/g;
  const urls = text.match(urlRegex) || [];
  
  // Normalize URLs (remove trailing punctuation, decode entities, remove ** suffix)
  const normalizedUrls = urls.map(url => {
    // Remove trailing punctuation that might have been captured
    let clean = url.replace(/[.,;:!?)\]}>]+$/, '');
    // Remove ** suffix (common in Perplexity responses)
    clean = clean.replace(/\*\*+$/, '');
    // Remove common URL fragments
    clean = clean.split('#')[0].split('?')[0];
    return clean;
  }).filter(url => url.length > 10); // Filter out obviously invalid URLs
  
  // Domain patterns for different source types
  const domainPatterns: { [key: string]: RegExp[] } = {
    gradcracker: [/gradcracker\.com/i],
    targetjobs: [/targetjobs\.co\.uk/i],
    prospects: [/prospects\.ac\.uk/i],
    milkround: [/milkround\.com/i],
    brightnetwork: [/brightnetwork\.co\.uk/i],
    ratemyplacement: [/ratemyplacement|higherin\.com/i],
    trackr: [/trackr\.com/i],
    greenhouse: [/greenhouse\.io/i, /boards\.greenhouse\.io/i],
    lever: [/lever\.co/i, /api\.lever\.co/i],
    workable: [/workable\.com/i],
    ashby: [/ashbyhq\.com/i, /jobs\.ashbyhq\.com/i],
    teamtailor: [/teamtailor\.com/i, /api\.teamtailor\.com/i],
    targetconnect: [/targetconnect\.net/i],
    jobteaser: [/jobteaser\.com/i],
    rss: [/\/feed/i, /\/rss/i, /\.xml$/i, /atom/i],
    sitemap: [/sitemap/i, /\.xml$/i]
  };
  
  // Get relevant patterns for this source
  const patterns: RegExp[] = [];
  for (const [key, keyPatterns] of Object.entries(domainPatterns)) {
    if (sourceKey.toLowerCase().includes(key) || key.includes(sourceKey.toLowerCase())) {
      patterns.push(...keyPatterns);
    }
  }
  
  // If no specific patterns, accept all valid URLs
  if (patterns.length === 0) {
    return normalizedUrls.filter(url => {
      try {
        new URL(url);
        return true;
      } catch {
        return false;
      }
    });
  }
  
  // Filter URLs matching patterns
  return normalizedUrls.filter((url: string) => {
    try {
      new URL(url); // Validate URL format
      return patterns.some(pattern => pattern.test(url));
    } catch {
      return false;
    }
  });
}

/**
 * Test discovered URLs to see which ones work (with improved validation)
 */
async function testDiscoveredUrls(urls: string[], sourceKey: string): Promise<string[]> {
  const workingUrls: string[] = [];
  
  // In test mode, skip URL testing and just validate URL format
  const isTest = process.env.TEST_MODE === 'true' || process.env.INGEST_MODE === 'focused-test';
  if (isTest) {
    console.log(`🧪 TEST MODE: Skipping URL testing, validating format only`);
    // Just validate URL format and basic patterns
    for (const url of urls.slice(0, 5)) {
      try {
        const urlObj = new URL(url);
        // Basic validation - check if URL looks reasonable
        if (urlObj.protocol === 'https:' && urlObj.hostname.length > 0) {
          workingUrls.push(url);
          console.log(`✅ Valid URL format: ${url}`);
        }
      } catch {
        // Invalid URL, skip
      }
    }
    return workingUrls;
  }
  
  // Limit to top 20 URLs to avoid excessive testing
  const urlsToTest = urls.slice(0, 20);
  
  for (const url of urlsToTest) {
    try {
      console.log(`🧪 Testing discovered URL: ${url}`);
      
      // For API endpoints, use direct fetch (HEAD request) instead of Cloudflare bypass
      if (url.includes('/api/') || url.includes('api.')) {
        try {
          const response = await fetch(url, { 
            method: 'HEAD',
            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
          });
          if (response.ok || response.status === 401) { // 401 might mean endpoint exists but needs auth
            // For Greenhouse, validate it's an embed endpoint
            if (sourceKey.includes('greenhouse')) {
              if (url.includes('/embed/job_board') || url.includes('boards.greenhouse.io')) {
                workingUrls.push(url);
                console.log(`✅ Valid Greenhouse endpoint: ${url}`);
              } else {
                console.log(`❌ Not a Greenhouse embed endpoint: ${url}`);
              }
            } else {
              workingUrls.push(url);
              console.log(`✅ Working API endpoint: ${url}`);
            }
          }
        } catch (apiError) {
          console.log(`❌ API endpoint failed: ${url} - ${apiError instanceof Error ? apiError.message : String(apiError)}`);
        }
      } else {
        // For non-API URLs, try direct fetch first (faster than Cloudflare bypass)
        try {
          const response = await fetch(url, {
            method: 'GET',
            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
          });
          if (response.ok) {
            const html = await response.text();
            if (isJobPage(html) || isValidAPIEndpoint(html, url)) {
              workingUrls.push(url);
              console.log(`✅ Working URL found: ${url}`);
            } else {
              console.log(`❌ URL not a valid job page/API: ${url}`);
            }
          }
        } catch (directError) {
          // If direct fetch fails, try Cloudflare bypass as fallback
          try {
            const { html } = await fetchWithCloudflareBypass(url);
            if (isJobPage(html) || isValidAPIEndpoint(html, url)) {
              workingUrls.push(url);
              console.log(`✅ Working URL found (via bypass): ${url}`);
            } else {
              console.log(`❌ URL not a valid job page/API: ${url}`);
            }
          } catch (bypassError) {
            console.log(`❌ URL failed: ${url} - ${bypassError instanceof Error ? bypassError.message : String(bypassError)}`);
          }
        }
      }
    } catch (error) {
      console.log(`❌ URL failed: ${url} - ${error instanceof Error ? error.message : String(error)}`);
    }
    
    // Add delay between tests
    await new Promise(resolve => setTimeout(resolve, 500)); // Reduced delay
  }
  
  return workingUrls;
}

/**
 * Check if content is a valid API endpoint response
 */
function isValidAPIEndpoint(content: string, url: string): boolean {
  // Check for JSON response
  try {
    const parsed = JSON.parse(content);
    // If it's an array or object with job-like structure, it's valid
    if (Array.isArray(parsed) || (typeof parsed === 'object' && parsed !== null)) {
      return true;
    }
  } catch {
    // Not JSON, continue with other checks
  }
  
  // Check for XML (sitemap, RSS)
  if (url.includes('sitemap') || url.includes('feed') || url.includes('rss')) {
    return content.includes('<?xml') || content.includes('<rss') || content.includes('<sitemap');
  }
  
  return false;
}

/**
 * Check if a page contains job-related content
 */
function isJobPage(html: string): boolean {
  const jobKeywords = [
    'job', 'jobs', 'career', 'careers', 'position', 'positions',
    'graduate', 'internship', 'internships', 'placement', 'placements',
    'vacancy', 'vacancies', 'opportunity', 'opportunities',
    'apply', 'application', 'applications'
  ];
  
  const lowerHtml = html.toLowerCase();
  const keywordCount = jobKeywords.filter(keyword => lowerHtml.includes(keyword)).length;
  
  // Consider it a job page if it has multiple job keywords and substantial content
  return keywordCount >= 3 && html.length > 5000;
}