import { get } from '../lib/fetcher';
import * as cheerio from 'cheerio';
import { CanonicalJob } from '../types';
import { makeUniqueSlug } from '../lib/slug';
import { sha256 } from '../lib/hash';
import { classifyJobType, isRelevantJobType, isUKJob } from '../lib/normalize';
import { resolveApplyUrl } from '../lib/applyUrl';

// Optimized job board scraper focusing on high-volume, reliable sources
export async function scrapeOptimizedJobBoards(): Promise<CanonicalJob[]> {
  console.log('🚀 Starting optimized job board scraping...');
  const jobs: CanonicalJob[] = [];
  
  // Focus on the most reliable and high-volume sources
  const optimizedSources = [
    {
      name: 'Indeed UK Graduate',
      url: 'https://uk.indeed.com/jobs?q=graduate&l=United+Kingdom&fromage=7&limit=50',
      type: 'indeed'
    },
    {
      name: 'Indeed UK Internship',
      url: 'https://uk.indeed.com/jobs?q=internship&l=United+Kingdom&fromage=7&limit=50',
      type: 'indeed'
    },
    {
      name: 'Indeed UK Entry Level',
      url: 'https://uk.indeed.com/jobs?q=entry+level&l=United+Kingdom&fromage=7&limit=50',
      type: 'indeed'
    },
    {
      name: 'Reed Graduate Jobs',
      url: 'https://www.reed.co.uk/jobs/graduate-jobs',
      type: 'reed'
    },
    {
      name: 'TotalJobs Graduate',
      url: 'https://www.totaljobs.com/jobs/graduate',
      type: 'totaljobs'
    },
    {
      name: 'CV Library Graduate',
      url: 'https://www.cv-library.co.uk/graduate-jobs',
      type: 'cv-library'
    }
  ];

  for (const source of optimizedSources) {
    try {
      console.log(`🔄 Scraping ${source.name}...`);
      const sourceJobs = await scrapeJobBoardSource(source);
      jobs.push(...sourceJobs);
      console.log(`✅ ${source.name}: Found ${sourceJobs.length} jobs`);
      
      // Add delay between sources
      await new Promise(resolve => setTimeout(resolve, 5000 + Math.random() * 5000));
      
    } catch (error) {
      console.warn(`Failed to scrape ${source.name}:`, error instanceof Error ? error.message : String(error));
    }
  }
  
  console.log(`🎉 Optimized job board scraping completed: ${jobs.length} total jobs`);
  return jobs;
}

async function scrapeJobBoardSource(source: { name: string; url: string; type: string }): Promise<CanonicalJob[]> {
  const jobs: CanonicalJob[] = [];
  
  try {
    const { html } = await get(source.url);
    const $ = cheerio.load(html);
    
    console.log(`📊 ${source.name}: HTML length = ${html.length}`);
    
    // Use different scraping strategies based on job board type
    if (source.type === 'indeed') {
      return await scrapeIndeedJobs($, source);
    } else if (source.type === 'reed') {
      return await scrapeReedJobs($, source);
    } else if (source.type === 'totaljobs') {
      return await scrapeTotalJobsJobs($, source);
    } else if (source.type === 'cv-library') {
      return await scrapeCVLibraryJobs($, source);
    }
    
  } catch (error) {
    console.warn(`Failed to scrape ${source.name}:`, error instanceof Error ? error.message : String(error));
    return [];
  }
  
  return jobs;
}

