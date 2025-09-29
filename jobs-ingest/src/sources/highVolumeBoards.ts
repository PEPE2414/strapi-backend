import { get } from '../lib/fetcher';
import * as cheerio from 'cheerio';
import { CanonicalJob } from '../types';
import { makeUniqueSlug } from '../lib/slug';
import { sha256 } from '../lib/hash';
import { classifyJobType, parseSalary, toISO, isRelevantJobType, isUKJob } from '../lib/normalize';
import { resolveApplyUrl } from '../lib/applyUrl';

interface JobBoardConfig {
  name: string;
  baseUrl: string;
  jobSelector: string;
  titleSelector: string;
  companySelector: string;
  locationSelector: string;
  descriptionSelector: string;
  applySelector: string;
  paginationPattern: string;
  maxPages: number;
}

const JOB_BOARD_CONFIGS: Record<string, JobBoardConfig> = {
  'targetjobs': {
    name: 'TargetJobs',
    baseUrl: 'https://targetjobs.co.uk',
    jobSelector: '.job-item, .job-listing, .search-result',
    titleSelector: 'h2, h3, .job-title, .title',
    companySelector: '.company, .employer, .job-company',
    locationSelector: '.location, .job-location',
    descriptionSelector: '.description, .job-description, .summary',
    applySelector: 'a[href*="apply"], a[href*="job"], .apply-btn',
    paginationPattern: '?page={page}',
    maxPages: 15
  },
  'prospects': {
    name: 'Prospects',
    baseUrl: 'https://prospects.ac.uk',
    jobSelector: '.job-item, .job-listing, .search-result',
    titleSelector: 'h2, h3, .job-title, .title',
    companySelector: '.company, .employer, .job-company',
    locationSelector: '.location, .job-location',
    descriptionSelector: '.description, .job-description, .summary',
    applySelector: 'a[href*="apply"], a[href*="job"], .apply-btn',
    paginationPattern: '?page={page}',
    maxPages: 15
  },
  'reed': {
    name: 'Reed',
    baseUrl: 'https://reed.co.uk',
    jobSelector: '.job-result, .job-item, .search-result',
    titleSelector: 'h2, h3, .job-title, .title',
    companySelector: '.company, .employer, .job-company',
    locationSelector: '.location, .job-location',
    descriptionSelector: '.description, .job-description, .summary',
    applySelector: 'a[href*="apply"], a[href*="job"], .apply-btn',
    paginationPattern: '?page={page}',
    maxPages: 20
  },
  'totaljobs': {
    name: 'TotalJobs',
    baseUrl: 'https://totaljobs.com',
    jobSelector: '.job, .job-item, .search-result',
    titleSelector: 'h2, h3, .job-title, .title',
    companySelector: '.company, .employer, .job-company',
    locationSelector: '.location, .job-location',
    descriptionSelector: '.description, .job-description, .summary',
    applySelector: 'a[href*="apply"], a[href*="job"], .apply-btn',
    paginationPattern: '?page={page}',
    maxPages: 20
  }
};

export async function scrapeHighVolumeBoard(boardName: string): Promise<CanonicalJob[]> {
  const config = JOB_BOARD_CONFIGS[boardName];
  if (!config) {
    console.warn(`Unknown job board: ${boardName}`);
    return [];
  }
  
  const jobs: CanonicalJob[] = [];
  let page = 1;
  
  try {
    while (page <= config.maxPages) {
      const url = `${config.baseUrl}/search${config.paginationPattern.replace('{page}', page.toString())}`;
      console.log(`🔄 Scraping ${config.name} page ${page}...`);
      
      const { html } = await get(url);
      const $ = cheerio.load(html);
      
      // Find job listings on the page
      const jobElements = $(config.jobSelector);
      
      if (jobElements.length === 0) {
        console.log(`📄 No more jobs found on page ${page}, stopping`);
        break;
      }
      
      console.log(`📄 Found ${jobElements.length} job listings on page ${page}`);
      
      for (let i = 0; i < jobElements.length; i++) {
        try {
          const jobEl = jobElements.eq(i);
          const title = jobEl.find(config.titleSelector).first().text().trim();
          const company = jobEl.find(config.companySelector).first().text().trim();
          const location = jobEl.find(config.locationSelector).first().text().trim();
          const description = jobEl.find(config.descriptionSelector).first().text().trim();
          const applyLink = jobEl.find(config.applySelector).first().attr('href');
          
          if (!title || !company) continue;
          
          const fullText = `${title} ${description} ${location}`;
          
          // Apply filtering
          if (!isRelevantJobType(fullText) || !isUKJob(fullText)) {
            continue;
          }
          
          const applyUrl = applyLink ? await resolveApplyUrl(new URL(applyLink, url).toString()) : url;
          const hash = sha256([title, company, applyUrl].join('|'));
          const slug = makeUniqueSlug(title, company, hash, location);
          
          const job: CanonicalJob = {
            source: `high-volume:${boardName}`,
            sourceUrl: url,
            title,
            company: { name: company },
            companyLogo: undefined,
            location,
            descriptionHtml: description,
            descriptionText: undefined,
            applyUrl,
            applyDeadline: undefined,
            jobType: classifyJobType(fullText),
            salary: parseSalary(description),
            startDate: undefined,
            endDate: undefined,
            duration: undefined,
            experience: undefined,
            companyPageUrl: undefined,
            relatedDegree: undefined,
            degreeLevel: undefined,
            postedAt: new Date().toISOString(),
            slug,
            hash
          };
          
          jobs.push(job);
        } catch (error) {
          console.warn(`Error processing job ${i} on page ${page}:`, error);
        }
      }
      
      page++;
      
      // Add delay between pages to be respectful
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
    
    console.log(`📊 ${config.name}: Found ${jobs.length} total jobs across ${page - 1} pages`);
    return jobs;
    
  } catch (error) {
    console.warn(`Failed to scrape ${config.name}:`, error instanceof Error ? error.message : String(error));
    return jobs;
  }
}
