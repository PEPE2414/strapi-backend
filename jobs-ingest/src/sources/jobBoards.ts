import { get } from '../lib/fetcher';
import { fetchWithCloudflareBypass, getBypassStatus } from '../lib/cloudflareBypass';
import { getWorkingUrls } from '../lib/urlDiscovery';
import * as cheerio from 'cheerio';
import { extractJobPostingJSONLD } from '../lib/jsonld';
import { pickLogo } from '../lib/logo';
import { resolveApplyUrl } from '../lib/applyUrl';
import { CanonicalJob } from '../types';
import { makeUniqueSlug } from '../lib/slug';
import { sha256 } from '../lib/hash';
import { classifyJobType, parseSalary, toISO, isRelevantJobType, isUKJob } from '../lib/normalize';

// Job board configurations with MULTIPLE URL patterns
// The scraper will auto-discover which URLs actually work
const JOB_BOARDS = {
  'targetjobs': {
    name: 'TARGETjobs',
    baseUrl: 'https://targetjobs.co.uk',
    urlPatterns: [
      'https://targetjobs.co.uk/uk/en/search/offers',
      'https://targetjobs.co.uk/graduate-jobs',
      'https://targetjobs.co.uk/careers-advice/job-search',
      'https://targetjobs.co.uk/search',
      'https://targetjobs.co.uk/jobs'
    ]
  },
  'milkround': {
    name: 'Milkround',
    baseUrl: 'https://www.milkround.com',
    urlPatterns: [
      'https://www.milkround.com/jobs',
      'https://www.milkround.com/graduate-jobs',
      'https://www.milkround.com/jobs/search',
      'https://www.milkround.com/search',
      'https://www.milkround.com/internships'
    ]
  },
  'prospects': {
    name: 'Prospects',
    baseUrl: 'https://www.prospects.ac.uk',
    urlPatterns: [
      'https://www.prospects.ac.uk/job-search',
      'https://www.prospects.ac.uk/graduate-jobs',
      'https://www.prospects.ac.uk/jobs-and-work-experience/job-search',
      'https://www.prospects.ac.uk/graduate-jobs-and-work-experience',
      'https://www.prospects.ac.uk/jobs'
    ]
  },
  'ratemyplacement': {
    name: 'RateMyPlacement',
    baseUrl: 'https://www.ratemyplacement.co.uk',
    urlPatterns: [
      'https://www.ratemyplacement.co.uk/placements',
      'https://www.ratemyplacement.co.uk/jobs',
      'https://www.ratemyplacement.co.uk/search-jobs',
      'https://www.ratemyplacement.co.uk/placement-jobs',
      'https://www.ratemyplacement.co.uk/jobs/search'
    ]
  },
  'brightnetwork': {
    name: 'BrightNetwork',
    baseUrl: 'https://www.brightnetwork.co.uk',
    urlPatterns: [
      'https://www.brightnetwork.co.uk/jobs',
      'https://www.brightnetwork.co.uk/graduate-jobs',
      'https://www.brightnetwork.co.uk/graduate-jobs-search',
      'https://www.brightnetwork.co.uk/search',
      'https://www.brightnetwork.co.uk/career-path/graduate-jobs'
    ]
  },
  'studentjob': {
    name: 'StudentJob UK',
    baseUrl: 'https://www.studentjob.co.uk',
    urlPatterns: [
      'https://www.studentjob.co.uk/graduate-jobs',
      'https://www.studentjob.co.uk/internships',
      'https://www.studentjob.co.uk/jobs'
    ]
  },
  'e4s': {
    name: 'Employment 4 Students',
    baseUrl: 'https://www.e4s.co.uk',
    urlPatterns: [
      'https://www.e4s.co.uk/graduate-jobs',
      'https://www.e4s.co.uk/internships',
      'https://www.e4s.co.uk/jobs'
    ]
  },
  'ratemyapprenticeship': {
    name: 'RateMyApprenticeship',
    baseUrl: 'https://www.ratemyapprenticeship.co.uk',
    urlPatterns: [
      'https://www.ratemyapprenticeship.co.uk/apprenticeships',
      'https://www.ratemyapprenticeship.co.uk/school-leaver-programmes',
      'https://www.ratemyapprenticeship.co.uk/jobs'
    ]
  },
  'workinstartups': {
    name: 'WorkInStartups',
    baseUrl: 'https://workinstartups.com',
    urlPatterns: [
      'https://workinstartups.com/job-board',
      'https://workinstartups.com/jobs',
      'https://workinstartups.com/graduate-jobs'
    ]
  },
  'totaljobs': {
    name: 'Totaljobs',
    baseUrl: 'https://www.totaljobs.com',
    urlPatterns: [
      'https://www.totaljobs.com/jobs/graduate',
      'https://www.totaljobs.com/jobs/internship',
      'https://www.totaljobs.com/graduate-jobs'
    ]
  },
  'reed': {
    name: 'Reed',
    baseUrl: 'https://www.reed.co.uk',
    urlPatterns: [
      'https://www.reed.co.uk/jobs/graduate-jobs',
      'https://www.reed.co.uk/jobs/internships',
      'https://www.reed.co.uk/graduate-jobs'
    ]
  },
  'escapethecity': {
    name: 'Escape the City',
    baseUrl: 'https://www.escapethecity.org',
    urlPatterns: [
      'https://www.escapethecity.org/jobs',
      'https://www.escapethecity.org/graduate-jobs',
      'https://www.escapethecity.org/opportunities'
    ]
  }
};