async function scrapeIndeedJobs($: cheerio.CheerioAPI, source: { name: string; url: string; type: string }): Promise<CanonicalJob[]> {
  const jobs: CanonicalJob[] = [];
  
  // Indeed job selectors (updated for current structure)
  const jobSelectors = [
    '.job_seen_beacon',
    '.jobsearch-SerpJobCard',
    '[data-jk]',
    '.result'
  ];
  
  let foundJobs = 0;
  
  for (const selector of jobSelectors) {
    $(selector).each((i, element) => {
      if (foundJobs >= 20) return false; // Limit to 20 jobs per source
      
      try {
        const $job = $(element);
        
        // Extract job data with multiple fallback selectors
        const title = $job.find('h2 a span').attr('title') || 
                     $job.find('h2 a').text().trim() ||
                     $job.find('.jobTitle a').text().trim() ||
                     $job.find('[data-testid="job-title"]').text().trim();
        
        const company = $job.find('.companyName').text().trim() ||
                       $job.find('[data-testid="company-name"]').text().trim() ||
                       $job.find('.company').text().trim();
        
        const location = $job.find('.companyLocation').text().trim() ||
                        $job.find('[data-testid="job-location"]').text().trim() ||
                        $job.find('.location').text().trim();
        
        const link = $job.find('h2 a').attr('href') ||
                    $job.find('.jobTitle a').attr('href') ||
                    $job.find('[data-testid="job-title"]').attr('href');
        
        if (!title || title.length < 5) return;
        
        // Check if this is a relevant job
        const fullText = `${title} ${company} ${location}`.toLowerCase();
        if (!isRelevantJobType(fullText) || !isUKJob(fullText)) return;
        
        // Create job object
        const applyUrl = link ? new URL(link, 'https://uk.indeed.com').toString() : source.url;
        const hash = sha256([title, company, applyUrl].join('|'));
        const slug = makeUniqueSlug(title, company, hash, location);
        
        const job: CanonicalJob = {
          source: 'indeed-uk-optimized',
          sourceUrl: source.url,
          title,
          company: { name: company || 'Unknown' },
          location,
          descriptionHtml: $job.find('.job-snippet').text().trim() || $job.text().substring(0, 500),
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
          remotePolicy: undefined,
          postedAt: new Date().toISOString(),
          slug,
          hash
        };
        
        jobs.push(job);
        foundJobs++;
        console.log(`✅ Added Indeed job: ${title} at ${company}`);
        
      } catch (error) {
        console.warn(`Error processing Indeed job:`, error);
      }
    });
    
    if (foundJobs > 0) break; // Stop trying other selectors if we found jobs
  }
  
  return jobs;
}

async function scrapeReedJobs($: cheerio.CheerioAPI, source: { name: string; url: string; type: string }): Promise<CanonicalJob[]> {
  const jobs: CanonicalJob[] = [];
  
  // Reed job selectors
  const jobSelectors = [
    '.job-result-card',
    '.job-card',
    '.search-result',
    '[data-testid*="job"]',
    '.job'
  ];
  
  let foundJobs = 0;
  
  for (const selector of jobSelectors) {
    $(selector).each((i, element) => {
      if (foundJobs >= 15) return false; // Limit to 15 jobs per source
      
      try {
        const $job = $(element);
        
        const title = $job.find('h2 a').text().trim() ||
                     $job.find('h3 a').text().trim() ||
                     $job.find('.title a').text().trim() ||
                     $job.find('[data-testid="job-title"]').text().trim();
        
        const company = $job.find('.company').text().trim() ||
                       $job.find('.employer').text().trim() ||
                       $job.find('[data-testid="company-name"]').text().trim();
        
        const location = $job.find('.location').text().trim() ||
                        $job.find('.place').text().trim() ||
                        $job.find('[data-testid="job-location"]').text().trim();
        
        const link = $job.find('h2 a').attr('href') ||
                    $job.find('h3 a').attr('href') ||
                    $job.find('.title a').attr('href');
        
        if (!title || title.length < 5) return;
        
        // Check if this is a relevant job
        const fullText = `${title} ${company} ${location}`.toLowerCase();
        if (!isRelevantJobType(fullText) || !isUKJob(fullText)) return;
        
        // Create job object
        const applyUrl = link ? new URL(link, 'https://www.reed.co.uk').toString() : source.url;
        const hash = sha256([title, company, applyUrl].join('|'));
        const slug = makeUniqueSlug(title, company, hash, location);
        
        const job: CanonicalJob = {
          source: 'reed-uk-optimized',
          sourceUrl: source.url,
          title,
          company: { name: company || 'Unknown' },
          location,
          descriptionHtml: $job.text().substring(0, 500),
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
          remotePolicy: undefined,
          postedAt: new Date().toISOString(),
          slug,
          hash
        };
        
        jobs.push(job);
        foundJobs++;
        console.log(`✅ Added Reed job: ${title} at ${company}`);
        
      } catch (error) {
        console.warn(`Error processing Reed job:`, error);
      }
    });
    
    if (foundJobs > 0) break; // Stop trying other selectors if we found jobs
  }
  
  return jobs;
}

