import { CanonicalJob } from '../types';
import { toISO } from '../lib/normalize';
import { SLOT_DEFINITIONS, getCurrentRunSlot, isBacklogSlot } from '../lib/runSlots';
import type { SlotDefinition } from '../lib/runSlots';
import { generateJobHash } from '../lib/jobHash';

/**
 * Scraper for LinkedIn Jobs API
 * Searches for graduate jobs, internships, and placements in UK
 */
export async function scrapeLinkedInJobs(): Promise<CanonicalJob[]> {
  const jobs: CanonicalJob[] = [];
  const seenKeys = new Set<string>();
  let duplicateCount = 0;
  
  if (!process.env.RAPIDAPI_KEY) {
    console.warn('⚠️  RAPIDAPI_KEY is not set. Skipping LinkedIn Jobs API.');
    return [];
  }

  console.log('🔄 Scraping LinkedIn Jobs API...');

  // First, test with a very broad search to see if the API has any jobs
  console.log('🧪 Testing LinkedIn API with broad search...');
  try {
    const testUrl = `https://linkedin-job-search-api.p.rapidapi.com/active-jb-24h?location_filter="United Kingdom"&description_type=text&limit=5&offset=0`;
    const testResponse = await fetch(testUrl, {
      method: 'GET',
      headers: {
        'X-RapidAPI-Key': process.env.RAPIDAPI_KEY!,
        'X-RapidAPI-Host': 'linkedin-job-search-api.p.rapidapi.com'
      }
    });
    
    if (testResponse.ok) {
      const testData = await testResponse.json() as any;
      const testJobArray = Array.isArray(testData) ? testData : (testData.results && Array.isArray(testData.results) ? testData.results : []);
      console.log(`🧪 LinkedIn broad test found ${testJobArray.length} total jobs in UK`);
      if (testJobArray.length > 0) {
        console.log(`🧪 LinkedIn sample: ${testJobArray[0].title} at ${testJobArray[0].organization || testJobArray[0].company_name}`);
      }
    } else {
      console.log(`🧪 LinkedIn broad test failed: ${testResponse.status}`);
    }
  } catch (error) {
    console.log(`🧪 LinkedIn broad test error:`, error instanceof Error ? error.message : String(error));
  }

  // Expanded search terms for graduate jobs and placements
  // Target: 10,000 jobs/month = ~333 jobs/day
  // With pagination: ~30-40 jobs per search term × 30 terms = ~900-1,200 jobs/day
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

  // UK major cities for location-based searches (maximize coverage)
  const ukLocations = [
    'London',
    'Manchester',
    'Birmingham',
    'Leeds',
    'Glasgow',
    'Edinburgh',
    'Bristol',
    'Liverpool',
    'Newcastle',
    'Sheffield'
  ];

  const totalSlots = SLOT_DEFINITIONS.length;
  const { slotIndex } = getCurrentRunSlot(totalSlots);
  const slotDefinition = SLOT_DEFINITIONS[slotIndex];
  const backlogMode = isBacklogSlot(slotIndex);
  const dateWindow = backlogMode ? 'week' : '3days';

  const baseTermsForRun = filterLinkedInTermsBySlot(searchTerms, totalSlots, slotIndex);
  const slotTerms = buildLinkedInSlotTerms(slotDefinition);
  const combinedTerms = new Set<string>();
  baseTermsForRun.forEach(term => combinedTerms.add(term.trim().toLowerCase()));
  slotTerms.forEach(term => combinedTerms.add(term.trim().toLowerCase()));

  const MAX_SEARCHES_PER_RUN = 40;
  const termsForRun = Array.from(combinedTerms).slice(0, MAX_SEARCHES_PER_RUN);

  console.log(`  🕒 LinkedIn run slot: ${slotIndex + 1}/${totalSlots} (${slotDefinition.name})`);
  console.log(`  📅 Date window: ${dateWindow}`);
  console.log(`  🔢 Terms this run: ${termsForRun.length} (from ${combinedTerms.size} candidates)`);

  const jobsPerTerm: { [term: string]: number } = {};
  const uniqueJobsPerTerm: { [term: string]: number } = {};
  let totalSearches = 0;
  
  try {
    // Strategy 1: Broad searches across all terms with high pagination
    for (const term of termsForRun) {
      if (totalSearches >= MAX_SEARCHES_PER_RUN) {
        console.log(`  ⏸️  Reached search limit for this run (${MAX_SEARCHES_PER_RUN}), stopping early`);
        break;
      }
      
      console.log(`  🔍 Searching LinkedIn for: "${term}"`);
      totalSearches++;
      
      try {
        // Use pagination to get more jobs per term
        // LinkedIn API limit=100, so we'll paginate through offsets
        // Reduced pagination to avoid rate limits (429 errors)
        // Target: Get up to 100-200 jobs per term (reduced from 300)
        let termJobsFound = 0;
        for (let offset = 0; offset < 200; offset += 100) { // Get up to 200 jobs per term (reduced from 300)
          const encodedTerm = encodeURIComponent(`"${term}"`);
          const endpoint = backlogMode ? 'active-jb-7d' : 'active-jb-24h';
          const url = `https://linkedin-job-search-api.p.rapidapi.com/${endpoint}?title_filter=${encodedTerm}&location_filter="United Kingdom"&description_type=text&date_posted=${dateWindow}&limit=100&offset=${offset}`;
          
          if (offset > 0) {
            await new Promise(resolve => setTimeout(resolve, 2000)); // Rate limit between pages (increased to 2s)
          }
          
          // Retry logic for rate limiting (429 errors)
          let response: Response | null = null;
          let retries = 0;
          const maxRetries = 3;
          
          while (retries <= maxRetries) {
            response = await fetch(url, {
              method: 'GET',
              headers: {
                'X-RapidAPI-Key': process.env.RAPIDAPI_KEY!,
                'X-RapidAPI-Host': 'linkedin-job-search-api.p.rapidapi.com'
              }
            });

            if (response.ok) {
              break; // Success, exit retry loop
            }
            
            // Handle 429 (Too Many Requests) with exponential backoff
            if (response.status === 429) {
              retries++;
              if (retries > maxRetries) {
                console.warn(`    ⚠️  LinkedIn API rate limit exceeded (offset ${offset}): ${response.status} ${response.statusText}`);
                console.warn(`    ⏸️  Stopping LinkedIn searches to avoid further rate limits`);
                // Stop all LinkedIn searches if we hit rate limit
                throw new Error('LinkedIn API rate limit exceeded - stopping searches');
              }
              
              // Exponential backoff: 5s, 10s, 20s
              const backoffDelay = Math.min(5000 * Math.pow(2, retries - 1), 30000);
              console.warn(`    ⚠️  LinkedIn API rate limited (429), retrying in ${backoffDelay/1000}s (attempt ${retries}/${maxRetries})...`);
              await new Promise(resolve => setTimeout(resolve, backoffDelay));
              continue;
            }
            
            // For other errors, log and break
            const errorText = await response.text();
            console.warn(`    ⚠️  LinkedIn API request failed (offset ${offset}): ${response.status} ${response.statusText}`);
            if (offset === 0) {
              break; // If first page fails, skip this term
            }
            break; // If later page fails, we got what we could
          }
          
          if (!response || !response.ok) {
            if (offset === 0) {
              break; // If first page fails, skip this term
            }
            break; // If later page fails, we got what we could
          }

          const data = await response.json() as any;
          
          // Handle both array response and wrapped response
          const jobArray = Array.isArray(data) ? data : (data.results && Array.isArray(data.results) ? data.results : []);
          
          if (jobArray.length === 0 && offset === 0) {
            console.log(`  📄 No jobs found for "${term}"`);
            break; // No jobs for this term, move on
          }
          
          if (jobArray.length === 0) {
            break; // No more jobs, we're done with this term
          }
          
          termJobsFound += jobArray.length;
          console.log(`    📦 Page ${Math.floor(offset/100) + 1}: Found ${jobArray.length} jobs (total: ${termJobsFound} for "${term}")`);
          
          for (const job of jobArray) {
            try {
              const dedupKey = buildLinkedInDedupKey(job);
              if (seenKeys.has(dedupKey)) {
                duplicateCount++;
                continue;
              }
              seenKeys.add(dedupKey);

              const canonicalJob: CanonicalJob = {
                title: job.title || 'Unknown Title',
                company: { name: job.organization || job.company_name || 'Unknown Company' },
                location: job.location || job.location_name || 'UK',
                applyUrl: job.apply_url || job.external_apply_url || job.organization_url || '',
                descriptionText: job.description_text || job.description || '',
                descriptionHtml: job.description_html || job.description_text || job.description || '',
                source: 'LinkedIn Jobs API (via RapidAPI)',
                sourceUrl: 'https://rapidapi.com/fantastic-jobs/api/linkedin-job-search-api',
                jobType: classifyJobType(job.title + ' ' + (job.description_text || job.description || '')),
                salary: undefined, // Not provided by this API
                postedAt: job.date_posted || job.posted_at ? toISO(job.date_posted || job.posted_at) : undefined,
                applyDeadline: job.date_posted || job.posted_at ? toISO(job.date_posted || job.posted_at) : undefined,
                slug: generateSlug(job.title, job.organization || job.company_name),
                hash: generateJobHash({
                  title: job.title,
                  company: job.organization || job.company_name,
                  id: job.id || job.id?.toString(),
                  applyUrl: job.apply_url || job.external_apply_url || job.organization_url || job.url,
                  location: job.location || job.location_name,
                  postedAt: job.date_posted || job.posted_at
                })
              };

              // Filter for relevant job types (placement, graduate, or internship)
              // Location is already filtered by API parameter (United Kingdom)
              const jobText = canonicalJob.title + ' ' + (canonicalJob.descriptionText || '');
              const jobType = classifyJobType(jobText);
              if (jobType === 'graduate' || jobType === 'placement' || jobType === 'internship') {
                jobs.push(canonicalJob);
                uniqueJobsPerTerm[term] = (uniqueJobsPerTerm[term] || 0) + 1;
              }
            } catch (error) {
              console.warn(`    ⚠️  Error processing LinkedIn job:`, error instanceof Error ? error.message : String(error));
            }
          }
          
          // If we got fewer than 100 jobs, we've reached the end
          if (jobArray.length < 100) {
            break;
          }
        }
        
        if (termJobsFound > 0) {
          jobsPerTerm[term] = termJobsFound;
          console.log(`  ✅ "${term}": ${termJobsFound} total jobs found`);
        }

        // Rate limiting - wait between terms (increased to avoid 429 errors)
        await new Promise(resolve => setTimeout(resolve, 3000)); // 3 seconds between terms
        
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.warn(`  ❌ Failed to search LinkedIn "${term}":`, errorMessage);
        
        // If rate limit exceeded, stop all LinkedIn searches
        if (errorMessage.includes('rate limit exceeded')) {
          console.warn(`  ⏸️  LinkedIn API rate limit exceeded - stopping all LinkedIn searches`);
          break; // Exit the search loop
        }
      }
    }
    
    // Summary: Show jobs per term
    if (Object.keys(jobsPerTerm).length > 0) {
      console.log(`\n📊 LinkedIn Search Summary:`);
      console.log(`  🔁 Intra-run duplicates removed: ${duplicateCount}`);
      Object.entries(jobsPerTerm).forEach(([term, count]) => {
        console.log(`  "${term}": ${count} jobs`);
      });
      const totalUniqueJobs = Object.values(uniqueJobsPerTerm).reduce((sum, count) => sum + count, 0);
      if (totalUniqueJobs > 0) {
        console.log(`  ✅ Unique jobs captured this run: ${totalUniqueJobs}`);
      }
      if (Object.keys(uniqueJobsPerTerm).length > 0) {
        console.log(`  🔍 Unique jobs per term (top 10):`);
        Object.entries(uniqueJobsPerTerm)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 10)
          .forEach(([term, count]) => {
            console.log(`    • ${term}: ${count} unique jobs`);
          });
      }
    }

  } catch (error) {
    console.warn('Failed to scrape LinkedIn Jobs API:', error instanceof Error ? error.message : String(error));
  }

  console.log(`📊 LinkedIn Jobs API: Found ${jobs.length} total jobs`);
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

