import { request } from 'undici';
import * as cheerio from 'cheerio';
import { fetchWithCloudflareBypass } from './cloudflareBypass';

/**
 * Adaptive URL discovery system
 * Automatically finds working job search URLs even when sites change their structure
 */

interface DiscoveredUrls {
  working: string[];
  failed: string[];
  lastUpdated: Date;
}

// Cache of discovered URLs (in-memory for now)
const urlCache: Map<string, DiscoveredUrls> = new Map();

/**
 * Common URL patterns for graduate job boards
 */
const URL_PATTERNS = {
  gradcracker: [
    'https://www.gradcracker.com/search/graduate-jobs',
    'https://www.gradcracker.com/hub/graduate-jobs',
    'https://www.gradcracker.com/jobs/graduate',
    'https://www.gradcracker.com/graduate-jobs',
    'https://www.gradcracker.com/jobs',
    'https://www.gradcracker.com/search'
  ],
  targetjobs: [
    'https://targetjobs.co.uk/uk/en/search/offers',
    'https://targetjobs.co.uk/graduate-jobs',
    'https://targetjobs.co.uk/careers-advice/job-search',
    'https://targetjobs.co.uk/search',
    'https://targetjobs.co.uk/jobs'
  ],
  prospects: [
    'https://www.prospects.ac.uk/job-search',
    'https://www.prospects.ac.uk/graduate-jobs',
    'https://www.prospects.ac.uk/jobs-and-work-experience/job-search',
    'https://www.prospects.ac.uk/graduate-jobs-and-work-experience',
    'https://www.prospects.ac.uk/jobs'
  ],
  milkround: [
    'https://www.milkround.com/jobs',
    'https://www.milkround.com/graduate-jobs',
    'https://www.milkround.com/jobs/search',
    'https://www.milkround.com/search',
    'https://www.milkround.com/internships'
  ],
  brightnetwork: [
    'https://www.brightnetwork.co.uk/jobs',
    'https://www.brightnetwork.co.uk/graduate-jobs',
    'https://www.brightnetwork.co.uk/graduate-jobs-search',
    'https://www.brightnetwork.co.uk/search',
    'https://www.brightnetwork.co.uk/career-path/graduate-jobs'
  ],
  ratemyplacement: [
    'https://www.ratemyplacement.co.uk/placements',
    'https://www.ratemyplacement.co.uk/jobs',
    'https://www.ratemyplacement.co.uk/search-jobs',
    'https://www.ratemyplacement.co.uk/placement-jobs',
    'https://www.ratemyplacement.co.uk/jobs/search'
  ]
};

/**
 * Test if a URL returns a valid job search page
 */
async function testUrl(url: string, useScraperAPI: boolean = true): Promise<boolean> {
  try {
    console.log(`  🧪 Testing: ${url}`);
    
    const { html } = useScraperAPI 
      ? await fetchWithCloudflareBypass(url)
      : await fetchDirect(url);
    
    // Check if page has job-related content
    const $ = cheerio.load(html);
    
    // Look for job-related elements
    const hasJobCards = $(
      '.job-card, .job-listing, .job-item, .job-result, ' +
      '[class*="JobCard"], [class*="job"], article'
    ).length > 0;
    
    const hasJobKeywords = (
      html.toLowerCase().includes('graduate') ||
      html.toLowerCase().includes('internship') ||
      html.toLowerCase().includes('placement') ||
      html.toLowerCase().includes('trainee')
    );
    
    const hasJobText = $(
      'h1, h2, title'
    ).text().toLowerCase().includes('job');
    
    // If we found job-related content, URL is valid
    const isValid = hasJobCards && hasJobKeywords && hasJobText;
    
    if (isValid) {
      console.log(`    ✅ Valid job search page (${$(
        '.job-card, .job-listing, .job-item, .job-result, [class*="job"]'
      ).length} job elements found)`);
    } else {
      console.log(`    ❌ Not a job search page (no job elements or keywords)`);
    }
    
    return isValid;
    
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    if (errorMsg.includes('404')) {
      console.log(`    ❌ 404 Not Found`);
    } else if (errorMsg.includes('403')) {
      console.log(`    ⚠️  403 Forbidden (but URL exists)`);
      return true; // URL exists, just blocked without ScraperAPI
    } else {
      console.log(`    ❌ Error: ${errorMsg}`);
    }
    return false;
  }
}

