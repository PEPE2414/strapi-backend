import { CanonicalJob } from '../types';
import { toISO, classifyJobType } from '../lib/normalize';
import { enhanceJobDescription } from '../lib/descriptionEnhancer';
import { SLOT_DEFINITIONS, getCurrentRunSlot, isBacklogSlot, buildPlacementBoostTerms } from '../lib/runSlots';
import type { SlotDefinition } from '../lib/runSlots';
import { getPopularTitles, JobTypeKey } from '../lib/jobKeywords';
import { generateJobHash } from '../lib/jobHash';
import { classifyIndustry } from '../lib/industryClassifier';
import { recordRapidApiRequest, logRapidApiUsage } from '../lib/rapidapiUsage';

/**
 * Scraper for RapidAPI JSearch (Mega Plan)
 * Searches for graduate jobs, internships, and placements in UK
 * Target: 200,000 jobs/month = ~6,667 jobs/day
 * Rate Limit: 20 requests/second
 * Runs multiple times per day to maximize quota usage
 */
export async function scrapeJSearch(): Promise<CanonicalJob[]> {
  const jobs: CanonicalJob[] = [];
  const seenKeys = new Set<string>();
  let duplicateCount = 0;
  
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
    recordRapidApiRequest('jsearch');
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

  // Popular industries (priority - MANY searches for these)
  const popularIndustries = [
    'business', 'finance', 'engineering', 'accounting', 'marketing', 
    'consulting', 'it', 'technology', 'law', 'sales', 'data', 'analytics'
  ];

  // Engineering types (popular - many searches)
  const engineeringTypes = [
    'civil engineering', 'mechanical engineering', 'electrical engineering',
    'software engineering', 'chemical engineering', 'aerospace engineering',
    'automotive engineering', 'biomedical engineering', 'environmental engineering',
    'structural engineering', 'industrial engineering', 'materials engineering'
  ];

  // Other industries (comprehensive coverage)
  const otherIndustries = [
    'hr', 'human resources', 'operations', 'project management', 'supply chain',
    'pharmaceutical', 'healthcare', 'media', 'advertising', 'retail',
    'hospitality', 'tourism', 'education', 'research', 'science',
    'chemistry', 'physics', 'biology', 'mathematics', 'statistics',
    'architecture', 'design', 'urban planning', 'landscape architecture',
    'aerospace', 'automotive', 'energy', 'renewable energy', 'sustainability',
    'environmental', 'agriculture', 'food', 'manufacturing', 'logistics',
    'psychology', 'sociology', 'economics', 'politics', 'international relations',
    'journalism', 'communications', 'public relations', 'event management',
    'fashion', 'graphic design', 'product design', 'industrial design',
    'pharmacy', 'medicine', 'dentistry', 'veterinary', 'nursing',
    'teaching', 'social work', 'counseling', 'therapy', 'occupational therapy',
    'physiotherapy', 'sports science', 'nutrition', 'dietetics', 'food science',
    'geology', 'geography', 'archaeology', 'history', 'languages',
    'translation', 'interpretation', 'linguistics', 'literature', 'creative writing',
    'film', 'television', 'radio', 'theatre', 'music', 'art', 'fine art',
    'banking', 'investment', 'insurance', 'actuarial', 'risk management',
    'audit', 'tax', 'forensic accounting', 'management accounting', 'financial planning',
    'real estate', 'property', 'construction', 'quantity surveying', 'building surveying',
    'planning', 'development', 'regeneration', 'conservation', 'heritage'
  ];

  // Job type prefixes
  const graduatePrefixes = ['graduate', 'graduate scheme', 'graduate program', 'graduate trainee', 'graduate entry', 'graduate role', 'graduate position'];
  const placementPrefixes = [
    'placement', 'industrial placement', 'placement year', 'year in industry',
    'industrial experience', 'sandwich placement', 'sandwich course', 'sandwich degree',
    'year placement', '12 month placement', 'co-op', 'cooperative placement',
    'work placement', 'student placement', 'professional placement', 'industry placement',
    'year long placement', 'industrial year', 'placement programme', 'placement program',
    'year in industry placement', 'industrial year placement', 'sandwich year placement',
    'cooperative education', 'cooperative work experience', 'internship year',
    'gap year placement', 'year out placement', 'industrial training year'
  ];
  const internshipPrefixes = ['internship', 'summer internship', 'paid internship', 'graduate internship', 'work experience', 'industrial internship'];

  // Build comprehensive search terms
  // Priority industries get all combinations, others get core terms only
  const searchTerms: string[] = [];

  // Core general terms (high priority)
  searchTerms.push(
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
  );

  // Popular industries: MANY combinations (graduate + placement + internship)
  for (const industry of popularIndustries) {
    // Graduate terms (all prefixes)
    for (const prefix of graduatePrefixes) {
      searchTerms.push(`${prefix} ${industry} uk`);
      searchTerms.push(`${industry} ${prefix} uk`);
      searchTerms.push(`${prefix} ${industry} jobs uk`);
    }
    
    // Placement terms (ALL prefixes - PRIORITY for placement jobs!)
    for (const prefix of placementPrefixes) {
      searchTerms.push(`${prefix} ${industry} uk`);
      searchTerms.push(`${industry} ${prefix} uk`);
      searchTerms.push(`${prefix} ${industry} jobs uk`);
      searchTerms.push(`${industry} ${prefix} jobs uk`);
    }
    
    // Internship terms (all prefixes)
    for (const prefix of internshipPrefixes) {
      searchTerms.push(`${prefix} ${industry} uk`);
      searchTerms.push(`${industry} ${prefix} uk`);
      searchTerms.push(`${prefix} ${industry} jobs uk`);
    }
  }

  // Engineering types: MANY searches (popular field)
  for (const engType of engineeringTypes) {
    // Graduate terms
    for (const prefix of graduatePrefixes.slice(0, 4)) {
      searchTerms.push(`${prefix} ${engType} uk`);
      searchTerms.push(`${engType} ${prefix} uk`);
    }
    
    // Placement terms (ALL - PRIORITY!)
    for (const prefix of placementPrefixes) {
      searchTerms.push(`${prefix} ${engType} uk`);
      searchTerms.push(`${engType} ${prefix} uk`);
      searchTerms.push(`${prefix} ${engType} jobs uk`);
    }
    
    // Internship terms
    for (const prefix of internshipPrefixes) {
      searchTerms.push(`${prefix} ${engType} uk`);
      searchTerms.push(`${engType} ${prefix} uk`);
    }
  }

  // Other industries: comprehensive coverage (graduate, placement, internship)
  for (const industry of otherIndustries) {
    searchTerms.push(`graduate ${industry} uk`);
    searchTerms.push(`${industry} graduate uk`);
    searchTerms.push(`placement ${industry} uk`);
    searchTerms.push(`${industry} placement uk`);
    searchTerms.push(`internship ${industry} uk`);
    searchTerms.push(`${industry} internship uk`);
  }

  // Additional placement synonyms (standalone - PRIORITY!)
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
    'placement program uk',
    'year in industry placement uk',
    'industrial year placement uk',
    'sandwich year placement uk',
    'cooperative education uk',
    'cooperative work experience uk',
    'internship year uk',
    'gap year placement uk',
    'year out placement uk',
    'industrial training year uk'
  ];
  searchTerms.push(...placementTerms);

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

  const totalSlots = SLOT_DEFINITIONS.length;
  const { slotIndex } = getCurrentRunSlot(totalSlots);
  const runSlot = slotIndex;
  const slotDefinition = SLOT_DEFINITIONS[runSlot];
  const dateWindow = isBacklogSlot(runSlot) ? 'all' : 'month';

  const siteSearchTerms = [
    'graduate', 'graduate scheme', 'placement', 'industrial placement',
    'placement year', 'undergraduate placement', 'placement scheme',
    'year in industry', 'internship', 'summer internship', 'summer analyst', 'off-cycle internship', 'finance'
  ];

  const siteTermsForRun = buildSlotSiteTerms(slotDefinition, siteSearchTerms);
  console.log(`  🌐 Site search term combos: ${siteTermsForRun.length}`);

  const jobsPerTerm: { [term: string]: number } = {};
  const uniqueJobsPerTerm: { [term: string]: number } = {};

  const baseTermsForRun = filterTermsBySlot(searchTerms, totalSlots, runSlot);
  const slotSpecificTerms = buildSlotSpecificTerms(
    slotDefinition,
    graduatePrefixes,
    placementPrefixes,
    internshipPrefixes
  );

  const combinedTerms = new Set<string>();
  const placementBoostTerms = buildPlacementBoostTerms(slotDefinition);
  placementBoostTerms.forEach(term => combinedTerms.add(term.trim()));
  baseTermsForRun.forEach(term => combinedTerms.add(term.trim()));
  slotSpecificTerms.forEach(term => combinedTerms.add(term.trim()));

  // Limit to avoid overwhelming the API per run
  const termsForRun = Array.from(combinedTerms)
    .map(term => term.toLowerCase())
    .filter(Boolean)
    .slice(0, 600);

  console.log(`  🕒 JSearch run slot: ${runSlot + 1}/${totalSlots} (${slotDefinition.name})`);
  console.log(`  📅 Date window: ${dateWindow}`);
  console.log(`  🔢 Terms this run: ${termsForRun.length} (from ${combinedTerms.size} candidates)`);

  // Calculate daily limit: 200,000/month ≈ 6,667/day
  // Each search with num_pages=5 can return up to 50 jobs (5 pages × 10 jobs/page)
  // To hit quota: ~6,667 jobs/day ÷ 50 jobs/search ≈ 133 searches/day minimum
  // But we want variety and multiple runs per day, so aim for 500-1000 searches/day
  // Rate limit: 20 requests/second = 1,200 requests/minute = 72,000 requests/hour
  // We'll run multiple times per day, so each run can do 200-500 searches
  // This run will do up to 500 searches (can be split across multiple daily runs)
  const maxSearchesEnv = Number(process.env.JSEARCH_MAX_SEARCHES_PER_RUN);
  const MAX_SEARCHES_PER_RUN = Number.isFinite(maxSearchesEnv) && maxSearchesEnv > 0 ? maxSearchesEnv : 500;
  let totalSearches = 0;
  
  try {
    for (const term of termsForRun) {
      if (totalSearches >= MAX_SEARCHES_PER_RUN) {
        console.log(`  ⏸️  Reached search limit for this run (${MAX_SEARCHES_PER_RUN}), stopping early`);
        console.log(`  📊 Total searches this run: ${totalSearches}/${combinedTerms.size} candidate terms`);
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
          date_posted: dateWindow,
          employment_types: 'FULLTIME,INTERN,CONTRACTOR,PARTTIME', // Capture placements listed as contract/part-time
          job_requirements: 'no_experience,under_3_years_experience' // Entry-level focus
        });
        
        const url = `https://jsearch.p.rapidapi.com/search?${urlParams.toString()}`;
        
        recordRapidApiRequest('jsearch');
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
              const dedupKey = buildJSearchDedupKey(job);
              if (seenKeys.has(dedupKey)) {
                duplicateCount++;
                continue;
              }
              seenKeys.add(dedupKey);

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
                postedAt: job.job_posted_at_datetime_utc ? toISO(job.job_posted_at_datetime_utc) : undefined,
                applyDeadline: job.job_posted_at_datetime_utc ? 
                  toISO(job.job_posted_at_datetime_utc) : undefined,
                slug: generateSlug(job.job_title || job.title, job.employer_name || job.company_name),
                hash: generateJobHash({
                  title: job.job_title || job.title,
                  company: job.employer_name || job.company_name,
                  id: job.job_id || job.id,
                  applyUrl: bestApplyUrl,
                  location: job.job_city || job.job_location || job.location || job.job_state,
                  postedAt: job.job_posted_at_datetime_utc || job.job_posted_at
                })
              };

              const inferredIndustry = classifyIndustry({
                title: canonicalJob.title,
                description: canonicalJob.descriptionText || canonicalJob.descriptionHtml,
                company: canonicalJob.company?.name,
                hints: [...slotDefinition.industries, term],
                query: term
              });
              if (inferredIndustry) {
                canonicalJob.industry = inferredIndustry;
              }

              // Filter for relevant job types (placement, graduate, or internship)
              // Location is already filtered by country=uk parameter
              const inferredIndustry = classifyIndustry({
                title: canonicalJob.title,
                description: canonicalJob.descriptionText || canonicalJob.descriptionHtml,
                company: canonicalJob.company?.name,
                hints: [...slotDefinition.industries, term, site.domain],
                query
              });
              if (inferredIndustry) {
                canonicalJob.industry = inferredIndustry;
              }

              const jobText = canonicalJob.title + ' ' + (canonicalJob.descriptionText || '');
              const jobType = classifyJobType(jobText);
              if (jobType === 'graduate' || jobType === 'placement' || jobType === 'internship') {
                // If description is missing or too short, enhance it from apply URL
                if (!canonicalJob.descriptionText || canonicalJob.descriptionText.length < 200) {
                  console.log(`  🔍 Enhancing description for: ${canonicalJob.title}`);
                  await enhanceJobDescription(canonicalJob);
                }
                jobs.push(canonicalJob);
                uniqueJobsPerTerm[term] = (uniqueJobsPerTerm[term] || 0) + 1;
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
    const effectiveSiteTerms = siteTermsForRun.length > 0 ? siteTermsForRun : siteSearchTerms;

    for (const site of sites) {
      for (const term of effectiveSiteTerms) {
        if (totalSearches >= MAX_SEARCHES_PER_RUN) {
          console.log(`  ⏸️  Reached search limit for this run (${MAX_SEARCHES_PER_RUN}), stopping site searches`);
          break;
        }
        
        const query = `${term} site:${site.domain}`;
        console.log(`  🌐 Site search (${site.key}): "${query}"`);
        totalSearches++;
        
        try {
          // Site-constrained search with same filters
          const urlParams = new URLSearchParams({
            query,
            country: 'uk',
            page: '1',
            num_pages: '4',
            date_posted: dateWindow,
            employment_types: 'FULLTIME,INTERN,CONTRACTOR,PARTTIME',
            job_requirements: 'no_experience,under_3_years_experience'
          });
          
          const url = `https://jsearch.p.rapidapi.com/search?${urlParams.toString()}`;
          recordRapidApiRequest('jsearch');
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
          const siteTermKey = `${site.key}:${term}`;

          if (jobArray.length > 0) {
            console.log(`    📦 ${site.key}: ${jobArray.length} jobs for "${term}"`);
            jobsPerTerm[siteTermKey] = (jobsPerTerm[siteTermKey] || 0) + jobArray.length;
          }

          for (const job of jobArray) {
            try {
              const dedupKey = buildJSearchDedupKey(job);
              if (seenKeys.has(dedupKey)) {
                duplicateCount++;
                continue;
              }
              seenKeys.add(dedupKey);

              // Get best apply URL from apply_options array (prefer direct links)
              let bestApplyUrl = job.job_apply_link || '';
              if (job.apply_options && Array.isArray(job.apply_options) && job.apply_options.length > 0) {
                const directLink = job.apply_options.find((opt: any) => opt.is_direct === true);
                if (directLink && directLink.apply_link) {
                  bestApplyUrl = directLink.apply_link;
                } else if (job.apply_options[0] && job.apply_options[0].apply_link) {
                  bestApplyUrl = job.apply_options[0].apply_link;
                }
              }

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
                postedAt: job.job_posted_at_datetime_utc ? toISO(job.job_posted_at_datetime_utc) : undefined,
                applyDeadline: job.job_posted_at_datetime_utc ? 
                  toISO(job.job_posted_at_datetime_utc) : undefined,
                slug: generateSlug(job.job_title || job.title, job.employer_name || job.company_name),
                hash: generateJobHash({
                  title: job.job_title || job.title,
                  company: job.employer_name || job.company_name,
                  id: job.job_id || job.id,
                  applyUrl: bestApplyUrl,
                  location: job.job_city || job.job_location || job.location || job.job_state,
                  postedAt: job.job_posted_at_datetime_utc || job.job_posted_at
                })
              };

              const jobText = canonicalJob.title + ' ' + (canonicalJob.descriptionText || '');
              const jobType = classifyJobType(jobText);
              if (jobType === 'graduate' || jobType === 'placement' || jobType === 'internship') {
                if (!canonicalJob.descriptionText || canonicalJob.descriptionText.length < 200) {
                  console.log(`    🔍 Enhancing description for: ${canonicalJob.title}`);
                  await enhanceJobDescription(canonicalJob);
                }
                jobs.push(canonicalJob);
                uniqueJobsPerTerm[siteTermKey] = (uniqueJobsPerTerm[siteTermKey] || 0) + 1;
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
    console.log(`  🔁 Intra-run duplicates removed: ${duplicateCount}`);
    const totalUniqueJobs = Object.values(uniqueJobsPerTerm).reduce((sum, count) => sum + count, 0);
    if (totalUniqueJobs > 0) {
      console.log(`  ✅ Unique jobs captured this run: ${totalUniqueJobs}`);
    }
    if (Object.keys(uniqueJobsPerTerm).length > 0) {
      console.log(`  🔍 Unique jobs per term (top 15):`);
      Object.entries(uniqueJobsPerTerm)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 15)
        .forEach(([term, count]) => {
          console.log(`    • ${term}: ${count} unique jobs`);
        });
    }
    console.log(`  🔢 Total searches performed: ${totalSearches}`);
  }

  console.log(`📊 JSearch API: Found ${jobs.length} total jobs`);
  logRapidApiUsage('jsearch', { searches: totalSearches, jobs: jobs.length });
  return jobs;
}

function generateSlug(title: string, company: string): string {
  const slug = `${title}-${company}`.toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
  
  return `${slug}-${Date.now()}`;
}

function buildSlotSpecificTerms(
  slot: SlotDefinition,
  graduatePrefixes: string[],
  placementPrefixes: string[],
  internshipPrefixes: string[]
): string[] {
  const terms = new Set<string>();
  const MAX_TERMS = 1600;

  const add = (value: string) => {
    const cleaned = value.trim().toLowerCase();
    if (!cleaned) return;
    if (terms.has(cleaned)) return;
    if (terms.size >= MAX_TERMS) return;
    terms.add(cleaned);
  };

  const placementDurations = ['12 month', '12-month', 'year long', 'year-long', 'industrial year', 'industry year'];
  const placementSuffixes = ['placement', 'programme', 'program', 'internship', 'co-op', 'cooperative education', 'scheme'];
  const internshipDurations = ['summer', 'winter', 'spring', 'off-cycle', '12 week', '10 week'];
  const internshipSuffixes = ['internship', 'analyst program', 'associate program', 'insight week'];
  const graduateSuffixes = [
    'graduate scheme',
    'graduate program',
    'graduate programme',
    'graduate trainee',
    'graduate analyst',
    'graduate engineer',
    'graduate consultant',
    'graduate intake',
    'graduate opportunity',
    'graduate role',
    'graduate position',
    'early careers programme',
    'early careers program',
    'early talent programme',
    'new graduate',
    'recent graduate'
  ];
  const graduateYears = ['2024', '2025'];

  const jobTypeConfigs = [
    { label: 'graduate', prefixes: graduatePrefixes.slice(0, 6) },
    { label: 'placement', prefixes: placementPrefixes.slice(0, 10) },
    { label: 'internship', prefixes: internshipPrefixes.slice(0, 6) }
  ];

  const cities = slot.cities;
  const industries = slot.industries;

  industries.forEach(industry => {
    jobTypeConfigs.forEach(({ label, prefixes }) => {
      add(`${label} ${industry} uk`);
      add(`${industry} ${label} uk`);
      prefixes.slice(0, 3).forEach(prefix => {
        add(`${prefix} ${industry} uk`);
      });

      const popularTitles = getPopularTitles(industry, label as JobTypeKey).slice(0, 6);
      popularTitles.forEach(title => {
        add(`${title}`);
        add(`${title} uk`);
        add(`${title} ${industry}`);
        add(`${title} in ${industry}`);
      });
    });

    placementDurations.forEach(duration => {
      placementSuffixes.forEach(suffix => {
        add(`${duration} ${industry} ${suffix}`);
        add(`${duration} ${suffix} ${industry}`);
      });
    });

    internshipDurations.forEach(duration => {
      internshipSuffixes.forEach(suffix => {
        add(`${duration} ${industry} ${suffix}`);
        add(`${duration} ${suffix} ${industry}`);
      });
    });

    graduateSuffixes.forEach(suffix => {
      add(`${suffix} ${industry}`);
      add(`${industry} ${suffix}`);
      graduateYears.forEach(year => {
        add(`${suffix} ${industry} ${year}`);
        add(`${industry} ${suffix} ${year}`);
      });
    });
  });

  cities.forEach(city => {
    jobTypeConfigs.forEach(({ label, prefixes }) => {
      add(`${label} jobs ${city}`);
      add(`${label} ${city} uk`);
      prefixes.forEach(prefix => {
        add(`${prefix} ${city}`);
      });
      industries.forEach(industry => {
        prefixes.forEach(prefix => {
          add(`${prefix} ${industry} ${city}`);
          add(`${prefix} ${industry} in ${city}`);
        });
        add(`${label} ${industry} ${city}`);
        add(`${industry} ${label} ${city}`);
      });

      const popularTitles = getPopularTitles(city, label as JobTypeKey).slice(0, 4);
      popularTitles.forEach(title => {
        add(`${title} ${city}`);
        add(`${title} in ${city}`);
      });
    });

    placementDurations.forEach(duration => {
      placementSuffixes.forEach(suffix => {
        add(`${duration} ${suffix} ${city}`);
        industries.forEach(industry => {
          add(`${duration} ${industry} ${suffix} ${city}`);
          add(`${suffix} ${industry} ${duration} ${city}`);
        });
      });
    });

    internshipDurations.forEach(duration => {
      internshipSuffixes.forEach(suffix => {
        add(`${duration} ${suffix} ${city}`);
        industries.forEach(industry => {
          add(`${duration} ${industry} ${suffix} ${city}`);
        });
      });
    });

    graduateSuffixes.forEach(suffix => {
      add(`${suffix} ${city}`);
      industries.forEach(industry => {
        add(`${suffix} ${industry} ${city}`);
        add(`${industry} ${suffix} ${city}`);
      });
      graduateYears.forEach(year => {
        add(`${suffix} ${city} ${year}`);
      });
    });
  });

  return Array.from(terms);
}

function buildSlotSiteTerms(slot: SlotDefinition, baseTerms: string[]): string[] {
  const terms = new Set<string>();
  const MAX_TERMS = 24;

  const cities = slot.cities.slice(0, Math.min(4, slot.cities.length));
  const industries = slot.industries.slice(0, Math.min(6, slot.industries.length));
  const placementDurations = ['12 month', '12-month', 'year long', 'year-long', 'industrial year'];
  const placementSuffixes = ['placement', 'programme', 'program', 'co-op'];
  const internshipDurations = ['summer', 'winter', 'spring', '12 week'];
  const internshipSuffixes = ['internship', 'analyst program', 'insight week'];
  const graduateSuffixes = ['graduate scheme', 'graduate program', 'graduate programme', 'graduate trainee', 'graduate analyst'];
  const graduateYears = ['2024', '2025'];

  const add = (value: string) => {
    const cleaned = value.trim().toLowerCase();
    if (!cleaned) return;
    if (terms.has(cleaned)) return;
    if (terms.size >= MAX_TERMS) return;
    terms.add(cleaned);
  };

  baseTerms.forEach(term => {
    cities.forEach(city => {
      add(`${term} ${city}`);
    });
    industries.forEach(industry => {
      add(`${term} ${industry}`);
    });
  });

  industries.forEach(industry => {
    placementDurations.forEach(duration => {
      placementSuffixes.forEach(suffix => {
        add(`${duration} ${industry} ${suffix}`);
      });
    });

    internshipDurations.forEach(duration => {
      internshipSuffixes.forEach(suffix => {
        add(`${duration} ${industry} ${suffix}`);
      });
    });

    graduateSuffixes.forEach(suffix => {
      add(`${suffix} ${industry}`);
      graduateYears.forEach(year => add(`${suffix} ${industry} ${year}`));
    });

    (['graduate', 'placement', 'internship'] as JobTypeKey[]).forEach(jobType => {
      getPopularTitles(industry, jobType)
        .slice(0, 3)
        .forEach(title => add(`${title}`));
    });
  });

  return Array.from(terms);
}

function buildJSearchDedupKey(job: any): string {
  const id = (job.job_id || job.id || '').toString().trim().toLowerCase();
  const apply = (job.job_apply_link || job.apply_link || job.url || '').split('?')[0].trim().toLowerCase();
  const title = (job.job_title || job.title || '').trim().toLowerCase();
  const company = (job.employer_name || job.company_name || '').trim().toLowerCase();
  return [id, apply, title, company].filter(Boolean).join('|');
}

function filterTermsBySlot(terms: string[], slots: number, slot: number): string[] {
  if (slots <= 1) {
    return [...terms];
  }
  const filtered = terms.filter((_, index) => index % slots === slot);
  return filtered.length > 0 ? filtered : [...terms];
}
