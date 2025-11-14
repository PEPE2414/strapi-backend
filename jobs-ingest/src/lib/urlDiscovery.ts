import { request } from 'undici';
import * as cheerio from 'cheerio';
import { fetchWithCloudflareBypass } from './cloudflareBypass';
import { smartFetch } from './smartFetcher';
import { getBetterUrlPatterns } from './betterUrlPatterns';
import { getRealisticUrlPatterns } from './realisticUrlPatterns';
import { discoverUrlsWithPerplexity } from './perplexityUrlDiscovery';
import { discoverSitemaps } from './sitemapDiscovery';
import { discoverWithSearchAPI } from './searchDiscovery';
import { getXHREndpoints } from './xhrDiscovery';

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
const detailCache: Map<string, { urls: string[]; lastUpdated: Date }> = new Map();

function isLikelyListing(url: string): boolean {
  const lower = url.toLowerCase();
  return /search|jobs|intern|placement|graduate|vacanc|opportunit|scheme|programme/.test(lower);
}

function isLikelyDetail(url: string): boolean {
  const lower = url.toLowerCase();
  return /job|vacanc|role|position|opportunit/.test(lower) && !/sitemap|search|feed|rss/.test(lower);
}

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
    'https://www.gradcracker.com/search',
    'https://www.gradcracker.com/internships',
    'https://www.gradcracker.com/placements',
    'https://www.gradcracker.com/graduate-schemes',
    'https://www.gradcracker.com/',
    'https://www.gradcracker.com/careers',
    'https://www.gradcracker.com/opportunities',
    'https://www.gradcracker.com/vacancies'
  ],
  targetjobs: [
    'https://targetjobs.co.uk/uk/en/search/offers',
    'https://targetjobs.co.uk/graduate-jobs',
    'https://targetjobs.co.uk/careers-advice/job-search',
    'https://targetjobs.co.uk/search',
    'https://targetjobs.co.uk/jobs',
    'https://targetjobs.co.uk/internships',
    'https://targetjobs.co.uk/placements',
    'https://targetjobs.co.uk/graduate-schemes',
    'https://targetjobs.co.uk/uk/en/search/internships',
    'https://targetjobs.co.uk/uk/en/search/placements',
    'https://targetjobs.co.uk/',
    'https://targetjobs.co.uk/careers',
    'https://targetjobs.co.uk/opportunities',
    'https://targetjobs.co.uk/vacancies',
    'https://targetjobs.co.uk/uk/en/search',
    'https://targetjobs.co.uk/uk/en/jobs'
  ],
  prospects: [
    'https://www.prospects.ac.uk/job-search',
    'https://www.prospects.ac.uk/graduate-jobs',
    'https://www.prospects.ac.uk/jobs-and-work-experience/job-search',
    'https://www.prospects.ac.uk/graduate-jobs-and-work-experience',
    'https://www.prospects.ac.uk/jobs',
    'https://www.prospects.ac.uk/internships',
    'https://www.prospects.ac.uk/placements',
    'https://www.prospects.ac.uk/work-experience',
    'https://www.prospects.ac.uk/graduate-schemes',
    'https://www.prospects.ac.uk/',
    'https://www.prospects.ac.uk/careers',
    'https://www.prospects.ac.uk/opportunities',
    'https://www.prospects.ac.uk/vacancies',
    'https://www.prospects.ac.uk/jobs-and-work-experience',
    'https://www.prospects.ac.uk/graduate-jobs-and-work-experience'
  ],
  milkround: [
    'https://www.milkround.com/jobs',
    'https://www.milkround.com/graduate-jobs',
    'https://www.milkround.com/jobs/search',
    'https://www.milkround.com/search',
    'https://www.milkround.com/internships',
    'https://www.milkround.com/placements',
    'https://www.milkround.com/graduate-schemes',
    'https://www.milkround.com/work-experience',
    'https://www.milkround.com/',
    'https://www.milkround.com/careers',
    'https://www.milkround.com/opportunities',
    'https://www.milkround.com/vacancies',
    'https://www.milkround.com/graduate',
    'https://www.milkround.com/student'
  ],
  brightnetwork: [
    'https://www.brightnetwork.co.uk/jobs',
    'https://www.brightnetwork.co.uk/graduate-jobs',
    'https://www.brightnetwork.co.uk/graduate-jobs-search',
    'https://www.brightnetwork.co.uk/search',
    'https://www.brightnetwork.co.uk/career-path/graduate-jobs',
    'https://www.brightnetwork.co.uk/internships',
    'https://www.brightnetwork.co.uk/placements',
    'https://www.brightnetwork.co.uk/graduate-schemes',
    'https://www.brightnetwork.co.uk/work-experience',
    'https://www.brightnetwork.co.uk/',
    'https://www.brightnetwork.co.uk/careers',
    'https://www.brightnetwork.co.uk/opportunities',
    'https://www.brightnetwork.co.uk/vacancies',
    'https://www.brightnetwork.co.uk/graduate',
    'https://www.brightnetwork.co.uk/student'
  ],
  ratemyplacement: [
    'https://www.ratemyplacement.co.uk/placements',
    'https://www.ratemyplacement.co.uk/jobs',
    'https://www.ratemyplacement.co.uk/search-jobs',
    'https://www.ratemyplacement.co.uk/placement-jobs',
    'https://www.ratemyplacement.co.uk/jobs/search',
    'https://www.ratemyplacement.co.uk/internships',
    'https://www.ratemyplacement.co.uk/graduate-jobs',
    'https://www.ratemyplacement.co.uk/work-experience',
    'https://www.ratemyplacement.co.uk/',
    'https://www.ratemyplacement.co.uk/careers',
    'https://www.ratemyplacement.co.uk/opportunities',
    'https://www.ratemyplacement.co.uk/vacancies',
    'https://www.ratemyplacement.co.uk/graduate',
    'https://www.ratemyplacement.co.uk/student'
  ]
};