async function fetchDirect(url: string): Promise<{ html: string }> {
  const { body } = await request(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
    }
  });
  const html = await body.text();
  return { html };
}

/**
 * Discover working job search URL from homepage
 */
async function discoverFromHomepage(baseUrl: string): Promise<string | null> {
  try {
    console.log(`  🏠 Checking homepage: ${baseUrl}`);
    
    const { html } = await fetchWithCloudflareBypass(baseUrl);
    const $ = cheerio.load(html);
    
    // Look for common job search links
    const linkTexts = [
      'graduate jobs',
      'jobs',
      'search jobs',
      'find jobs',
      'career',
      'careers',
      'vacancies',
      'opportunities',
      'internships',
      'placements'
    ];
    
    for (const linkText of linkTexts) {
      const link = $(`a:contains("${linkText}")`).first();
      if (link.length > 0) {
        const href = link.attr('href');
        if (href) {
          const fullUrl = new URL(href, baseUrl).toString();
          console.log(`  📍 Found link: "${linkText}" → ${fullUrl}`);
          
          // Test if this is a valid job search page
          const isValid = await testUrl(fullUrl);
          if (isValid) {
            console.log(`    ✅ Valid job search URL found!`);
            return fullUrl;
          }
        }
      }
    }
    
    console.log(`  ⚠️  No valid job search link found on homepage`);
    return null;
    
  } catch (error) {
    console.warn(`  ❌ Failed to discover from homepage:`, error instanceof Error ? error.message : String(error));
    return null;
  }
}

/**
 * Auto-discover working job search URLs for a job board
 */
export async function discoverWorkingUrls(
  boardKey: string,
  knownPatterns: string[],
  baseUrl?: string
): Promise<string[]> {
  console.log(`\n🔍 Auto-discovering working URLs for ${boardKey}...`);
  
  const workingUrls: string[] = [];
  
  // Try all known URL patterns
  for (const pattern of knownPatterns) {
    const isValid = await testUrl(pattern);
    if (isValid) {
      workingUrls.push(pattern);
      console.log(`✅ Found working URL: ${pattern}`);
      
      // Stop after finding 2 working URLs
      if (workingUrls.length >= 2) {
        break;
      }
    }
    
    // Small delay between tests
    await new Promise(resolve => setTimeout(resolve, 2000));
  }
  
  // If no patterns worked, try discovering from homepage
  if (workingUrls.length === 0 && baseUrl) {
    console.log(`⚠️  No URL patterns worked, trying homepage discovery...`);
    const discoveredUrl = await discoverFromHomepage(baseUrl);
    if (discoveredUrl) {
      workingUrls.push(discoveredUrl);
    }
  }
  
  // Cache the results
  urlCache.set(boardKey, {
    working: workingUrls,
    failed: knownPatterns.filter(p => !workingUrls.includes(p)),
    lastUpdated: new Date()
  });
  
  if (workingUrls.length > 0) {
    console.log(`✅ Discovered ${workingUrls.length} working URLs for ${boardKey}`);
  } else {
    console.log(`❌ Could not find any working URLs for ${boardKey}`);
  }
  
  return workingUrls;
}

/**
 * Get working URLs for a board (with caching)
 */
export async function getWorkingUrls(
  boardKey: string,
  knownPatterns: string[],
  baseUrl?: string,
  maxCacheAge: number = 24 * 60 * 60 * 1000 // 24 hours
): Promise<string[]> {
  
  // Check cache first
  const cached = urlCache.get(boardKey);
  if (cached && cached.working.length > 0) {
    const age = Date.now() - cached.lastUpdated.getTime();
    if (age < maxCacheAge) {
      console.log(`📦 Using cached URLs for ${boardKey} (${cached.working.length} URLs, age: ${Math.round(age / 3600000)}h)`);
      return cached.working;
    }
  }
  
  // No cache or expired, discover new URLs
  return await discoverWorkingUrls(boardKey, knownPatterns, baseUrl);
}

/**
 * Quick health check for a URL (lighter than full test)
 */
export async function quickHealthCheck(url: string): Promise<{ status: number; exists: boolean }> {
  try {
    const { body } = await request(url, {
      method: 'HEAD',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      },
      maxRedirections: 5
    });
    
    const res = body as any;
    return {
      status: res.statusCode || 200,
      exists: res.statusCode !== 404
    };
  } catch (error) {
    return { status: 0, exists: false };
  }
}

