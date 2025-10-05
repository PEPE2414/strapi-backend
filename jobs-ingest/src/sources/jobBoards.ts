import { get } from '../lib/fetcher';
import * as cheerio from 'cheerio';
import { extractJobPostingJSONLD } from '../lib/jsonld';
import { pickLogo } from '../lib/logo';
import { resolveApplyUrl } from '../lib/applyUrl';
import { CanonicalJob } from '../types';
import { makeUniqueSlug } from '../lib/slug';
import { sha256 } from '../lib/hash';
import { classifyJobType, parseSalary, toISO, isRelevantJobType, isUKJob } from '../lib/normalize';
import { discoverJobUrls } from './sitemapDiscovery';

// Job board configurations
const JOB_BOARDS = {
  'targetjobs': {
    name: 'TARGETjobs',
    baseUrl: 'https://targetjobs.co.uk',
    searchUrls: [
      'https://targetjobs.co.uk/graduate-jobs',
      'https://targetjobs.co.uk/internships',
      'https://targetjobs.co.uk/placement-year'
    ],
    sitemapUrl: 'https://targetjobs.co.uk/sitemap.xml'
  },
  'milkround': {
    name: 'Milkround',
    baseUrl: 'https://www.milkround.com',
    searchUrls: [
      'https://www.milkround.com/jobs',
      'https://www.milkround.com/graduate-jobs',
      'https://www.milkround.com/internships'
    ],
    sitemapUrl: 'https://www.milkround.com/sitemap.xml'
  },
  'prospects': {
    name: 'Prospects',
    baseUrl: 'https://www.prospects.ac.uk',
    searchUrls: [
      'https://www.prospects.ac.uk/jobs-and-work-experience/graduate-jobs',
      'https://www.prospects.ac.uk/jobs-and-work-experience/internships',
      'https://www.prospects.ac.uk/jobs-and-work-experience/work-experience'
    ],
    sitemapUrl: 'https://www.prospects.ac.uk/sitemap.xml'
  },
  'ratemyplacement': {
    name: 'RateMyPlacement',
    baseUrl: 'https://www.ratemyplacement.co.uk',
    searchUrls: [
      'https://www.ratemyplacement.co.uk/placements',
      'https://www.ratemyplacement.co.uk/graduate-jobs',
      'https://www.ratemyplacement.co.uk/internships'
    ],
    sitemapUrl: 'https://www.ratemyplacement.co.uk/sitemap.xml'
  },
  'brightnetwork': {
    name: 'BrightNetwork',
    baseUrl: 'https://www.brightnetwork.co.uk',
    searchUrls: [
      'https://www.brightnetwork.co.uk/graduate-jobs',
      'https://www.brightnetwork.co.uk/internships',
      'https://www.brightnetwork.co.uk/insight-weeks'
    ],
    sitemapUrl: 'https://www.brightnetwork.co.uk/sitemap.xml'
  },
  'studentjob': {
    name: 'StudentJob UK',
    baseUrl: 'https://www.studentjob.co.uk',
    searchUrls: [
      'https://www.studentjob.co.uk/graduate-jobs',
      'https://www.studentjob.co.uk/internships',
      'https://www.studentjob.co.uk/part-time-jobs'
    ],
    sitemapUrl: 'https://www.studentjob.co.uk/sitemap.xml'
  },
  'e4s': {
    name: 'Employment 4 Students',
    baseUrl: 'https://www.e4s.co.uk',
    searchUrls: [
      'https://www.e4s.co.uk/graduate-jobs',
      'https://www.e4s.co.uk/internships',
      'https://www.e4s.co.uk/part-time-jobs'
    ],
    sitemapUrl: 'https://www.e4s.co.uk/sitemap.xml'
  },
  'ratemyapprenticeship': {
    name: 'RateMyApprenticeship',
    baseUrl: 'https://www.ratemyapprenticeship.co.uk',
    searchUrls: [
      'https://www.ratemyapprenticeship.co.uk/apprenticeships',
      'https://www.ratemyapprenticeship.co.uk/graduate-jobs',
      'https://www.ratemyapprenticeship.co.uk/school-leaver-jobs'
    ],
    sitemapUrl: 'https://www.ratemyapprenticeship.co.uk/sitemap.xml'
  },
  'workinstartups': {
    name: 'WorkInStartups',
    baseUrl: 'https://workinstartups.com',
    searchUrls: [
      'https://workinstartups.com/job-board',
      'https://workinstartups.com/graduate-jobs',
      'https://workinstartups.com/internships'
    ],
    sitemapUrl: 'https://workinstartups.com/sitemap.xml'
  },
  'totaljobs': {
    name: 'Totaljobs',
    baseUrl: 'https://www.totaljobs.com',
    searchUrls: [
      'https://www.totaljobs.com/graduate-jobs',
      'https://www.totaljobs.com/internships',
      'https://www.totaljobs.com/entry-level-jobs'
    ],
    sitemapUrl: 'https://www.totaljobs.com/sitemap.xml'
  },
  'reed': {
    name: 'Reed',
    baseUrl: 'https://www.reed.co.uk',
    searchUrls: [
      'https://www.reed.co.uk/jobs/graduate-jobs',
      'https://www.reed.co.uk/jobs/internships',
      'https://www.reed.co.uk/jobs/entry-level-jobs'
    ],
    sitemapUrl: 'https://www.reed.co.uk/sitemap.xml'
  },
  'escapethecity': {
    name: 'Escape the City',
    baseUrl: 'https://www.escapethecity.org',
    searchUrls: [
      'https://www.escapethecity.org/jobs',
      'https://www.escapethecity.org/graduate-jobs',
      'https://www.escapethecity.org/startup-jobs'
    ],
    sitemapUrl: 'https://www.escapethecity.org/sitemap.xml'
  }
};

