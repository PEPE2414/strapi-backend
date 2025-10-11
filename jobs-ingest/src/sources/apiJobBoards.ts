import { request } from 'undici';
import { CanonicalJob } from '../types';
import { resolveApplyUrl } from '../lib/applyUrl';
import { sha256 } from '../lib/hash';
import { makeUniqueSlug } from '../lib/slug';
import { classifyJobType, toISO, isRelevantJobType, isUKJob } from '../lib/normalize';

/**
 * Adzuna API - Free API for UK job listings
 * Get API keys from: https://developer.adzuna.com/
 */
export async function scrapeAdzunaAPI(): Promise<CanonicalJob[]> {
  const jobs: CanonicalJob[] = [];
  const APP_ID = process.env.ADZUNA_APP_ID || ''; // Set in environment
  const APP_KEY = process.env.ADZUNA_APP_KEY || ''; // Set in environment
  
  if (!APP_ID || !APP_KEY) {
    console.warn('⚠️  Adzuna API credentials not set. Set ADZUNA_APP_ID and ADZUNA_APP_KEY environment variables.');
    console.log('📝 Get free API keys from: https://developer.adzuna.com/');
    return jobs;
  }

  // Search terms that cover graduate/entry-level jobs
  const searchTerms = [
    'graduate',
    'internship',
    'entry level',
    'placement year',
    'year in industry',
    'industrial placement',
    'trainee',
    'junior',
    'graduate scheme'
  ];

  try {
    for (const term of searchTerms) {
      // Adzuna supports pagination, fetch multiple pages
      for (let page = 1; page <= 5; page++) {
        const url = `https://api.adzuna.com/v1/api/jobs/gb/search/${page}?app_id=${APP_ID}&app_key=${APP_KEY}&results_per_page=50&what=${encodeURIComponent(term)}&max_days_old=7&sort_by=date`;
        
        console.log(`🔄 Fetching Adzuna page ${page} for "${term}"...`);
        
        const { body } = await request(url);
        const data = await body.json() as any;
        
        if (!data.results || data.results.length === 0) {
          console.log(`📄 No more results for "${term}" on page ${page}`);
          break;
        }
        
        console.log(`📊 Found ${data.results.length} jobs for "${term}" (page ${page})`);
        
        for (const job of data.results) {
          try {
            const title = job.title?.trim() || '';
            const companyName = job.company?.display_name || 'Unknown';
            const location = job.location?.display_name || job.location?.area?.join(', ') || '';
            const description = job.description || '';
            
            // Apply filters
            const fullText = `${title} ${description} ${location}`;
            if (!isRelevantJobType(fullText) || !isUKJob(fullText)) {
              continue;
            }
            
            const applyUrl = job.redirect_url || `https://www.adzuna.co.uk/details/${job.id}`;
            const hash = sha256([title, companyName, applyUrl].join('|'));
            const slug = makeUniqueSlug(title, companyName, hash, location);
            
            const canonicalJob: CanonicalJob = {
              source: 'adzuna-api',
              sourceUrl: applyUrl,
              title,
              company: { name: companyName },
              location,
              descriptionHtml: description,
              descriptionText: undefined,
              applyUrl,
              applyDeadline: undefined,
              jobType: classifyJobType(title),
              salary: job.salary_min && job.salary_max 
                ? { min: job.salary_min, max: job.salary_max, currency: 'GBP', period: 'year' }
                : undefined,
              startDate: undefined,
              endDate: undefined,
              duration: job.contract_type || job.contract_time || undefined,
              experience: undefined,
              companyPageUrl: undefined,
              relatedDegree: undefined,
              degreeLevel: ['UG'],
              postedAt: job.created ? toISO(job.created) : new Date().toISOString(),
              slug,
              hash
            };
            
            jobs.push(canonicalJob);
          } catch (error) {
            console.warn(`Error processing Adzuna job:`, error);
          }
        }
        
        // Rate limiting - be respectful
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // If we got fewer results than requested, stop pagination
        if (data.results.length < 50) {
          break;
        }
      }
      
      // Delay between search terms
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
    
    console.log(`✅ Adzuna API: Found ${jobs.length} jobs`);
    return jobs;
    
  } catch (error) {
    console.error('Failed to scrape Adzuna API:', error instanceof Error ? error.message : String(error));
    return jobs;
  }
}

/**
 * Reed API - UK job board with free API access
 * Get API key from: https://www.reed.co.uk/developers
 */
export async function scrapeReedAPI(): Promise<CanonicalJob[]> {
  const jobs: CanonicalJob[] = [];
  const API_KEY = process.env.REED_API_KEY || ''; // Set in environment
  
  if (!API_KEY) {
    console.warn('⚠️  Reed API key not set. Set REED_API_KEY environment variable.');
    console.log('📝 Get free API key from: https://www.reed.co.uk/developers');
    return jobs;
  }

  const keywords = [
    'graduate',
    'internship', 
    'entry level',
    'placement year',
    'year in industry',
    'industrial placement',
    'trainee',
    'junior'
  ];

  try {
    for (const keyword of keywords) {
      // Reed API supports pagination with resultsToSkip
      for (let resultsToSkip = 0; resultsToSkip < 500; resultsToSkip += 100) {
        const url = `https://www.reed.co.uk/api/1.0/search?keywords=${encodeURIComponent(keyword)}&locationName=UK&distanceFromLocation=30&postedByRecruitmentAgency=false&resultsToTake=100&resultsToSkip=${resultsToSkip}`;
        
        console.log(`🔄 Fetching Reed API: "${keyword}" (skip ${resultsToSkip})...`);
        
        // Reed API uses Basic Auth with API key as username
        const authHeader = `Basic ${Buffer.from(`${API_KEY}:`).toString('base64')}`;
        
        const { body } = await request(url, {
          headers: {
            'Authorization': authHeader
          }
        });
        
        const data = await body.json() as any;
        
        if (!data.results || data.results.length === 0) {
          console.log(`📄 No more results for "${keyword}" at skip ${resultsToSkip}`);
          break;
        }
        
        console.log(`📊 Found ${data.results.length} jobs for "${keyword}" (total available: ${data.totalResults})`);
        
        for (const job of data.results) {
          try {
            const title = job.jobTitle?.trim() || '';
            const companyName = job.employerName || 'Unknown';
            const location = job.locationName || '';
            const description = job.jobDescription || '';
            
            // Apply filters
            const fullText = `${title} ${description} ${location}`;
            if (!isRelevantJobType(fullText) || !isUKJob(fullText)) {
              continue;
            }
            
            const applyUrl = job.jobUrl || `https://www.reed.co.uk/jobs/${job.jobId}`;
            const hash = sha256([title, companyName, applyUrl].join('|'));
            const slug = makeUniqueSlug(title, companyName, hash, location);
            
            const canonicalJob: CanonicalJob = {
              source: 'reed-api',
              sourceUrl: applyUrl,
              title,
              company: { name: companyName },
              location,
              descriptionHtml: description,
              descriptionText: undefined,
              applyUrl,
              applyDeadline: undefined,
              jobType: classifyJobType(title),
              salary: job.minimumSalary && job.maximumSalary
                ? { min: job.minimumSalary, max: job.maximumSalary, currency: 'GBP', period: 'year' }
                : undefined,
              startDate: undefined,
              endDate: undefined,
              duration: job.contractType || undefined,
              experience: undefined,
              companyPageUrl: undefined,
              relatedDegree: undefined,
              degreeLevel: ['UG'],
              postedAt: job.datePosted ? toISO(job.datePosted) : new Date().toISOString(),
              slug,
              hash
            };
            
            jobs.push(canonicalJob);
          } catch (error) {
            console.warn(`Error processing Reed job:`, error);
          }
        }
        
        // Rate limiting
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // If we got fewer results than requested, stop pagination
        if (data.results.length < 100) {
          break;
        }
      }
      
      // Delay between keywords
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
    
    console.log(`✅ Reed API: Found ${jobs.length} jobs`);
    return jobs;
    
  } catch (error) {
    console.error('Failed to scrape Reed API:', error instanceof Error ? error.message : String(error));
    return jobs;
  }
}

/**
 * The Muse API - Career advice and job listings
 * Free API, no key required
 */
export async function scrapeTheMuseAPI(): Promise<CanonicalJob[]> {
  const jobs: CanonicalJob[] = [];

  try {
    // The Muse API supports pagination
    for (let page = 0; page < 10; page++) {
      const url = `https://www.themuse.com/api/public/jobs?category=Engineering+&+IT,Business+&+Strategy&level=Entry+Level,Internship&location=United+Kingdom&page=${page}`;
      
      console.log(`🔄 Fetching The Muse API page ${page}...`);
      
      const { body } = await request(url);
      const data = await body.json() as any;
      
      if (!data.results || data.results.length === 0) {
        console.log(`📄 No more results on page ${page}`);
        break;
      }
      
      console.log(`📊 Found ${data.results.length} jobs (page ${page})`);
      
      for (const job of data.results) {
        try {
          const title = job.name?.trim() || '';
          const companyName = job.company?.name || 'Unknown';
          const location = job.locations?.[0]?.name || '';
          const description = job.contents || '';
          
          // Apply filters - The Muse is already filtered for UK
          const fullText = `${title} ${description} ${location}`;
          if (!isRelevantJobType(fullText)) {
            continue;
          }
          
          const applyUrl = job.refs?.landing_page || `https://www.themuse.com/jobs/${job.id}`;
          const hash = sha256([title, companyName, applyUrl].join('|'));
          const slug = makeUniqueSlug(title, companyName, hash, location);
          
          const canonicalJob: CanonicalJob = {
            source: 'themuse-api',
            sourceUrl: applyUrl,
            title,
            company: { name: companyName },
            location,
            descriptionHtml: description,
            descriptionText: undefined,
            applyUrl,
            applyDeadline: undefined,
            jobType: classifyJobType(title),
            salary: undefined,
            startDate: undefined,
            endDate: undefined,
            duration: undefined,
            experience: job.levels?.[0]?.name || undefined,
            companyPageUrl: job.company?.refs?.landing_page || undefined,
            relatedDegree: undefined,
            degreeLevel: ['UG'],
            postedAt: job.publication_date ? toISO(job.publication_date) : new Date().toISOString(),
            slug,
            hash
          };
          
          jobs.push(canonicalJob);
        } catch (error) {
          console.warn(`Error processing The Muse job:`, error);
        }
      }
      
      // Rate limiting
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Check if we've exhausted results
      if (data.results.length < data.page_size) {
        break;
      }
    }
    
    console.log(`✅ The Muse API: Found ${jobs.length} jobs`);
    return jobs;
    
  } catch (error) {
    console.error('Failed to scrape The Muse API:', error instanceof Error ? error.message : String(error));
    return jobs;
  }
}

/**
 * Jobs.ac.uk API - UK academic and research jobs
 * Free API access
 */
export async function scrapeJobsAcUkAPI(): Promise<CanonicalJob[]> {
  const jobs: CanonicalJob[] = [];

  try {
    // Jobs.ac.uk supports RSS feeds which we can parse
    const categories = [
      'graduate-training',
      'research-technical',
      'executive-management'
    ];
    
    for (const category of categories) {
      for (let page = 1; page <= 10; page++) {
        const url = `https://www.jobs.ac.uk/search/?category=${category}&location=UK&page=${page}&resultsPP=100`;
        
        console.log(`🔄 Fetching jobs.ac.uk category "${category}" page ${page}...`);
        
        const { body } = await request(url, {
          headers: {
            'Accept': 'application/json'
          }
        });
        
        let data: any;
        try {
          data = await body.json();
        } catch {
          // If JSON fails, it might be HTML - skip
          console.log(`⏭️  Skipping ${category} page ${page} (not JSON)`);
          break;
        }
        
        if (!data || !data.jobs || data.jobs.length === 0) {
          console.log(`📄 No more results for "${category}" on page ${page}`);
          break;
        }
        
        console.log(`📊 Found ${data.jobs.length} jobs for "${category}" (page ${page})`);
        
        for (const job of data.jobs) {
          try {
            const title = job.title?.trim() || '';
            const companyName = job.employer || job.institution || 'Unknown';
            const location = job.location || '';
            const description = job.description || job.summary || '';
            
            // Apply filters
            const fullText = `${title} ${description} ${location}`;
            if (!isRelevantJobType(fullText) || !isUKJob(fullText)) {
              continue;
            }
            
            const applyUrl = job.url || `https://www.jobs.ac.uk/job/${job.id}`;
            const hash = sha256([title, companyName, applyUrl].join('|'));
            const slug = makeUniqueSlug(title, companyName, hash, location);
            
            const canonicalJob: CanonicalJob = {
              source: 'jobsacuk-api',
              sourceUrl: applyUrl,
              title,
              company: { name: companyName },
              location,
              descriptionHtml: description,
              descriptionText: undefined,
              applyUrl,
              applyDeadline: job.closingDate ? toISO(job.closingDate) : undefined,
              jobType: classifyJobType(title),
              salary: job.salary || undefined,
              startDate: job.startDate ? toISO(job.startDate) : undefined,
              endDate: undefined,
              duration: job.duration || undefined,
              experience: undefined,
              companyPageUrl: undefined,
              relatedDegree: undefined,
              degreeLevel: ['UG', 'PG-taught'],
              postedAt: job.postedDate ? toISO(job.postedDate) : new Date().toISOString(),
              slug,
              hash
            };
            
            jobs.push(canonicalJob);
          } catch (error) {
            console.warn(`Error processing jobs.ac.uk job:`, error);
          }
        }
        
        // Rate limiting
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // If we got fewer results than requested, stop pagination
        if (data.jobs.length < 100) {
          break;
        }
      }
      
      // Delay between categories
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
    
    console.log(`✅ Jobs.ac.uk API: Found ${jobs.length} jobs`);
    return jobs;
    
  } catch (error) {
    console.error('Failed to scrape jobs.ac.uk API:', error instanceof Error ? error.message : String(error));
    return jobs;
  }
}

/**
 * Master function to scrape all API-based job boards
 */
export async function scrapeAllAPIJobBoards(): Promise<CanonicalJob[]> {
  console.log('🚀 Starting API-based job board scraping...');
  const allJobs: CanonicalJob[] = [];

  // Run all scrapers in sequence (to avoid overwhelming APIs)
  const scrapers = [
    { name: 'Adzuna', fn: scrapeAdzunaAPI },
    { name: 'Reed', fn: scrapeReedAPI },
    { name: 'The Muse', fn: scrapeTheMuseAPI },
    { name: 'Jobs.ac.uk', fn: scrapeJobsAcUkAPI }
  ];

  for (const scraper of scrapers) {
    try {
      console.log(`\n📦 Scraping ${scraper.name} API...`);
      const jobs = await scraper.fn();
      allJobs.push(...jobs);
      console.log(`✅ ${scraper.name}: ${jobs.length} jobs added (Total: ${allJobs.length})`);
    } catch (error) {
      console.error(`❌ ${scraper.name} failed:`, error instanceof Error ? error.message : String(error));
    }
    
    // Delay between different APIs
    await new Promise(resolve => setTimeout(resolve, 3000));
  }

  console.log(`\n🎉 API job board scraping completed: ${allJobs.length} total jobs`);
  return allJobs;
}