export async function scrapeJobBoard(boardKey: string): Promise<CanonicalJob[]> {
  console.log(`🚀 Starting job board scraper for: ${boardKey}`);
  console.log(`🛡️  ${getBypassStatus()}`);
  
  const board = JOB_BOARDS[boardKey as keyof typeof JOB_BOARDS];
  if (!board) {
    console.warn(`❌ Unknown job board: ${boardKey}`);
    return [];
  }

  console.log(`🔄 Scraping ${board.name}...`);
  const jobs: CanonicalJob[] = [];

  try {
    // AUTO-DISCOVER working URLs (tries multiple patterns, caches results)
    console.log(`🔍 Auto-discovering working URLs...`);
    const workingUrls = await getWorkingUrls(
      boardKey,
      board.urlPatterns,
      board.baseUrl
    );
    
    if (workingUrls.length === 0) {
      console.warn(`❌ No working URLs found for ${board.name} - all patterns failed`);
      return [];
    }
    
    console.log(`✅ Found ${workingUrls.length} working URLs for ${board.name}`);
    
    // Scrape each working URL
    for (const searchUrl of workingUrls.slice(0, 2)) {
      try {
        console.log(`🔄 Scraping: ${searchUrl}`);
        const searchJobs = await scrapeSearchPageDirect(searchUrl, board.name, boardKey);
        jobs.push(...searchJobs);
        console.log(`✅ Extracted ${searchJobs.length} jobs from this URL`);
        
        // Add delay between URLs
        await new Promise(resolve => setTimeout(resolve, 5000 + Math.random() * 3000));
      } catch (error) {
        console.warn(`Failed to scrape ${searchUrl}:`, error instanceof Error ? error.message : String(error));
      }
    }

    console.log(`✅ ${board.name}: Found ${jobs.length} total jobs`);
    return jobs;

  } catch (error) {
    console.warn(`Failed to scrape ${board.name}:`, error instanceof Error ? error.message : String(error));
    return [];
  }
}

/**
 * Extract jobs DIRECTLY from search page HTML (no individual page scraping)
 */