export async function scrapeJobBoard(boardKey: string): Promise<CanonicalJob[]> {
  console.log(`🚀 Starting job board scraper for: ${boardKey}`);
  const board = JOB_BOARDS[boardKey as keyof typeof JOB_BOARDS];
  if (!board) {
    console.warn(`❌ Unknown job board: ${boardKey}`);
    return [];
  }

  console.log(`🔄 Scraping ${board.name}...`);
  const jobs: CanonicalJob[] = [];

  try {
    // Strategy 1: Try sitemap discovery first (with better error handling)
    console.log(`📋 Trying sitemap discovery for ${board.name}...`);
    let jobUrls: string[] = [];
    try {
      jobUrls = await discoverJobUrls(board.sitemapUrl, 50);
    } catch (error) {
      console.warn(`Sitemap discovery failed for ${board.name}:`, error instanceof Error ? error.message : String(error));
    }
    
    if (jobUrls.length > 0) {
      console.log(`📊 Found ${jobUrls.length} job URLs from sitemap`);
      
      // Process first 20 URLs from sitemap
      for (const url of jobUrls.slice(0, 20)) {
        try {
          console.log(`🔍 Scraping job page: ${url}`);
          const job = await scrapeJobPage(url, board.name);
          if (job) {
            jobs.push(job);
            console.log(`✅ Added job: ${job.title} at ${job.company?.name}`);
          } else {
            console.log(`⏭️  No job found on page: ${url}`);
          }
        } catch (error) {
          console.warn(`Failed to scrape job page ${url}:`, error instanceof Error ? error.message : String(error));
        }
        
        // Add delay between requests to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 2000 + Math.random() * 1000));
      }
    } else {
      console.log(`📋 No job URLs found in sitemap for ${board.name}`);
    }

    // Strategy 2: If sitemap didn't work, try search pages
    if (jobs.length === 0) {
      console.log(`📋 Sitemap didn't work, trying search pages for ${board.name}...`);
      
      for (const searchUrl of board.searchUrls.slice(0, 2)) { // Limit to 2 search URLs
        try {
          const searchJobs = await scrapeSearchPage(searchUrl, board.name);
          jobs.push(...searchJobs);
          
          // Add delay between search pages
          await new Promise(resolve => setTimeout(resolve, 2000));
        } catch (error) {
          console.warn(`Failed to scrape search page ${searchUrl}:`, error instanceof Error ? error.message : String(error));
        }
      }
    }

    console.log(`✅ ${board.name}: Found ${jobs.length} jobs`);
    return jobs;

  } catch (error) {
    console.warn(`Failed to scrape ${board.name}:`, error instanceof Error ? error.message : String(error));
    return [];
  }
}

