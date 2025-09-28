// Sitemap discovery for finding job pages at scale
import { get } from '../lib/fetcher';
import * as cheerio from 'cheerio';
import { ScrapingMonitor } from '../lib/monitor';

export interface SitemapUrl {
  url: string;
  lastmod?: string;
  priority?: number;
  changefreq?: string;
}

export async function discoverJobUrls(domain: string, maxUrls: number = 10000): Promise<string[]> {
  console.log(`🔍 Discovering job URLs from ${domain}...`);
  
  const monitor = new ScrapingMonitor(maxUrls);
  const jobUrls = new Set<string>();
  const sitemapUrls = new Set<string>();
  const processedSitemaps = new Set<string>();
  
  // Start with common sitemap locations
  const commonSitemaps = [
    `${domain}/sitemap.xml`,
    `${domain}/sitemap_index.xml`,
    `${domain}/sitemaps.xml`,
    `${domain}/sitemap/sitemap.xml`,
    `${domain}/robots.txt`
  ];
  
  // Add robots.txt sitemaps
  try {
    const { html } = await get(`${domain}/robots.txt`);
    const robotsSitemaps = html.match(/Sitemap:\s*(.+)/gi) || [];
    robotsSitemaps.forEach((line: string) => {
      const url = line.replace(/Sitemap:\s*/i, '').trim();
      if (url) sitemapUrls.add(url);
    });
  } catch (error) {
    console.warn(`Could not fetch robots.txt from ${domain}:`, error.message);
  }
  
  // Add common sitemaps
  commonSitemaps.forEach(url => sitemapUrls.add(url));
  
  // Process sitemaps
  for (const sitemapUrl of sitemapUrls) {
    if (processedSitemaps.has(sitemapUrl)) continue;
    if (jobUrls.size >= maxUrls) break;
    
    try {
      const urls = await processSitemap(sitemapUrl, domain, maxUrls - jobUrls.size);
      urls.forEach(url => {
        if (isJobUrl(url)) {
          jobUrls.add(url);
          monitor.recordSuccess();
        }
      });
      processedSitemaps.add(sitemapUrl);
    } catch (error) {
      console.warn(`Failed to process sitemap ${sitemapUrl}:`, error.message);
      monitor.recordFailure();
    }
  }
  
  monitor.logFinalStats();
  console.log(`✅ Discovered ${jobUrls.size} job URLs from ${domain}`);
  
  return Array.from(jobUrls);
}

async function processSitemap(sitemapUrl: string, domain: string, maxUrls: number): Promise<string[]> {
  const { html } = await get(sitemapUrl);
  const $ = cheerio.load(html);
  const urls: string[] = [];
  
  // Handle sitemap index
  $('sitemap > loc').each((_, el) => {
    const childSitemap = $(el).text().trim();
    if (childSitemap) {
      // Recursively process child sitemaps
      processSitemap(childSitemap, domain, maxUrls - urls.length)
        .then(childUrls => urls.push(...childUrls))
        .catch(() => {}); // Ignore errors in child sitemaps
    }
  });
  
  // Handle regular sitemap
  $('url > loc').each((_, el) => {
    const url = $(el).text().trim();
    if (url && urls.length < maxUrls) {
      urls.push(url);
    }
  });
  
  return urls;
}

function isJobUrl(url: string): boolean {
  // Focus on university student-relevant job keywords
  const relevantJobKeywords = [
    'intern', 'internship', 'graduate', 'placement', 'trainee',
    'vacation', 'work-experience', 'year-in-industry', 'sandwich',
    'early-careers', 'new-grad', 'entry-level', 'junior'
  ];
  
  const generalJobKeywords = [
    'job', 'jobs', 'career', 'careers', 'position', 'positions',
    'opportunity', 'opportunities', 'opening', 'openings',
    'vacancy', 'vacancies', 'role', 'roles', 'employment'
  ];
  
  const urlLower = url.toLowerCase();
  
  // Prioritize university student-relevant keywords
  const hasRelevantKeyword = relevantJobKeywords.some(keyword => urlLower.includes(keyword));
  const hasGeneralKeyword = generalJobKeywords.some(keyword => urlLower.includes(keyword));
  
  // Check for common job page patterns (focus on student-relevant ones)
  const relevantJobPatterns = [
    /\/intern\//,
    /\/internship\//,
    /\/graduate\//,
    /\/placement\//,
    /\/trainee\//,
    /\/vacation\//,
    /\/work-experience\//,
    /\/year-in-industry\//,
    /\/sandwich\//,
    /\/early-careers\//,
    /\/new-grad\//,
    /\/entry-level\//,
    /\/junior\//
  ];
  
  const generalJobPatterns = [
    /\/job\//,
    /\/jobs\//,
    /\/career\//,
    /\/careers\//,
    /\/position\//,
    /\/positions\//,
    /\/opportunity\//,
    /\/opportunities\//,
    /\/opening\//,
    /\/openings\//,
    /\/vacancy\//,
    /\/vacancies\//,
    /\/role\//,
    /\/roles\//,
    /\/employment\//
  ];
  
  const matchesRelevantPattern = relevantJobPatterns.some(pattern => pattern.test(urlLower));
  const matchesGeneralPattern = generalJobPatterns.some(pattern => pattern.test(urlLower));
  
  // Include if has relevant keywords/patterns, or general keywords/patterns
  return hasRelevantKeyword || matchesRelevantPattern || (hasGeneralKeyword || matchesGeneralPattern);
}

// Company-specific job page discovery
// NOTE: Most university career pages require authentication
export const COMPANY_JOB_PATTERNS = {
  // Public job boards (no auth required)
  'gradcracker.com': [
    'https://www.gradcracker.com/sitemap.xml'
  ],
  'targetjobs.co.uk': [
    'https://targetjobs.co.uk/sitemap.xml'
  ],
  'prospects.ac.uk': [
    'https://www.prospects.ac.uk/sitemap.xml'
  ],
  'indeed.co.uk': [
    'https://uk.indeed.com/sitemap.xml'
  ],
  'reed.co.uk': [
    'https://www.reed.co.uk/sitemap.xml'
  ],
  
  // Company career pages (usually public)
  'arup.com': [
    'https://www.arup.com/careers/sitemap.xml'
  ],
  'atkinsglobal.com': [
    'https://careers.atkinsglobal.com/sitemap.xml'
  ],
  'jacobs.com': [
    'https://careers.jacobs.com/sitemap.xml'
  ],
  
  // University pages (often require auth - marked for manual review)
  'bristol.ac.uk': [
    'https://www.bristol.ac.uk/jobs/',
    'https://www.bristol.ac.uk/careers/'
  ],
  'imperial.ac.uk': [
    'https://www.imperial.ac.uk/jobs/',
    'https://www.imperial.ac.uk/careers/'
  ]
};

export async function discoverCompanyJobPages(company: string): Promise<string[]> {
  const patterns = COMPANY_JOB_PATTERNS[company as keyof typeof COMPANY_JOB_PATTERNS];
  if (!patterns) {
    console.warn(`No job patterns defined for ${company}`);
    return [];
  }
  
  const jobUrls: string[] = [];
  
  for (const baseUrl of patterns) {
    try {
      const urls = await discoverJobUrls(baseUrl, 1000);
      jobUrls.push(...urls);
    } catch (error) {
      console.warn(`Failed to discover jobs from ${baseUrl}:`, error.message);
    }
  }
  
  return jobUrls;
}