async function scrapeTotalJobsJobs($: cheerio.CheerioAPI, source: { name: string; url: string; type: string }): Promise<CanonicalJob[]> {
  const jobs: CanonicalJob[] = [];
  
  // TotalJobs job selectors
  const jobSelectors = [
    '.job',
    '.job-card',
    '.search-result',
    '.result',
    '[data-testid*="job"]'
  ];
  
  let foundJobs = 0;
  
  for (const selector of jobSelectors) {
    $(selector).each((i, element) => {
      if (foundJobs >= 15) return false; // Limit to 15 jobs per source
      
      try {
        const $job = $(element);
        
        const title = $job.find('h2 a').text().trim() ||
                     $job.find('h3 a').text().trim() ||
                     $job.find('.title a').text().trim();
        
        const company = $job.find('.company').text().trim() ||
                       $job.find('.employer').text().trim();
        
        const location = $job.find('.location').text().trim() ||
                        $job.find('.place').text().trim();
        
        const link = $job.find('h2 a').attr('href') ||
                    $job.find('h3 a').attr('href') ||
                    $job.find('.title a').attr('href');
        
        if (!title || title.length < 5) return;
        
        // Check if this is a relevant job
        const fullText = `${title} ${company} ${location}`.toLowerCase();
        if (!isRelevantJobType(fullText) || !isUKJob(fullText)) return;
        
        // Create job object
        const applyUrl = link ? new URL(link, 'https://www.totaljobs.com').toString() : source.url;
        const hash = sha256([title, company, applyUrl].join('|'));
        const slug = makeUniqueSlug(title, company, hash, location);
        
        const job: CanonicalJob = {
          source: 'totaljobs-uk-optimized',
          sourceUrl: source.url,
          title,
          company: { name: company || 'Unknown' },
          location,
          descriptionHtml: $job.text().substring(0, 500),
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
          remotePolicy: undefined,
          postedAt: new Date().toISOString(),
          slug,
          hash
        };
        
        jobs.push(job);
        foundJobs++;
        console.log(`✅ Added TotalJobs job: ${title} at ${company}`);
        
      } catch (error) {
        console.warn(`Error processing TotalJobs job:`, error);
      }
    });
    
    if (foundJobs > 0) break; // Stop trying other selectors if we found jobs
  }
  
  return jobs;
}

async function scrapeCVLibraryJobs($: cheerio.CheerioAPI, source: { name: string; url: string; type: string }): Promise<CanonicalJob[]> {
  const jobs: CanonicalJob[] = [];
  
  // CV Library job selectors
  const jobSelectors = [
    '.job',
    '.job-card',
    '.search-result',
    '.result',
    '[data-testid*="job"]'
  ];
  
  let foundJobs = 0;
  
  for (const selector of jobSelectors) {
    $(selector).each((i, element) => {
      if (foundJobs >= 15) return false; // Limit to 15 jobs per source
      
      try {
        const $job = $(element);
        
        const title = $job.find('h2 a').text().trim() ||
                     $job.find('h3 a').text().trim() ||
                     $job.find('.title a').text().trim();
        
        const company = $job.find('.company').text().trim() ||
                       $job.find('.employer').text().trim();
        
        const location = $job.find('.location').text().trim() ||
                        $job.find('.place').text().trim();
        
        const link = $job.find('h2 a').attr('href') ||
                    $job.find('h3 a').attr('href') ||
                    $job.find('.title a').attr('href');
        
        if (!title || title.length < 5) return;
        
        // Check if this is a relevant job
        const fullText = `${title} ${company} ${location}`.toLowerCase();
        if (!isRelevantJobType(fullText) || !isUKJob(fullText)) return;
        
        // Create job object
        const applyUrl = link ? new URL(link, 'https://www.cv-library.co.uk').toString() : source.url;
        const hash = sha256([title, company, applyUrl].join('|'));
        const slug = makeUniqueSlug(title, company, hash, location);
        
        const job: CanonicalJob = {
          source: 'cv-library-uk-optimized',
          sourceUrl: source.url,
          title,
          company: { name: company || 'Unknown' },
          location,
          descriptionHtml: $job.text().substring(0, 500),
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
          remotePolicy: undefined,
          postedAt: new Date().toISOString(),
          slug,
          hash
        };
        
        jobs.push(job);
        foundJobs++;
        console.log(`✅ Added CV Library job: ${title} at ${company}`);
        
      } catch (error) {
        console.warn(`Error processing CV Library job:`, error);
      }
    });
    
    if (foundJobs > 0) break; // Stop trying other selectors if we found jobs
  }
  
  return jobs;
}