function isUKJob(location: string): boolean {
  const ukLocations = [
    'uk', 'united kingdom', 'england', 'scotland', 'wales', 'northern ireland',
    'london', 'manchester', 'birmingham', 'leeds', 'glasgow', 'edinburgh',
    'bristol', 'liverpool', 'newcastle', 'sheffield', 'belfast', 'cardiff'
  ];
  
  return ukLocations.some(uk => location.toLowerCase().includes(uk));
}

function isRelevantJobType(text: string): boolean {
  const relevantKeywords = [
    'graduate', 'internship', 'placement', 'entry level', 'junior',
    'trainee', 'scheme', 'programme', 'program', 'analyst', 'engineer',
    'consultant', 'manager', 'developer', 'coordinator', 'specialist'
  ];
  
  return relevantKeywords.some(keyword => text.toLowerCase().includes(keyword));
}

function generateSlug(title: string, company: string): string {
  const slug = `${title}-${company}`.toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
  
  return `${slug}-${Date.now()}`;
}

function buildLinkedInDedupKey(job: any): string {
  const id = (job.id || job.job_id || job.jobId || '').toString().trim().toLowerCase();
  const apply = (job.apply_url || job.external_apply_url || job.organization_url || job.url || '').split('?')[0].trim().toLowerCase();
  const title = (job.title || '').trim().toLowerCase();
  const company = (job.organization || job.company_name || '').trim().toLowerCase();
  return [id, apply, title, company].filter(Boolean).join('|');
}

function buildLinkedInSlotTerms(slot: SlotDefinition): string[] {
  const terms = new Set<string>();
  const MAX_TERMS = 120;
  const jobTypes = ['graduate', 'placement', 'internship'];

  const add = (value: string) => {
    const cleaned = value.trim().toLowerCase();
    if (!cleaned) return;
    if (terms.has(cleaned)) return;
    if (terms.size >= MAX_TERMS) return;
    terms.add(cleaned);
  };

  slot.industries.forEach(industry => {
    jobTypes.forEach(type => {
      add(`${type} ${industry} uk`);
      add(`${industry} ${type} uk`);
    });
  });

  slot.cities.forEach(city => {
    jobTypes.forEach(type => {
      add(`${type} jobs ${city}`);
      add(`${type} ${city} uk`);
      slot.industries.forEach(industry => {
        add(`${type} ${industry} ${city}`);
        add(`${industry} ${type} ${city}`);
      });
    });
  });

  return Array.from(terms);
}

function filterLinkedInTermsBySlot(terms: string[], slots: number, slot: number): string[] {
  if (slots <= 1) {
    return [...terms];
  }
  const filtered = terms.filter((_, index) => index % slots === slot);
  return filtered.length > 0 ? filtered : [...terms];
}

