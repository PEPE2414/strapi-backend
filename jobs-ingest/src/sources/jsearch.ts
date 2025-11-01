import { CanonicalJob } from '../types';
import { toISO } from '../lib/normalize';

/**
 * Scraper for RapidAPI JSearch
 * Searches for graduate jobs, internships, and placements in UK
 */
export async function scrapeJSearch(): Promise<CanonicalJob[]> {
  const jobs: CanonicalJob[] = [];
  
  if (!process.env.RAPIDAPI_KEY) {
    console.warn('⚠️  RAPIDAPI_KEY is not set. Skipping JSearch API.');
    return [];
  }

  console.log('🔄 Scraping JSearch API...');

  // First, test with a very broad search to see if the API has any jobs
  console.log('🧪 Testing JSearch API with broad search...');
  try {
    const testParams = new URLSearchParams({
      query: 'graduate',
      location: 'United Kingdom',
      page: '1',
      num_pages: '1',
      job_requirements: 'entry_level',
      date_posted: 'month',
      employment_types: 'fulltime,internship',
      jobs_per_page: '20'
    });
    const testUrl = `https://jsearch.p.rapidapi.com/search?${testParams.toString()}`;
    const testResponse = await fetch(testUrl, {
      method: 'GET',
      headers: {
        'X-RapidAPI-Key': process.env.RAPIDAPI_KEY!,
        'X-RapidAPI-Host': 'jsearch.p.rapidapi.com'
      }
    });
    
    if (testResponse.ok) {
      const testData = await testResponse.json() as any;
      const testJobArray = testData.data && Array.isArray(testData.data) ? testData.data : [];
      console.log(`🧪 Broad test found ${testJobArray.length} total jobs in UK`);
      if (testJobArray.length > 0) {
        const sampleJob = testJobArray[0];
        console.log(`🧪 Sample: ${sampleJob.job_title || sampleJob.title} at ${sampleJob.employer_name || sampleJob.company_name || 'Unknown'}`);
      }
    } else {
      console.log(`🧪 Broad test failed: ${testResponse.status}`);
      const errorText = await testResponse.text();
      console.log(`🧪 Error: ${errorText.substring(0, 200)}`);
    }
  } catch (error) {
    console.log(`🧪 Broad test error:`, error instanceof Error ? error.message : String(error));
  }

  // Expanded search terms for graduate jobs and placements
  // Target: 50,000 jobs/month = ~1,667 jobs/day
  // Strategy: Expand terms, increase pagination, use location/city searches
  const searchTerms = [
    // Core graduate terms
    'graduate',
    'graduate scheme', 
    'graduate program',
    'graduate role',
    'graduate position',
    'graduate trainee',
    'graduate analyst',
    'graduate engineer',
    'graduate consultant',
    'graduate developer',
    'graduate accountant',
    'graduate marketing',
    'graduate sales',
    'graduate finance',
    'graduate hr',
    'graduate it',
    'graduate business',
    'graduate management',
    'graduate operations',
    
    // Entry level and junior
    'entry level',
    'junior',
    'trainee',
    'apprentice',
    
    // Placement terms
    'placement',
    'industrial placement',
    'placement year',
    'year in industry',
    'work experience placement',
    'student placement',
    'sandwich course',
    'sandwich degree',
    'year placement',
    '12 month placement',
    'year long placement',
    
    // Internship terms
    'internship',
    'summer internship',
    'winter internship',
    'paid internship',
    'graduate internship',
    
    // Additional variations
    'new graduate',
    'recent graduate',
    'graduate entry',
    'graduate level',
    'graduate scheme 2024',
    'graduate scheme 2025',
    'graduate program 2024',
    'graduate program 2025'
  ];

  // Site-constrained targets (UK graduate boards)
  const sites = [
    { key: 'gradcracker', domain: 'gradcracker.com' },
    { key: 'targetjobs', domain: 'targetjobs.co.uk' },
    { key: 'prospects', domain: 'prospects.ac.uk' },
    { key: 'milkround', domain: 'milkround.com' },
    { key: 'brightnetwork', domain: 'brightnetwork.co.uk' },
    { key: 'higherin', domain: 'higherin.com' }
  ];

  const jobsPerTerm: { [term: string]: number } = {};
  const MAX_SEARCHES_PER_DAY = 200; // Conservative limit for JSearch (higher limit than LinkedIn)
  let totalSearches = 0;
  
  try {
    for (const term of searchTerms) {
      if (totalSearches >= MAX_SEARCHES_PER_DAY) {
        console.log(`  ⏸️  Reached daily search limit (${MAX_SEARCHES_PER_DAY}), stopping early`);
        break;
      }
      
      console.log(`  🔍 Searching JSearch for: "${term}" (UK-wide)`);
      totalSearches++;
      
      try {
        // JSearch API endpoint with optimized query parameters
        // Parameters used:
        // - query: Search term for job title/keywords
        // - location: Geographic location filter (United Kingdom)
        // - page: Starting page number
        // - num_pages: Number of pages to fetch (maximize for quota)
        // - job_requirements: Filter by experience level (entry_level for graduates)
        // - date_posted: Filter by posting date (month = last 30 days, gets fresh jobs)
        // - employment_types: Filter job types (fulltime, internship for graduates)
        // - jobs_per_page: Results per page (default 10, max typically 20-30)
        const encodedTerm = encodeURIComponent(term);
        
        // Build URL with additional filters for better targeting
        const urlParams = new URLSearchParams({
          query: term,
          location: 'United Kingdom',
          page: '1',
          num_pages: '5',
          job_requirements: 'entry_level', // Focus on entry-level roles
          date_posted: 'month', // Get jobs posted in last 30 days
          employment_types: 'fulltime,internship', // Include full-time and internships
          jobs_per_page: '20' // More results per page
        });
        
        const url = `https://jsearch.p.rapidapi.com/search?${urlParams.toString()}`;
        
        const response = await fetch(url, {
          method: 'GET',
          headers: {
            'X-RapidAPI-Key': process.env.RAPIDAPI_KEY!,
            'X-RapidAPI-Host': 'jsearch.p.rapidapi.com'
          }
        });

        if (!response.ok) {
          const errorText = await response.text();
          console.warn(`  ⚠️  JSearch API request failed: ${response.status} ${response.statusText}`);
          console.warn(`  📄 Error response: ${errorText.substring(0, 200)}`);
          continue;
        }

        const data = await response.json() as any;
        
        // JSearch typically returns { data: [...] }
        const jobArray = (data.data && Array.isArray(data.data)) ? data.data : [];
        
        const termJobsFound = jobArray.length;
        
        if (termJobsFound > 0) {
          console.log(`  📦 Found ${termJobsFound} jobs for "${term}"`);
          jobsPerTerm[term] = (jobsPerTerm[term] || 0) + termJobsFound;
          
          // Debug: Show first few jobs to understand the data structure
          if (jobArray.length > 0) {
            const sampleJob = jobArray[0];
            console.log(`  🔍 Sample job: ${sampleJob.job_title || sampleJob.title} at ${sampleJob.employer_name || sampleJob.company_name || 'Unknown'}`);
          }
          
          for (const job of jobArray) {
            try {
              const canonicalJob: CanonicalJob = {
                title: job.job_title || job.title || 'Unknown Title',
                company: { name: job.employer_name || job.company_name || job.employer || 'Unknown Company' },
                location: job.job_city || job.job_state || job.location || job.job_location || 'UK',
                applyUrl: job.job_apply_link || job.apply_url || job.job_url || job.url || '',
                descriptionText: job.job_description || job.description || job.job_highlights?.summary?.[0] || '',
                descriptionHtml: job.job_description || job.description || '',
                source: 'JSearch API (via RapidAPI)',
                sourceUrl: 'https://rapidapi.com/letscrape-6bRBa3QguO5/api/jsearch',
                jobType: classifyJobType((job.job_title || job.title || '') + ' ' + (job.job_description || job.description || '')),
                salary: job.job_min_salary || job.job_max_salary ? {
                  min: job.job_min_salary,
                  max: job.job_max_salary,
                  currency: job.job_salary_currency || 'GBP'
                } : undefined,
                applyDeadline: job.job_posted_at_datetime_utc || job.job_posted_at || job.posted_at ? 
                  toISO(job.job_posted_at_datetime_utc || job.job_posted_at || job.posted_at) : undefined,
                slug: generateSlug(job.job_title || job.title, job.employer_name || job.company_name),
                hash: generateHash(job.job_title || job.title, job.employer_name || job.company_name, job.job_id || job.id)
              };

              // Filter for relevant job types (placement, graduate, or internship)
              // Location is already filtered by API parameter (United Kingdom)
              const jobText = canonicalJob.title + ' ' + (canonicalJob.descriptionText || '');
              const jobType = classifyJobType(jobText);
              if (jobType === 'graduate' || jobType === 'placement' || jobType === 'internship') {
                jobs.push(canonicalJob);
              }
            } catch (error) {
              console.warn(`  ⚠️  Error processing job:`, error instanceof Error ? error.message : String(error));
            }
          }
        } else {
          console.log(`  📄 No jobs found for "${term}"`);
          // Debug: Show the actual response structure
          console.log(`  🔍 Response structure:`, JSON.stringify(data).substring(0, 200));
        }

        // Rate limiting - wait between requests
        await new Promise(resolve => setTimeout(resolve, 2000));
        
      } catch (error) {
        console.warn(`  ❌ Failed to search "${term}":`, error instanceof Error ? error.message : String(error));
      }
    }

  } catch (error) {
    console.warn('Failed to scrape JSearch API:', error instanceof Error ? error.message : String(error));
  }

  // Site-constrained queries to focus on specific UK boards
  // Maximize site searches to get more targeted results
  try {
    for (const site of sites) {
      for (const term of searchTerms.slice(0, 10)) { // Increase to 10 terms per site
        if (totalSearches >= MAX_SEARCHES_PER_DAY) {
          console.log(`  ⏸️  Reached daily search limit (${MAX_SEARCHES_PER_DAY}), stopping site searches`);
          break;
        }
        
        const query = `${term} site:${site.domain}`;
        console.log(`  🌐 Site search (${site.key}): "${query}"`);
        totalSearches++;
        
        try {
          // Site-constrained search with optimized parameters
          // Same filters as UK-wide but with site:domain in query
          const urlParams = new URLSearchParams({
            query: query, // Already includes site:domain
            location: 'United Kingdom',
            page: '1',
            num_pages: '4',
            job_requirements: 'entry_level', // Focus on entry-level roles
            date_posted: 'month', // Get jobs posted in last 30 days
            employment_types: 'fulltime,internship', // Include full-time and internships
            jobs_per_page: '20' // More results per page
          });
          
          const url = `https://jsearch.p.rapidapi.com/search?${urlParams.toString()}`;
          const response = await fetch(url, {
            method: 'GET',
            headers: {
              'X-RapidAPI-Key': process.env.RAPIDAPI_KEY!,
              'X-RapidAPI-Host': 'jsearch.p.rapidapi.com'
            }
          });

          if (!response.ok) {
            const errorText = await response.text();
            console.warn(`    ⚠️  JSearch site request failed: ${response.status} ${response.statusText}`);
            console.warn(`    📄 Error response: ${errorText.substring(0, 200)}`);
            continue;
          }

          const data = await response.json() as any;
          const jobArray = (data.data && Array.isArray(data.data)) ? data.data : [];

          const siteTermJobs = jobArray.length;
          if (siteTermJobs > 0) {
            console.log(`    📦 ${site.key}: ${siteTermJobs} jobs for "${term}"`);
            const siteTermKey = `${site.key}:${term}`;
            jobsPerTerm[siteTermKey] = (jobsPerTerm[siteTermKey] || 0) + siteTermJobs;
          }

          for (const job of jobArray) {
            try {
              const canonicalJob: CanonicalJob = {
                title: job.job_title || job.title || 'Unknown Title',
                company: { name: job.employer_name || job.company_name || job.employer || 'Unknown Company' },
                location: job.job_city || job.job_state || job.location || job.job_location || 'UK',
                applyUrl: job.job_apply_link || job.apply_url || job.job_url || job.url || '',
                descriptionText: job.job_description || job.description || job.job_highlights?.summary?.[0] || '',
                descriptionHtml: job.job_description || job.description || '',
                source: `JSearch API (${site.key})`,
                sourceUrl: `https://jsearch.p.rapidapi.com/search?site=${site.domain}`,
                jobType: classifyJobType((job.job_title || job.title || '') + ' ' + (job.job_description || job.description || '')),
                salary: job.job_min_salary || job.job_max_salary ? {
                  min: job.job_min_salary,
                  max: job.job_max_salary,
                  currency: job.job_salary_currency || 'GBP'
                } : undefined,
                applyDeadline: job.job_posted_at_datetime_utc || job.job_posted_at || job.posted_at ? 
                  toISO(job.job_posted_at_datetime_utc || job.job_posted_at || job.posted_at) : undefined,
                slug: generateSlug(job.job_title || job.title, job.employer_name || job.company_name),
                hash: generateHash(job.job_title || job.title, job.employer_name || job.company_name, job.job_id || job.id)
              };

              const jobText = canonicalJob.title + ' ' + (canonicalJob.descriptionText || '');
              const jobType = classifyJobType(jobText);
              if (jobType === 'graduate' || jobType === 'placement' || jobType === 'internship') {
                jobs.push(canonicalJob);
              }
            } catch (error) {
              console.warn(`    ⚠️  Error processing site job:`, error instanceof Error ? error.message : String(error));
            }
          }

          await new Promise(resolve => setTimeout(resolve, 1500));
        } catch (error) {
          console.warn(`    ❌ Failed site search (${site.key}):`, error instanceof Error ? error.message : String(error));
        }
      }
    }
  } catch (error) {
    console.warn('Failed site-constrained JSearch:', error instanceof Error ? error.message : String(error));
  }

  // Summary: Show jobs per term
  if (Object.keys(jobsPerTerm).length > 0) {
    console.log(`\n📊 JSearch Summary:`);
    const sortedTerms = Object.entries(jobsPerTerm)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 20); // Show top 20 terms
    sortedTerms.forEach(([term, count]) => {
      console.log(`  "${term}": ${count} jobs`);
    });
    const totalJobsFromAPI = Object.values(jobsPerTerm).reduce((sum, count) => sum + count, 0);
    console.log(`  📈 Total jobs from API: ${totalJobsFromAPI}`);
    console.log(`  📉 After filtering: ${jobs.length} relevant jobs`);
  }

  console.log(`📊 JSearch API: Found ${jobs.length} total jobs`);
  return jobs;
}

function classifyJobType(text: string): 'internship' | 'placement' | 'graduate' | 'other' {
  const t = text.toLowerCase();
  
  if (t.includes('internship') || t.includes('intern')) {
    return 'internship';
  }
  if (t.includes('placement') || t.includes('year in industry') || t.includes('industrial placement') || 
      t.includes('sandwich course') || t.includes('sandwich degree') || t.includes('work experience placement')) {
    return 'placement';
  }
  if (t.includes('graduate') || t.includes('entry level') || t.includes('junior')) {
    return 'graduate';
  }
  
  return 'other';
}

function generateSlug(title: string, company: string): string {
  const slug = `${title}-${company}`.toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
  
  return `${slug}-${Date.now()}`;
}

function generateHash(title: string, company: string, id?: string): string {
  const content = `${title}-${company}-${id || Date.now()}`;
  return Buffer.from(content).toString('base64').slice(0, 16);
}