/**
 * Test if a URL returns a valid job search page
 */
async function testUrl(url: string): Promise<boolean> {
  try {
    console.log(`  🧪 Testing: ${url}`);
    
    const { html } = await smartFetch(url);
    
    // Check if page has job-related content
    const $ = cheerio.load(html);
    
    // Look for job-related elements (more comprehensive selectors)
    const jobSelectors = [
      '.job-card', '.job-listing', '.job-item', '.job-result', '.job-post',
      '[class*="JobCard"]', '[class*="job"]', '[class*="Job"]', '[class*="listing"]',
      'article', '.result', '.search-result', '.vacancy', '.position',
      '.opportunity', '.role', '.career', '.employment'
    ];
    
    const hasJobCards = jobSelectors.some(selector => $(selector).length > 0);
    
    // Check for job-related keywords in content
    const jobKeywords = [
      // Graduate job variants
      'graduate', 'graduate scheme', 'graduate programme', 'graduate program',
      'graduate trainee', 'graduate development', 'graduate opportunity',
      'new graduate', 'recent graduate', 'entry level', 'junior',
      
      // Internship variants
      'internship', 'summer internship', 'winter internship', 'intern',
      'internship programme', 'internship program',
      
      // Placement variants
      'placement year', 'year in industry', 'industrial placement',
      'work placement', 'student placement', 'sandwich placement',
      'co-op', 'coop',
      
      // General job terms
      'scheme', 'programme', 'vacancy', 'position', 'role',
      'career', 'employment', 'opportunity', 'work experience'
    ];
    
    const hasJobKeywords = jobKeywords.some(keyword => 
      html.toLowerCase().includes(keyword)
    );
    
    // Check page title and headings for job-related text
    const pageText = $('h1, h2, h3, title, .title, .heading').text().toLowerCase();
    const hasJobText = (
      pageText.includes('job') ||
      pageText.includes('career') ||
      pageText.includes('graduate') ||
      pageText.includes('internship') ||
      pageText.includes('placement')
    );
    
    // More lenient validation - any 1 of 3 criteria is enough for graduate job boards
    const criteria = [hasJobCards, hasJobKeywords, hasJobText];
    const validCriteria = criteria.filter(Boolean).length;
    const isValid = validCriteria >= 1;
    
    // Additional check: if page loads successfully and has some content, consider it valid
    const hasContent = html.length > 1000 && !html.includes('404') && !html.includes('Not Found');
    const finalValid = isValid || hasContent;
    
    if (finalValid) {
      console.log(`    ✅ Valid job search page (${$(
        '.job-card, .job-listing, .job-item, .job-result, [class*="job"]'
      ).length} job elements found)`);
    } else {
      console.log(`    ❌ Not a job search page (no job elements or keywords)`);
    }
    
    return finalValid;
    
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    if (errorMsg.includes('404')) {
      console.log(`    ❌ 404 Not Found`);
      // In test mode, don't retry 404s
      if (process.env.TEST_MODE === 'true') {
        return false; // Skip immediately
      }
    } else if (errorMsg.includes('403')) {
      console.log(`    ⚠️  403 Forbidden (but URL exists)`);
      return true; // URL exists, just blocked (may need Smartproxy)
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
    
    // Look for common job search links (more comprehensive)
    const linkTexts = [
      // Graduate job variants
      'graduate jobs', 'graduate schemes', 'graduate programmes', 'graduate programs',
      'graduate opportunities', 'graduate development', 'new graduate', 'recent graduate',
      'entry level', 'junior',
      
      // Internship variants
      'internships', 'internship opportunities', 'summer internship', 'winter internship',
      'intern', 'internship programmes', 'internship programs',
      
      // Placement variants
      'placements', 'placement year', 'year in industry', 'industrial placement',
      'work placement', 'student placement', 'sandwich placement', 'co-op', 'coop',
      
      // General job terms
      'jobs', 'job search', 'search jobs', 'find jobs', 'browse jobs',
      'career', 'careers', 'career opportunities',
      'vacancies', 'positions', 'roles',
      'opportunities', 'work opportunities',
      'work experience', 'student jobs'
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
function normaliseUrl(url: string, baseUrl?: string): string | null {
  if (!url) return null;
  try {
    return new URL(url, baseUrl).toString().split('#')[0];
  } catch {
    return null;
  }
}

async function validateCandidates(boardKey: string, candidates: string[], maxValid = 4): Promise<string[]> {
  const valid: string[] = [];
  for (const candidate of candidates) {
    if (valid.length >= maxValid) break;
    try {
      const isValid = await testUrl(candidate);
      if (isValid) {
        valid.push(candidate);
      }
    } catch (error) {
      console.log(`⚠️  Candidate test failed for ${candidate}:`, error instanceof Error ? error.message : String(error));
    }
    await new Promise(resolve => setTimeout(resolve, 400));
  }
  if (valid.length > 0) {
    console.log(`✅ ${boardKey}: ${valid.length}/${candidates.length} validated seeds`);
  }
  return valid;
}

export async function discoverWorkingUrls(
  boardKey: string,
  knownPatterns: string[],
  baseUrl?: string
): Promise<string[]> {
  console.log(`\n🔍 Auto-discovering working URLs for ${boardKey}...`);

  const listingCandidates = new Set<string>();
  const detailCandidates = new Set<string>();

  if (baseUrl) {
    try {
      const sitemapResult = await discoverSitemaps(boardKey, baseUrl);
      sitemapResult.listingUrls.forEach(url => {
        const normalised = normaliseUrl(url);
        if (normalised) listingCandidates.add(normalised);
      });
      sitemapResult.detailUrls.forEach(url => {
        const normalised = normaliseUrl(url);
        if (normalised) detailCandidates.add(normalised);
      });
      if (sitemapResult.listingUrls.length || sitemapResult.detailUrls.length) {
        console.log(`  🗺️  Sitemaps discovered ${sitemapResult.listingUrls.length} listings & ${sitemapResult.detailUrls.length} detail URLs`);
      }
    } catch (error) {
      console.warn(`  ⚠️  Sitemap discovery failed for ${boardKey}:`, error instanceof Error ? error.message : String(error));
    }
  }

  // Search API discovery
  if (baseUrl && (process.env.SERP_API_KEY || process.env.SERPER_API_KEY)) {
    try {
      const domain = new URL(baseUrl).hostname.replace(/^www\./, '');
      const queries = [
        '"placement" OR "year in industry"',
        '"internship" OR "summer analyst"',
        '"graduate scheme" OR "graduate programme"',
        '"work placement" OR "industrial placement"'
      ];
      const searchResults = await discoverWithSearchAPI({
        domain,
        queries,
        maxResults: 40
      });
      searchResults.forEach(result => {
        const normalised = normaliseUrl(result.url);
        if (!normalised) return;
        if (isLikelyListing(normalised)) {
          listingCandidates.add(normalised);
        } else if (isLikelyDetail(normalised)) {
          detailCandidates.add(normalised);
        }
      });
      if (searchResults.length > 0) {
        console.log(`  🔎 Search discovery yielded ${searchResults.length} candidates`);
      }
    } catch (error) {
      console.warn(`  ⚠️  Search discovery error for ${boardKey}:`, error instanceof Error ? error.message : String(error));
    }
  }

  // Previously captured XHR endpoints
  const xhrEndpoints = getXHREndpoints(boardKey);
  if (xhrEndpoints.length > 0) {
    xhrEndpoints.forEach(url => {
      const normalised = normaliseUrl(url);
      if (normalised) listingCandidates.add(normalised);
    });
    console.log(`  🛰️  Reusing ${xhrEndpoints.length} cached XHR endpoints`);
  }

  // Perplexity discovery (for graduate job boards)
  try {
    const perplexityResults = await discoverUrlsWithPerplexity('job-board', boardKey);
    perplexityResults.forEach(url => {
      const normalised = normaliseUrl(url);
      if (normalised) listingCandidates.add(normalised);
    });
    if (perplexityResults.length > 0) {
      console.log(`  🤖 Perplexity suggested ${perplexityResults.length} URLs`);
    }
  } catch (error) {
    console.log(`⚠️  Perplexity discovery failed:`, error instanceof Error ? error.message : String(error));
  }

  // Pattern-based fallbacks
  const realisticPatterns = getRealisticUrlPatterns(boardKey);
  realisticPatterns.forEach(url => {
    const normalised = normaliseUrl(url, baseUrl);
    if (normalised) listingCandidates.add(normalised);
  });

  const betterPatterns = getBetterUrlPatterns(boardKey);
  betterPatterns.forEach(url => {
    const normalised = normaliseUrl(url, baseUrl);
    if (normalised) listingCandidates.add(normalised);
  });

  knownPatterns.forEach(url => {
    const normalised = normaliseUrl(url, baseUrl);
    if (normalised) listingCandidates.add(normalised);
  });

  // Homepage fallback
  if (baseUrl) {
    try {
      const discovered = await discoverFromHomepage(baseUrl);
      if (discovered) {
        listingCandidates.add(discovered);
      }
    } catch (error) {
      console.warn(`  ⚠️  Homepage discovery failed:`, error instanceof Error ? error.message : String(error));
    }
  }

  // Validate top candidates
  const candidateArray = Array.from(listingCandidates).slice(0, 40);
  let workingUrls = await validateCandidates(boardKey, candidateArray, 5);

  // As a last resort, test the base URL
  if (workingUrls.length === 0 && baseUrl) {
    const isValid = await testUrl(baseUrl);
    if (isValid) {
      workingUrls = [baseUrl];
    }
  }

  // Cache results
  const now = new Date();
  urlCache.set(boardKey, {
    working: workingUrls,
    failed: [],
    lastUpdated: now
  });

  if (detailCandidates.size > 0) {
    detailCache.set(boardKey, {
      urls: Array.from(detailCandidates).slice(0, 500),
      lastUpdated: now
    });
  }

  if (workingUrls.length === 0) {
    console.warn(`⚠️  No working URLs found for ${boardKey}`);
  } else {
    console.log(`✅ Found ${workingUrls.length} working URLs for ${boardKey}`);
  }

  return workingUrls;
}

/**
 * Test a list of URL patterns
 */
async function testUrlPatterns(urlPatterns: string[], boardKey: string): Promise<string[]> {
  const workingUrls: string[] = [];
  
  // Try all known URL patterns with more aggressive testing
  for (let i = 0; i < urlPatterns.length; i++) {
    const pattern = urlPatterns[i];
    console.log(`🧪 Testing pattern ${i + 1}/${urlPatterns.length}: ${pattern}`);
    
    try {
      const isValid = await testUrl(pattern);
      if (isValid) {
        workingUrls.push(pattern);
        console.log(`✅ Found working URL: ${pattern}`);
        
        // Stop after finding 2 working URLs (reduced from 3 for speed)
        if (workingUrls.length >= 2) {
          break;
        }
      }
    } catch (error) {
      console.log(`⚠️  Error testing ${pattern}:`, error instanceof Error ? error.message : String(error));
    }
    
    // Shorter delay between tests for faster discovery
    await new Promise(resolve => setTimeout(resolve, 500));
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
  maxCacheAge: number = 2 * 60 * 60 * 1000 // 2 hours (reduced from 24 hours)
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

export function getDiscoveredDetailUrls(
  boardKey: string,
  maxCacheAge: number = 4 * 60 * 60 * 1000
): string[] {
  const entry = detailCache.get(boardKey);
  if (!entry || entry.urls.length === 0) return [];
  const age = Date.now() - entry.lastUpdated.getTime();
  if (age > maxCacheAge) return [];
  return entry.urls;
}

export function registerDetailUrls(boardKey: string, urls: string[]): void {
  if (!urls.length) return;
  const entry = detailCache.get(boardKey) || { urls: [], lastUpdated: new Date(0) };
  const combined = new Set<string>(entry.urls);
  urls.forEach(url => {
    const normalised = normaliseUrl(url);
    if (normalised) combined.add(normalised);
  });
  detailCache.set(boardKey, {
    urls: Array.from(combined).slice(0, 600),
    lastUpdated: new Date()
  });
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