async function scrapeSearchPageDirect(url: string, boardName: string, boardKey: string): Promise<CanonicalJob[]> {
  try {
    const { html } = await fetchWithCloudflareBypass(url);
    const $ = cheerio.load(html);
    const jobs: CanonicalJob[] = [];

    console.log(`📊 Fetched ${html.length} chars, parsing...`);

    // Try multiple job card selectors
    const jobSelectors = [
      '.job-card',
      '.job-listing',
      '.job-item',
      '.job-result',
      '[class*="JobCard"]',
      '[class*="job-card"]',
      'article[class*="job"]',
      '[data-testid*="job"]',
      '.vacancy',
      '.opportunity',
      '.position'
    ];

    let $jobCards = $();
    let usedSelector = '';
    
    for (const selector of jobSelectors) {
      const found = $(selector);
      if (found.length > 0) {
        $jobCards = found;
        usedSelector = selector;
        console.log(`📦 Found ${found.length} elements with: ${selector}`);
        break;
      }
    }

    if ($jobCards.length === 0) {
      console.warn(`⚠️  No job cards found on ${url} - might be JS-rendered or wrong URL`);
      return jobs;
    }

    // Extract job data from each card (limit to 30)
    for (let i = 0; i < Math.min($jobCards.length, 30); i++) {
      try {
        const $card = $jobCards.eq(i);
        
        // Extract title with fallbacks
        const title = (
          $card.find('h1, h2, h3').first().text().trim() ||
          $card.find('[class*="title"], [class*="Title"]').first().text().trim() ||
          $card.find('a').first().text().trim()
        );
        
        // Extract company
        const company = (
          $card.find('[class*="company"], [class*="Company"], [class*="employer"], [class*="Employer"]').first().text().trim() ||
          $card.find('[class*="organisation"], [class*="Organization"]').first().text().trim()
        );
        
        // Extract location
        const location = (
          $card.find('[class*="location"], [class*="Location"]').first().text().trim() ||
          $card.find('[class*="place"]').first().text().trim()
        );
        
        // Get link
        const link = $card.find('a[href]').first().attr('href');
        
        if (!title || title.length < 5) {
          continue;
        }
        
        // Build apply URL
        const applyUrl = link ? new URL(link, url).toString() : url;
        
        // Filter for relevance and UK
        const fullText = `${title} ${company} ${location}`;
        if (!isRelevantJobType(fullText) || !isUKJob(fullText)) {
          continue;
        }
        
        const hash = sha256([title, company || boardName, applyUrl].join('|'));
        const slug = makeUniqueSlug(title, company || boardName, hash, location);
        
        const job: CanonicalJob = {
          source: boardKey,
          sourceUrl: url,
          title,
          company: { name: company || boardName },
          location,
          descriptionHtml: $card.find('[class*="description"], [class*="summary"]').first().text().substring(0, 500),
          descriptionText: undefined,
          applyUrl,
          applyDeadline: undefined,
          jobType: classifyJobType(title),
          salary: undefined,
          startDate: undefined,
          endDate: undefined,
          duration: undefined,
          experience: undefined,
          companyPageUrl: undefined,
          relatedDegree: undefined,
          degreeLevel: ['UG'],
          postedAt: new Date().toISOString(),
          slug,
          hash
        };
        
        jobs.push(job);
        console.log(`  ✅ #${i+1}: "${title}" at ${company || 'Unknown'} (${location || 'N/A'})`);
      } catch (error) {
        console.warn(`  ⚠️  Error extracting job #${i}:`, error);
      }
    }

    console.log(`📊 Successfully extracted ${jobs.length} jobs from search page`);
    return jobs;

  } catch (error) {
    console.warn(`Failed to fetch search page ${url}:`, error instanceof Error ? error.message : String(error));
    return [];
  }
}

// Export individual board scrapers
export const scrapeTargetJobs = () => scrapeJobBoard('targetjobs');
export const scrapeMilkround = () => scrapeJobBoard('milkround');
export const scrapeProspects = () => scrapeJobBoard('prospects');
export const scrapeRateMyPlacement = () => scrapeJobBoard('ratemyplacement');
export const scrapeBrightNetwork = () => scrapeJobBoard('brightnetwork');
export const scrapeStudentJobUK = () => scrapeJobBoard('studentjob');
export const scrapeE4S = () => scrapeJobBoard('e4s');
export const scrapeRateMyApprenticeship = () => scrapeJobBoard('ratemyapprenticeship');
export const scrapeWorkInStartups = () => scrapeJobBoard('workinstartups');
export const scrapeTotalJobs = () => scrapeJobBoard('totaljobs');
export const scrapeReed = () => scrapeJobBoard('reed');
export const scrapeEscapeTheCity = () => scrapeJobBoard('escapethecity');
