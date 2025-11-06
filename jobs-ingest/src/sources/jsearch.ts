import { CanonicalJob } from '../types';
import { toISO } from '../lib/normalize';
import { enhanceJobDescription } from '../lib/descriptionEnhancer';

/**
 * Scraper for RapidAPI JSearch
 * Searches for graduate jobs, internships, and placements in UK
 * Target: 50,000 jobs/month = ~1,667 jobs/day
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
      query: 'graduate jobs in uk',
      country: 'uk',
      page: '1',
      num_pages: '1',
      date_posted: 'month',
      employment_types: 'FULLTIME,INTERN',
      job_requirements: 'no_experience,under_3_years_experience'
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
      console.log(`🧪 Error: ${errorText.substring(0, 300)}`);
    }
  } catch (error) {
    console.log(`🧪 Broad test error:`, error instanceof Error ? error.message : String(error));
  }

  // Popular industries (priority - more searches)
  const popularIndustries = [
    'business', 'finance', 'engineering', 'accounting', 'marketing', 
    'consulting', 'it', 'technology', 'law', 'sales', 'data', 'analytics'
  ];

  // Other industries (lower priority - fewer searches)
  const otherIndustries = [
    'hr', 'human resources', 'operations', 'project management', 'supply chain',
    'pharmaceutical', 'healthcare', 'media', 'advertising', 'retail',
    'hospitality', 'tourism', 'education', 'research', 'science',
    'chemistry', 'physics', 'biology', 'mathematics', 'statistics',
    'architecture', 'design', 'civil engineering', 'mechanical engineering',
    'electrical engineering', 'software engineering', 'chemical engineering',
    'aerospace', 'automotive', 'energy', 'renewable energy', 'sustainability',
    'environmental', 'agriculture', 'food', 'manufacturing', 'logistics'
  ];

  // Job type prefixes
  const graduatePrefixes = ['graduate', 'graduate scheme', 'graduate program', 'graduate trainee', 'graduate entry'];
  const placementPrefixes = [
    'placement', 'industrial placement', 'placement year', 'year in industry',
    'industrial experience', 'sandwich placement', 'sandwich course', 'sandwich degree',
    'year placement', '12 month placement', 'co-op', 'cooperative placement'
  ];
  const internshipPrefixes = ['internship', 'summer internship', 'paid internship', 'graduate internship'];

  // Build comprehensive search terms
  // Priority industries get all combinations, others get core terms only
  const searchTerms: string[] = [];

  // Core general terms (high priority)
  searchTerms.push(
    'graduate jobs in uk',
    'graduate scheme uk',
    'graduate program uk',
    'entry level jobs uk',
    'junior jobs uk',
    'placement uk',
    'industrial placement uk',
    'year in industry uk',
    'internship uk',
    'summer internship uk'
  );

  // Popular industries: graduate + placement + internship for each
  for (const industry of popularIndustries) {
    // Graduate terms
    for (const prefix of graduatePrefixes.slice(0, 3)) { // Top 3 graduate prefixes
      searchTerms.push(`${prefix} ${industry} uk`);
      searchTerms.push(`${prefix} ${industry} jobs uk`);
    }
    
    // Placement terms (comprehensive)
    for (const prefix of placementPrefixes.slice(0, 6)) { // Top 6 placement prefixes
      searchTerms.push(`${prefix} ${industry} uk`);
      searchTerms.push(`${industry} ${prefix} uk`);
    }
    
    // Internship terms
    for (const prefix of internshipPrefixes.slice(0, 2)) { // Top 2 internship prefixes
      searchTerms.push(`${prefix} ${industry} uk`);
      searchTerms.push(`${industry} ${prefix} uk`);
    }
  }

  // Other industries: core terms only (graduate, placement, internship)
  for (const industry of otherIndustries) {
    searchTerms.push(`graduate ${industry} uk`);
    searchTerms.push(`placement ${industry} uk`);
    searchTerms.push(`${industry} placement uk`);
    searchTerms.push(`internship ${industry} uk`);
  }

  // Additional placement synonyms (standalone)
  const placementTerms = [
    'placement year in uk',
    'year in industry uk',
    'industrial placement uk',
    'sandwich placement uk',
    'sandwich course uk',
    'sandwich degree uk',
    'co-op uk',
    'cooperative placement uk',
    'work placement uk',
    'student placement uk',
    'professional placement uk',
    'industry placement uk',
    '12 month placement uk',
    'year long placement uk',
    'industrial year uk',
    'placement programme uk',
    'placement program uk'
  ];
  searchTerms.push(...placementTerms);

  // Location-specific searches for major UK cities (graduate, placement, internship)
  const majorCities = ['london', 'manchester', 'birmingham', 'leeds', 'glasgow', 'edinburgh', 'bristol', 'liverpool'];
  const cityJobTypes = ['graduate', 'placement', 'internship'];
  
  for (const city of majorCities) {
    for (const jobType of cityJobTypes) {
      searchTerms.push(`${jobType} jobs ${city} uk`);
      searchTerms.push(`${jobType} ${city} uk`);
    }
  }

  // Site-constrained targets (UK graduate boards)
  const sites = [
    { key: 'gradcracker', domain: 'gradcracker.com' },
    { key: 'targetjobs', domain: 'targetjobs.co.uk' },
    { key: 'prospects', domain: 'prospects.ac.uk' },
    { key: 'milkround', domain: 'milkround.com' },
    { key: 'brightnetwork', domain: 'brightnetwork.co.uk' },
    { key: 'higherin', domain: 'higherin.com' },
    { key: 'trackr', domain: 'the-trackr.com' }
  ];

  const jobsPerTerm: { [term: string]: number } = {};
  
  // Calculate daily limit: 50,000/month ≈ 1,667/day
  // Each search with num_pages=5 can return up to 50 jobs (5 pages × 10 jobs/page)
  // To hit quota: ~1,667 jobs/day ÷ 50 jobs/search ≈ 33 searches/day minimum
  // But we want more variety, so aim for ~200-250 searches/day to maximize quota usage
  // With pagination multiplier (2x for 2-10 pages), we can do more searches
  // Increased from 150 to 250 to better utilize the 50,000/month quota
  const MAX_SEARCHES_PER_DAY = 250;
  let totalSearches = 0;
  
  try {
    for (const term of searchTerms) {
      if (totalSearches >= MAX_SEARCHES_PER_DAY) {
        console.log(`  ⏸️  Reached daily search limit (${MAX_SEARCHES_PER_DAY}), stopping early`);
        break;
      }
      
      console.log(`  🔍 Searching JSearch for: "${term}"`);
      totalSearches++;
      
      try {
        // JSearch API parameters per documentation:
        // - query: Free-form search query (include job title and location)
        // - country: UK country code (uk)
        // - page: Starting page (1-50)
        // - num_pages: Number of pages (1-50, 2-10 pages charged 2x, >10 pages charged 3x)
        // - date_posted: all, today, 3days, week, month
        // - employment_types: FULLTIME, CONTRACTOR, PARTTIME, INTERN (comma-delimited)
        // - job_requirements: no_experience, under_3_years_experience, more_than_3_years_experience, no_degree (comma-delimited)
        const urlParams = new URLSearchParams({
          query: term,
          country: 'uk',
          page: '1',
          num_pages: '5', // 5 pages = 50 jobs max, charged 2x (worth it for coverage)
          date_posted: 'month', // Last 30 days
          employment_types: 'FULLTIME,INTERN', // Graduate roles and internships
          job_requirements: 'no_experience,under_3_years_experience' // Entry-level focus
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
          console.warn(`  📄 Error response: ${errorText.substring(0, 300)}`);
          continue;
        }

        const data = await response.json() as any;
        
        // JSearch typically returns { data: [...] }
        const jobArray = (data.data && Array.isArray(data.data)) ? data.data : [];
        
        const termJobsFound = jobArray.length;
        
        if (termJobsFound > 0) {
          console.log(`  📦 Found ${termJobsFound} jobs for "${term}"`);
          jobsPerTerm[term] = (jobsPerTerm[term] || 0) + termJobsFound;
          
          // Debug: Show first job to understand the data structure
          if (jobArray.length > 0) {
            const sampleJob = jobArray[0];
            console.log(`  🔍 Sample: ${sampleJob.job_title || sampleJob.title} at ${sampleJob.employer_name || sampleJob.company_name || 'Unknown'}`);
          }
          
          for (const job of jobArray) {
            try {
              // Get best apply URL from apply_options array (prefer direct links)
              let bestApplyUrl = job.job_apply_link || '';
              if (job.apply_options && Array.isArray(job.apply_options) && job.apply_options.length > 0) {
                // Prefer direct apply links
                const directLink = job.apply_options.find((opt: any) => opt.is_direct === true);
                if (directLink && directLink.apply_link) {
                  bestApplyUrl = directLink.apply_link;
                } else if (job.apply_options[0] && job.apply_options[0].apply_link) {
                  bestApplyUrl = job.apply_options[0].apply_link;
                }
              }
              
              // Get job description (may be missing for some jobs)
              const jobDescription = job.job_description || job.description || '';
              
              const canonicalJob: CanonicalJob = {
                title: job.job_title || job.title || 'Unknown Title',
                company: { name: job.employer_name || job.company_name || job.employer || 'Unknown Company' },
                location: job.job_city || job.job_location || job.location || job.job_state || 'UK',
                applyUrl: bestApplyUrl,
                descriptionText: jobDescription,
                descriptionHtml: jobDescription,
                source: 'JSearch API (via RapidAPI)',
                sourceUrl: 'https://rapidapi.com/letscrape-6bRBa3QguO5/api/jsearch',
                jobType: classifyJobType((job.job_title || job.title || '') + ' ' + jobDescription),
                salary: job.job_min_salary || job.job_max_salary ? {
                  min: job.job_min_salary,
                  max: job.job_max_salary,
                  currency: job.job_salary_currency || 'GBP'
                } : undefined,
                applyDeadline: job.job_posted_at_datetime_utc ? 
                  toISO(job.job_posted_at_datetime_utc) : undefined,
                slug: generateSlug(job.job_title || job.title, job.employer_name || job.company_name),
                hash: generateHash(
                  job.job_title || job.title, 
                  job.employer_name || job.company_name, 
                  job.job_id || job.id, 
                  bestApplyUrl
                )
              };

              // Filter for relevant job types (placement, graduate, or internship)
              // Location is already filtered by country=uk parameter
              const jobText = canonicalJob.title + ' ' + (canonicalJob.descriptionText || '');
              const jobType = classifyJobType(jobText);
              if (jobType === 'graduate' || jobType === 'placement' || jobType === 'internship') {
                // If description is missing or too short, enhance it from apply URL
                if (!canonicalJob.descriptionText || canonicalJob.descriptionText.length < 200) {
                  console.log(`  🔍 Enhancing description for: ${canonicalJob.title}`);
                  await enhanceJobDescription(canonicalJob);
                }
                jobs.push(canonicalJob);
              }
            } catch (error) {
              console.warn(`  ⚠️  Error processing job:`, error instanceof Error ? error.message : String(error));
            }
          }
        } else {
          console.log(`  📄 No jobs found for "${term}"`);
        }

        // Rate limiting - wait between requests (2 seconds to avoid hitting rate limits)
        await new Promise(resolve => setTimeout(resolve, 2000));
        
      } catch (error) {
        console.warn(`  ❌ Failed to search "${term}":`, error instanceof Error ? error.message : String(error));
      }
    }

  } catch (error) {
    console.warn('Failed to scrape JSearch API:', error instanceof Error ? error.message : String(error));
  }

  // Site-constrained queries to focus on specific UK boards
  // Use fewer searches per site to stay within daily limit
  try {
    const siteSearchTerms = [
      'graduate', 'graduate scheme', 'placement', 'industrial placement', 
      'year in industry', 'internship', 'summer internship'
    ];
    
    for (const site of sites) {
      for (const term of siteSearchTerms) {
        if (totalSearches >= MAX_SEARCHES_PER_DAY) {
          console.log(`  ⏸️  Reached daily search limit (${MAX_SEARCHES_PER_DAY}), stopping site searches`);
          break;
        }
        
        const query = `${term} site:${site.domain}`;
        console.log(`  🌐 Site search (${site.key}): "${query}"`);
        totalSearches++;
        
        try {
          // Site-constrained search with same filters
          const urlParams = new URLSearchParams({
            query: query, // Already includes site:domain
            country: 'uk',
            page: '1',
            num_pages: '4', // 4 pages = 40 jobs max, charged 2x
            date_posted: 'month',
            employment_types: 'FULLTIME,INTERN',
            job_requirements: 'no_experience,under_3_years_experience'
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
            console.warn(`    📄 Error response: ${errorText.substring(0, 300)}`);
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
              // Get best apply URL from apply_options array (prefer direct links)
              let bestApplyUrl = job.job_apply_link || '';
              if (job.apply_options && Array.isArray(job.apply_options) && job.apply_options.length > 0) {
                // Prefer direct apply links
                const directLink = job.apply_options.find((opt: any) => opt.is_direct === true);
                if (directLink && directLink.apply_link) {
                  bestApplyUrl = directLink.apply_link;
                } else if (job.apply_options[0] && job.apply_options[0].apply_link) {
                  bestApplyUrl = job.apply_options[0].apply_link;
                }
              }
              
              // Get job description (may be missing for some jobs)
              const jobDescription = job.job_description || job.description || '';
              
              const canonicalJob: CanonicalJob = {
                title: job.job_title || job.title || 'Unknown Title',
                company: { name: job.employer_name || job.company_name || job.employer || 'Unknown Company' },
                location: job.job_city || job.job_location || job.location || job.job_state || 'UK',
                applyUrl: bestApplyUrl,
                descriptionText: jobDescription,
                descriptionHtml: jobDescription,
                source: `JSearch API (${site.key})`,
                sourceUrl: `https://jsearch.p.rapidapi.com/search?site=${site.domain}`,
                jobType: classifyJobType((job.job_title || job.title || '') + ' ' + jobDescription),
                salary: job.job_min_salary || job.job_max_salary ? {
                  min: job.job_min_salary,
                  max: job.job_max_salary,
                  currency: job.job_salary_currency || 'GBP'
                } : undefined,
                applyDeadline: job.job_posted_at_datetime_utc ? 
                  toISO(job.job_posted_at_datetime_utc) : undefined,
                slug: generateSlug(job.job_title || job.title, job.employer_name || job.company_name),
                hash: generateHash(
                  job.job_title || job.title, 
                  job.employer_name || job.company_name, 
                  job.job_id || job.id, 
                  bestApplyUrl
                )
              };

              const jobText = canonicalJob.title + ' ' + (canonicalJob.descriptionText || '');
              const jobType = classifyJobType(jobText);
              if (jobType === 'graduate' || jobType === 'placement' || jobType === 'internship') {
                // If description is missing or too short, enhance it from apply URL
                if (!canonicalJob.descriptionText || canonicalJob.descriptionText.length < 200) {
                  console.log(`    🔍 Enhancing description for: ${canonicalJob.title}`);
                  await enhanceJobDescription(canonicalJob);
                }
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
      .slice(0, 30); // Show top 30 terms
    sortedTerms.forEach(([term, count]) => {
      console.log(`  "${term}": ${count} jobs`);
    });
    const totalJobsFromAPI = Object.values(jobsPerTerm).reduce((sum, count) => sum + count, 0);
    console.log(`  📈 Total jobs from API: ${totalJobsFromAPI}`);
    console.log(`  📉 After filtering: ${jobs.length} relevant jobs`);
    console.log(`  🔢 Total searches performed: ${totalSearches}`);
  }

  console.log(`📊 JSearch API: Found ${jobs.length} total jobs`);
  return jobs;
}

function classifyJobType(text: string): 'internship' | 'placement' | 'graduate' | 'other' {
  const t = text.toLowerCase();
  
  // Check for internship first (more specific)
  if (t.includes('internship') || t.includes('intern')) {
    return 'internship';
  }
  
  // Comprehensive placement detection (all synonyms)
  const placementKeywords = [
    'placement',
    'year in industry',
    'industrial placement',
    'industrial experience',
    'sandwich course',
    'sandwich degree',
    'sandwich year',
    'sandwich placement',
    'thick sandwich',
    'thin sandwich',
    'work experience placement',
    'work placement',
    'industry placement',
    'professional placement',
    'student placement',
    'placement year',
    'year placement',
    '12 month placement',
    'year long placement',
    'co-op',
    'coop',
    'cooperative placement',
    'co-operative education',
    'practicum',
    'industrial year',
    'placement opportunity',
    'work-based learning',
    'work integrated learning',
    'professional year',
    'industry year',
    'placement programme',
    'placement program',
    'industrial year out',
    'year out placement',
    'work experience year',
    'industrial training',
    'professional training year'
  ];
  
  if (placementKeywords.some(keyword => t.includes(keyword))) {
    return 'placement';
  }
  
  // Graduate/entry-level roles
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

function generateHash(title: string, company: string, id?: string, applyUrl?: string): string {
  // Include applyUrl in hash to make it more unique (same job might have different IDs from different sources)
  const urlPart = applyUrl ? applyUrl.split('?')[0] : ''; // Remove query params for consistency
  const content = `${title}-${company}-${id || 'no-id'}-${urlPart}`;
  // Use longer hash (32 chars) to reduce collisions
  return Buffer.from(content).toString('base64').slice(0, 32);
}
