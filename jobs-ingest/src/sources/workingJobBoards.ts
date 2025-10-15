import { get } from '../lib/fetcher';
import * as cheerio from 'cheerio';
import { CanonicalJob } from '../types';
import { makeUniqueSlug } from '../lib/slug';
import { sha256 } from '../lib/hash';
import { classifyJobType, isRelevantJobType, isUKJob } from '../lib/normalize';
import { resolveApplyUrl } from '../lib/applyUrl';

// Working job board scrapers with known good URLs
export async function scrapeWorkingJobBoards(): Promise<CanonicalJob[]> {
  const jobs: CanonicalJob[] = [];
  
  // Try a few known working job board pages
  const workingSources = [
    {
      name: 'Indeed UK Graduate Jobs',
      url: 'https://uk.indeed.com/jobs?q=graduate&l=United+Kingdom&fromage=7',
      selector: '.job_seen_beacon, .jobsearch-SerpJobCard'
    },
    {
      name: 'Indeed UK Internships',
      url: 'https://uk.indeed.com/jobs?q=internship&l=United+Kingdom&fromage=7',
      selector: '.job_seen_beacon, .jobsearch-SerpJobCard'
    },
    {
      name: 'Indeed UK Entry Level',
      url: 'https://uk.indeed.com/jobs?q=entry+level&l=United+Kingdom&fromage=7',
      selector: '.job_seen_beacon, .jobsearch-SerpJobCard'
    },
    {
      name: 'Reed Graduate Jobs',
      url: 'https://www.reed.co.uk/jobs/graduate-jobs',
      selector: '.job-result-card, .job-card'
    },
    {
      name: 'TotalJobs Graduate Jobs',
      url: 'https://www.totaljobs.com/jobs/graduate',
      selector: '.job, .job-card, .search-result'
    },
    {
      name: 'CV Library Graduate Jobs',
      url: 'https://www.cv-library.co.uk/graduate-jobs',
      selector: '.job, .job-card, .search-result'
    }
  ];

  for (const source of workingSources) {
    try {
      console.log(`🔄 Scraping ${source.name}...`);
      const { html } = await get(source.url);
      const $ = cheerio.load(html);
      
      let foundJobs = 0;
      
      // Try different selectors for job listings
      const jobSelectors = [
        source.selector,
        '.job',
        '.job-card',
        '.search-result',
        '.job-listing',
        '.vacancy',
        '.position',
        '[data-testid*="job"]',
        '[class*="job"]'
      ];
      
      for (const selector of jobSelectors) {
        $(selector).each((i, element) => {
          if (foundJobs >= 10) return false; // Limit to 10 jobs per source
          
          try {
            const $job = $(element);
            const title = $job.find('h2, h3, .title, .job-title, [class*="title"]').first().text().trim();
            const company = $job.find('.company, .employer, [class*="company"]').first().text().trim();
            const location = $job.find('.location, .place, [class*="location"]').first().text().trim();
            const link = $job.find('a').first().attr('href');
            
            if (!title || title.length < 5) return;
            
            // Check if this is a relevant job
            const fullText = `${title} ${company} ${location}`.toLowerCase();
            if (!isRelevantJobType(fullText) || !isUKJob(fullText)) return;
            
            // Create job object
            const applyUrl = link ? new URL(link, source.url).toString() : source.url;
            const hash = sha256([title, company, applyUrl].join('|'));
            const slug = makeUniqueSlug(title, company, hash, location);
            
            const job: CanonicalJob = {
              source: `working-board:${source.name.toLowerCase().replace(/\s+/g, '-')}`,
              sourceUrl: source.url,
              title,
              company: { name: company || 'Unknown' },
              location,
              descriptionHtml: $job.text().substring(0, 500), // Use job card text as description
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
            
          } catch (error) {
            console.warn(`Error processing job element:`, error);
          }
        });
        
        if (foundJobs > 0) break; // Stop trying other selectors if we found jobs
      }
      
      console.log(`✅ ${source.name}: Found ${foundJobs} jobs`);
      
      // Add delay between sources
      await new Promise(resolve => setTimeout(resolve, 2000));
      
    } catch (error) {
      console.warn(`Failed to scrape ${source.name}:`, error instanceof Error ? error.message : String(error));
    }
  }
  
  return jobs;
}

// Individual scrapers for specific boards
export async function scrapeIndeedUK(): Promise<CanonicalJob[]> {
  console.log('🚀 Starting Indeed UK scraper...');
  const jobs: CanonicalJob[] = [];
  
  const searchQueries = [
    'graduate',
    'internship', 
    'entry+level',
    'placement',
    'placement+year',
    'year+in+industry',
    'industrial+placement',
    'graduate+scheme',
    'graduate+programme',
    'graduate+program',
    'graduate+trainee',
    'graduate+development',
    'summer+internship',
    'winter+internship',
    'internship+programme',
    'internship+program'
  ];
  
  for (const query of searchQueries) {
    try {
      const url = `https://uk.indeed.com/jobs?q=${query}&l=United+Kingdom&fromage=7&limit=20`;
      console.log(`🔄 Scraping Indeed UK: ${query}...`);
      
      const { html } = await get(url);
      const $ = cheerio.load(html);
      
      console.log(`📊 Indeed UK ${query}: HTML length = ${html.length}, found ${$('.job_seen_beacon, .jobsearch-SerpJobCard').length} job elements`);
      
      $('.job_seen_beacon, .jobsearch-SerpJobCard').each((i, element) => {
        if (i >= 5) return false; // Limit to 5 jobs per query
        
        try {
          const $job = $(element);
          const title = $job.find('h2 a span').attr('title') || $job.find('h2 a').text().trim();
          const company = $job.find('.companyName').text().trim();
          const location = $job.find('.companyLocation').text().trim();
          const link = $job.find('h2 a').attr('href');
          
          if (!title || title.length < 5) return;
          
          // Check if this is a relevant job
          const fullText = `${title} ${company} ${location}`.toLowerCase();
          if (!isRelevantJobType(fullText) || !isUKJob(fullText)) return;
          
          // Create job object
          const applyUrl = link ? new URL(link, 'https://uk.indeed.com').toString() : url;
          const hash = sha256([title, company, applyUrl].join('|'));
          const slug = makeUniqueSlug(title, company, hash, location);
          
          const job: CanonicalJob = {
            source: 'indeed-uk',
            sourceUrl: url,
            title,
            company: { name: company || 'Unknown' },
            location,
            descriptionHtml: $job.find('.job-snippet').text().trim() || $job.text().substring(0, 300),
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
          console.log(`✅ Added Indeed job: ${title} at ${company}`);
          
        } catch (error) {
          console.warn(`Error processing Indeed job:`, error);
        }
      });
      
      // Add delay between queries
      await new Promise(resolve => setTimeout(resolve, 3000));
      
    } catch (error) {
      console.warn(`Failed to scrape Indeed UK for ${query}:`, error instanceof Error ? error.message : String(error));
    }
  }
  
  console.log(`✅ Indeed UK: Found ${jobs.length} jobs`);
  return jobs;
}

export async function scrapeReedWorking(): Promise<CanonicalJob[]> {
  console.log('🚀 Starting Reed working scraper...');
  const jobs: CanonicalJob[] = [];
  
  try {
    // Try the main Reed jobs page
    const url = 'https://www.reed.co.uk/jobs';
    console.log(`🔄 Scraping Reed working URL...`);
    
    const { html } = await get(url);
    const $ = cheerio.load(html);
    
    console.log(`📊 Reed working: HTML length = ${html.length}, found ${$('.job-result-card, .job-card, .search-result, [data-testid*="job"]').length} job elements`);
    
    // Look for job listings
    $('.job-result-card, .job-card, .search-result, [data-testid*="job"]').each((i, element) => {
      if (i >= 10) return false; // Limit to 10 jobs
      
      try {
        const $job = $(element);
        const title = $job.find('h2, h3, .title, .job-title').first().text().trim();
        const company = $job.find('.company, .employer').first().text().trim();
        const location = $job.find('.location, .place').first().text().trim();
        const link = $job.find('a').first().attr('href');
        
        if (!title || title.length < 5) return;
        
        // Check if this is a relevant job
        const fullText = `${title} ${company} ${location}`.toLowerCase();
        if (!isRelevantJobType(fullText) || !isUKJob(fullText)) return;
        
        // Create job object
        const applyUrl = link ? new URL(link, 'https://www.reed.co.uk').toString() : url;
        const hash = sha256([title, company, applyUrl].join('|'));
        const slug = makeUniqueSlug(title, company, hash, location);
        
        const job: CanonicalJob = {
          source: 'reed-working',
          sourceUrl: url,
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
        console.log(`✅ Added Reed job: ${title} at ${company}`);
        
      } catch (error) {
        console.warn(`Error processing Reed job:`, error);
      }
    });
    
    console.log(`✅ Reed working: Found ${jobs.length} jobs`);
    
  } catch (error) {
    console.warn(`Failed to scrape Reed working:`, error instanceof Error ? error.message : String(error));
  }
  
  return jobs;
}
