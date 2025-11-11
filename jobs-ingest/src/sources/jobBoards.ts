import { fetchWithCloudflareBypass, getBypassStatus } from '../lib/cloudflareBypass';
import { smartFetch } from '../lib/smartFetcher';
import { getWorkingUrls, getDiscoveredDetailUrls, registerDetailUrls } from '../lib/urlDiscovery';
import { extractGraduateJobs } from '../lib/graduateJobExtractor';
import { debugExtractJobs } from '../lib/debugExtractor';
import { aggressiveExtractJobs } from '../lib/aggressiveJobExtractor';
import * as cheerio from 'cheerio';
import { CanonicalJob } from '../types';
import { makeUniqueSlug } from '../lib/slug';
import { classifyJobType, isRelevantJobType, isUKJob, normalizeCompanyName, normalizeLocation } from '../lib/normalize';
import { scrapeUrlsWithHybrid } from '../lib/hybridScraper';
import { scrapeFromUrls } from './sitemapGeneric';
import { generateJobHash } from '../lib/jobHash';

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
      'https://targetjobs.co.uk/jobs',
      'https://targetjobs.co.uk/internships',
      'https://targetjobs.co.uk/placements',
      'https://targetjobs.co.uk/graduate-schemes',
      'https://targetjobs.co.uk/uk/en/search/internships',
      'https://targetjobs.co.uk/uk/en/search/placements'
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
      'https://www.milkround.com/internships',
      'https://www.milkround.com/placements',
      'https://www.milkround.com/graduate-schemes',
      'https://www.milkround.com/work-experience'
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
      'https://www.prospects.ac.uk/jobs',
      'https://www.prospects.ac.uk/internships',
      'https://www.prospects.ac.uk/placements',
      'https://www.prospects.ac.uk/work-experience',
      'https://www.prospects.ac.uk/graduate-schemes'
    ]
  },
  'ratemyplacement': {
    name: 'Higherin (formerly Rate My Placement)',
    baseUrl: 'https://higherin.com',
    urlPatterns: [
      'https://higherin.com/search-jobs',
      'https://higherin.com/placements',
      'https://higherin.com/internships',
      'https://higherin.com/graduate-jobs',
      'https://higherin.com/graduate-schemes'
    ]
  },
  'trackr': {
    name: 'Trackr (formerly Bristol Tracker)',
    baseUrl: 'https://the-trackr.com',
    urlPatterns: [
      'https://the-trackr.com',
      'https://the-trackr.com/uk-finance',
      'https://the-trackr.com/uk-technology',
      'https://the-trackr.com/uk-law',
      'https://the-trackr.com/north-america-finance',
      'https://the-trackr.com/eu-finance',
      'https://the-trackr.com/jobs',
      'https://the-trackr.com/graduate-jobs',
      'https://the-trackr.com/internships',
      'https://the-trackr.com/placements',
      'https://the-trackr.com/programs',
      'https://the-trackr.com/schemes'
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
      'https://www.brightnetwork.co.uk/career-path/graduate-jobs',
      'https://www.brightnetwork.co.uk/internships',
      'https://www.brightnetwork.co.uk/placements',
      'https://www.brightnetwork.co.uk/graduate-schemes',
      'https://www.brightnetwork.co.uk/work-experience'
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

const HYBRID_BOARDS = new Set(['targetjobs', 'prospects', 'brightnetwork', 'ratemyplacement', 'milkround', 'trackr', 'gradcracker']);
const LISTING_PAGE_LIMIT = 10;
const MAX_QUEUE_SIZE = 24;
const DETAIL_FETCH_LIMIT = 160;

export async function scrapeJobBoard(boardKey: string): Promise<CanonicalJob[]> {
  console.log(`🚀 Starting job board scraper for: ${boardKey}`);
  console.log(`🛡️  ${getBypassStatus()}`);
  
  const board = JOB_BOARDS[boardKey as keyof typeof JOB_BOARDS];
  if (!board) {
    console.warn(`❌ Unknown job board: ${boardKey}`);
    return [];
  }

  console.log(`🔄 Scraping ${board.name}...`);
  const results: CanonicalJob[] = [];
  const seenHashes = new Set<string>();

  const addJob = (job: CanonicalJob) => {
    const normalized = normalizeCanonicalJob(job);
    const summary = `${normalized.title} ${normalized.descriptionText || normalized.descriptionHtml || ''} ${normalized.location || ''}`;
    if (!normalized.applyUrl) return;
    if (!isRelevantJobType(summary)) return;
    if (!isUKJob(summary)) return;
    if (seenHashes.has(normalized.hash)) return;
    seenHashes.add(normalized.hash);
    results.push(normalized);
  };

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

    const detailSeedSet = new Set<string>(getDiscoveredDetailUrls(boardKey));

    if (HYBRID_BOARDS.has(boardKey)) {
      console.log(`🎭 Using hybrid scraper for ${board.name}...`);
      const hybridJobs = await scrapeUrlsWithHybrid(workingUrls.slice(0, 3), board.name, boardKey);
      hybridJobs.forEach(addJob);
    }

    const { jobs: listingJobs, detailUrls: discoveredDetailUrls } = await crawlListingUrls(
      workingUrls.slice(0, 4),
      boardKey,
      board.name
    );
    listingJobs.forEach(addJob);
    discoveredDetailUrls.forEach(url => detailSeedSet.add(url));

    registerDetailUrls(boardKey, Array.from(detailSeedSet));

    const detailUrlsToFetch = Array.from(detailSeedSet).slice(0, DETAIL_FETCH_LIMIT);
    if (detailUrlsToFetch.length > 0) {
      console.log(`🔁 Fetching ${detailUrlsToFetch.length} detail pages for ${board.name}`);
      const detailJobs = await scrapeFromUrls(detailUrlsToFetch, `${board.name} detail`);
      detailJobs.forEach(addJob);
    }

    console.log(`✅ ${board.name}: Found ${results.length} unique jobs`);
    return results;

  } catch (error) {
    console.warn(`Failed to scrape ${board.name}:`, error instanceof Error ? error.message : String(error));
    return results;
  }
}

async function crawlListingUrls(
  startUrls: string[],
  boardKey: string,
  boardName: string
): Promise<{ jobs: CanonicalJob[]; detailUrls: string[] }> {
  const queue: string[] = [...new Set(startUrls)];
  const visited = new Set<string>();
  const jobs: CanonicalJob[] = [];
  const detailLinks = new Set<string>();

  while (queue.length > 0 && visited.size < LISTING_PAGE_LIMIT) {
    const current = queue.shift();
    if (!current) break;
    if (visited.has(current)) continue;
    visited.add(current);

    try {
      console.log(`🔄 Listing crawl: ${current}`);
      const html = await fetchListingHtml(current);
      if (!html) continue;
      const $ = cheerio.load(html);

      const pageJobs = extractJobsFromListing($, boardName, boardKey, current);
      if (pageJobs.length > 0) {
        console.log(`  ✅ ${pageJobs.length} jobs from listing page`);
        jobs.push(...pageJobs);
      }

      const pageDetailLinks = collectDetailLinks($, current);
      if (pageDetailLinks.length > 0) {
        console.log(`  🔗 Captured ${pageDetailLinks.length} detail links`);
        pageDetailLinks.forEach(link => detailLinks.add(link));
        registerDetailUrls(boardKey, pageDetailLinks);
      }

      const paginationLinks = collectPaginationLinks($, current);
      paginationLinks.forEach(link => {
        if (!visited.has(link) && !queue.includes(link) && queue.length < MAX_QUEUE_SIZE) {
          queue.push(link);
        }
      });
    } catch (error) {
      console.warn(`  ⚠️  Failed to process listing ${current}:`, error instanceof Error ? error.message : String(error));
    }

    await delay(900 + Math.random() * 700);
  }

  return { jobs, detailUrls: Array.from(detailLinks) };
}

async function fetchListingHtml(url: string): Promise<string | null> {
  try {
    const { html } = await smartFetch(url);
    if (html && html.length > 0) {
      return html;
    }
  } catch (error) {
    console.warn(`  ⚠️  smartFetch failed for ${url}:`, error instanceof Error ? error.message : String(error));
  }

  try {
    const { html } = await fetchWithCloudflareBypass(url);
    return html;
  } catch (error) {
    console.warn(`  ⚠️  Bypass fetch failed for ${url}:`, error instanceof Error ? error.message : String(error));
    return null;
  }
}

function extractJobsFromListing(
  $: cheerio.CheerioAPI,
  boardName: string,
  boardKey: string,
  url: string
): CanonicalJob[] {
  const aggressive = aggressiveExtractJobs($, boardName, boardKey, url);
  if (aggressive.length > 0) return aggressive;

  const debug = debugExtractJobs($, boardName, boardKey, url);
  if (debug.length > 0) return debug;

  const graduate = extractGraduateJobs($, boardName, boardKey);
  if (graduate.length > 0) return graduate;

  return [];
}

function collectDetailLinks($: cheerio.CheerioAPI, currentUrl: string): string[] {
  const links = new Set<string>();

  const addLink = (href?: string | null) => {
    if (!href) return;
    try {
      const full = new URL(href, currentUrl).toString().split('#')[0];
      const lower = full.toLowerCase();
      if (
        /job|vacancy|role|position|opportunit|listing/.test(lower) &&
        !/logout|login|register|mailto|tel:|javascript:void/.test(lower)
      ) {
        links.add(full);
      }
    } catch {
      // ignore invalid
    }
  };

  $('a[href]').each((_, el) => addLink($(el).attr('href')));
  $('[data-url]').each((_, el) => addLink($(el).attr('data-url')));
  $('[data-href]').each((_, el) => addLink($(el).attr('data-href')));

  return Array.from(links).slice(0, 200);
}

function collectPaginationLinks($: cheerio.CheerioAPI, currentUrl: string): string[] {
  const links = new Set<string>();

  $('a[rel="next"]').each((_, el) => {
    const href = $(el).attr('href');
    if (href) {
      try {
        links.add(new URL(href, currentUrl).toString());
      } catch {
        // ignore
      }
    }
  });

  $('a').each((_, el) => {
    const text = $(el).text().trim().toLowerCase();
    if (!text) return;
    if (/(next|more results|older|load more|show more)/.test(text)) {
      const href = $(el).attr('href');
      if (href) {
        try {
          links.add(new URL(href, currentUrl).toString());
        } catch {
          // ignore
        }
      }
    }
  });

  try {
    const current = new URL(currentUrl);
    const page = current.searchParams.get('page');
    if (page) {
      const nextPage = Number(page) + 1;
      if (Number.isFinite(nextPage)) {
        const next = new URL(currentUrl);
        next.searchParams.set('page', String(nextPage));
        links.add(next.toString());
      }
    }

    const offset = current.searchParams.get('offset');
    if (offset) {
      const nextOffset = Number(offset) + 1;
      if (Number.isFinite(nextOffset)) {
        const next = new URL(currentUrl);
        next.searchParams.set('offset', String(nextOffset));
        links.add(next.toString());
      }
    }
  } catch {
    // ignore
  }

  return Array.from(links).slice(0, 10);
}

function normalizeCanonicalJob(job: CanonicalJob): CanonicalJob {
  const companyName = normalizeCompanyName(job.company?.name || 'Unknown');
  const location = job.location ? normalizeLocation(job.location) : undefined;
  const summary = `${job.title} ${job.descriptionText || job.descriptionHtml || ''}`;
  const jobType = job.jobType && job.jobType !== 'other'
    ? job.jobType
    : classifyJobType(summary);

  const hash = generateJobHash({
    title: job.title,
    company: companyName,
    applyUrl: job.applyUrl,
    location,
    postedAt: job.postedAt
  });

  const slug = makeUniqueSlug(job.title, companyName, hash, location);

  return {
    ...job,
    company: { ...job.company, name: companyName },
    location: location || undefined,
    jobType,
    hash,
    slug
  };
}

function delay(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Export individual board scrapers
export const scrapeTargetJobs = () => scrapeJobBoard('targetjobs');
export const scrapeMilkround = () => scrapeJobBoard('milkround');
export const scrapeProspects = () => scrapeJobBoard('prospects');
export const scrapeRateMyPlacement = () => scrapeJobBoard('ratemyplacement');
export const scrapeTrackr = () => scrapeJobBoard('trackr');
export const scrapeBrightNetwork = () => scrapeJobBoard('brightnetwork');
export const scrapeStudentJobUK = () => scrapeJobBoard('studentjob');
export const scrapeE4S = () => scrapeJobBoard('e4s');
export const scrapeRateMyApprenticeship = () => scrapeJobBoard('ratemyapprenticeship');
export const scrapeWorkInStartups = () => scrapeJobBoard('workinstartups');
export const scrapeTotalJobs = () => scrapeJobBoard('totaljobs');
export const scrapeReed = () => scrapeJobBoard('reed');
export const scrapeEscapeTheCity = () => scrapeJobBoard('escapethecity');
