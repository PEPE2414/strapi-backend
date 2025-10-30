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
    const testUrl = `https://jsearch.p.rapidapi.com/search?query=graduate&location=United%20Kingdom&page=1&num_pages=1`;
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

  // Search terms for graduate jobs and placements
  const searchTerms = [
    'graduate',
    'graduate scheme', 
    'graduate program',
    'graduate role',
    'graduate position',
    'entry level',
    'placement',
    'industrial placement',
    'placement year',
    'year in industry',
    'work experience placement',
    'sandwich course',
    'sandwich degree',
    'internship',
    'summer internship',
    'junior'
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

  try {
    for (const term of searchTerms) {
      console.log(`  🔍 Searching JSearch for: "${term}" (UK-wide)`);
      
      try {
        // JSearch API endpoint with query parameters
        const encodedTerm = encodeURIComponent(term);
        const url = `https://jsearch.p.rapidapi.com/search?query=${encodedTerm}&location=United%20Kingdom&page=1&num_pages=2`;
        
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
        
        if (jobArray.length > 0) {
          console.log(`  📦 Found ${jobArray.length} jobs for "${term}"`);
          
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
  try {
    for (const site of sites) {
      for (const term of searchTerms.slice(0, 6)) { // keep it lean per site
        const query = `${term} site:${site.domain}`;
        console.log(`  🌐 Site search (${site.key}): "${query}"`);
        try {
          const encodedQuery = encodeURIComponent(query);
          const url = `https://jsearch.p.rapidapi.com/search?query=${encodedQuery}&location=United%20Kingdom&page=1&num_pages=2`;
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

          if (jobArray.length > 0) {
            console.log(`    📦 ${site.key}: ${jobArray.length} jobs for "${term}"`);
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