async function scrapeJobPage(url: string, boardName: string): Promise<CanonicalJob | null> {
  try {
    const { html } = await get(url);
    const jsonld = extractJobPostingJSONLD(html);
    const $ = cheerio.load(html);

    // Prefer JSON-LD fields
    const title = (jsonld?.title || $('h1').first().text() || '').trim();
    const companyName = jsonld?.hiringOrganization?.name ||
      $('meta[property="og:site_name"]').attr('content') ||
      $('meta[name="author"]').attr('content') ||
      $('.company-name, .employer-name').first().text().trim() ||
      new URL(url).hostname.replace(/^www\./, '');

    const location = jsonld?.jobLocation?.address?.addressLocality ||
      jsonld?.jobLocation?.address?.addressRegion ||
      $('.location, .job-location, [class*="location"]').first().text().trim() || undefined;

    const descHtml = jsonld?.description || 
      $('.job-description, .description, [class*="description"], article, main').first().html() || '';

    const applyUrlRaw = jsonld?.hiringOrganization?.sameAs ||
      jsonld?.applicationContact?.url ||
      $('a[href*="apply"], a:contains("Apply"), .apply-button').first().attr('href') ||
      url;

    const applyUrl = await resolveApplyUrl(new URL(applyUrlRaw, url).toString());

    // Check if this job is relevant for university students AND UK-based
    const fullText = title + ' ' + String(descHtml) + ' ' + (location || '');
    
    if (!title || title.trim().length < 3) {
      return null;
    }
    
    if (!isRelevantJobType(fullText)) {
      return null;
    }
    
    if (!isUKJob(fullText)) {
      return null;
    }

    const jobType = classifyJobType(title + ' ' + $('body').text());
    const company = { name: companyName };
    const companyLogo = pickLogo(html, jsonld);
    const hash = sha256([title, companyName, applyUrl].join('|'));
    const slug = makeUniqueSlug(title, companyName, hash, location);

    const job: CanonicalJob = {
      source: `jobboard:${boardName.toLowerCase().replace(/\s+/g, '')}`,
      sourceUrl: url,
      title,
      company,
      companyLogo,
      location,
      descriptionHtml: descHtml,
      descriptionText: undefined,
      applyUrl,
      applyDeadline: toISO(jsonld?.validThrough),
      jobType,
      salary: parseSalary(String(jsonld?.baseSalary?.value?.value || jsonld?.baseSalary?.value || '')),
      startDate: undefined,
      endDate: undefined,
      duration: undefined,
      experience: undefined,
      companyPageUrl: jsonld?.hiringOrganization?.sameAs || undefined,
      relatedDegree: undefined,
      degreeLevel: (() => {
        const t = (title + ' ' + String(descHtml)).toLowerCase();
        if (t.includes('phd') || t.includes('postdoc') || t.includes('doctoral')) return undefined;
        if (t.includes('master') || t.includes('msc') || t.includes('mba')) return ['PG-taught'];
        return ['UG'];
      })(),
      remotePolicy: undefined,
      postedAt: toISO(jsonld?.datePosted),
      slug,
      hash
    };

    return job;
  } catch (error) {
    console.warn(`Failed to scrape job page ${url}:`, error instanceof Error ? error.message : String(error));
    return null;
  }
}

async function scrapeSearchPage(url: string, boardName: string): Promise<CanonicalJob[]> {
  try {
    const { html } = await get(url);
    const $ = cheerio.load(html);
    const jobs: CanonicalJob[] = [];

    // Look for job links on the search page
    const jobLinks = new Set<string>();
    
    // Common selectors for job links
    $('a[href*="/job"], a[href*="/jobs"], a[href*="/vacancy"], a[href*="/position"]').each((_, el) => {
      const href = $(el).attr('href');
      if (href) {
        const fullUrl = new URL(href, url).toString();
        jobLinks.add(fullUrl);
      }
    });

    console.log(`📊 Found ${jobLinks.size} job links on search page`);

    // Process first 10 job links
    for (const jobUrl of Array.from(jobLinks).slice(0, 10)) {
      try {
        const job = await scrapeJobPage(jobUrl, boardName);
        if (job) {
          jobs.push(job);
        }
      } catch (error) {
        console.warn(`Failed to scrape job ${jobUrl}:`, error instanceof Error ? error.message : String(error));
      }
      
      // Add delay between job pages
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    return jobs;
  } catch (error) {
    console.warn(`Failed to scrape search page ${url}:`, error instanceof Error ? error.message : String(error));
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
