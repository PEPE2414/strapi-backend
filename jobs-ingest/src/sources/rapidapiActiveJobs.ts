import { CanonicalJob } from '../types';
import { toISO, classifyJobType, isRelevantJobType } from '../lib/normalize';
import { generateJobHash } from '../lib/jobHash';
import { classifyIndustry } from '../lib/industryClassifier';
import { recordRapidApiRequest, logRapidApiUsage } from '../lib/rapidapiUsage';
import { SLOT_DEFINITIONS, getCurrentRunSlot, buildPlacementBoostTerms } from '../lib/runSlots';

/**
 * Scraper for RapidAPI Active Jobs DB
 * Searches for graduate jobs, internships, and placements in UK
 */
export async function scrapeRapidAPIActiveJobs(): Promise<CanonicalJob[]> {
  const jobs: CanonicalJob[] = [];
  
  if (!process.env.RAPIDAPI_KEY) {
    console.warn('⚠️  RAPIDAPI_KEY is not set. Skipping RapidAPI Active Jobs DB.');
    return [];
  }

  console.log('🔄 Scraping RapidAPI Active Jobs DB...');

  // First, test with a very broad search to see if the API has any jobs
  console.log('🧪 Testing API with broad search...');
  try {
    const testUrl = `https://active-jobs-db.p.rapidapi.com/active-ats-24h?location_filter="United Kingdom"&limit=5&offset=0`;
    recordRapidApiRequest('active-jobs-db');
    const testResponse = await fetch(testUrl, {
      method: 'GET',
      headers: {
        'X-RapidAPI-Key': process.env.RAPIDAPI_KEY!,
        'X-RapidAPI-Host': 'active-jobs-db.p.rapidapi.com'
      }
    });
    
    if (testResponse.ok) {
      const testData = await testResponse.json() as any;
      const testJobArray = Array.isArray(testData) ? testData : (testData.results && Array.isArray(testData.results) ? testData.results : []);
      console.log(`🧪 Broad test found ${testJobArray.length} total jobs in UK`);
      if (testJobArray.length > 0) {
        const sampleJob = testJobArray[0];
        console.log(`🧪 Sample: ${sampleJob.title} at ${sampleJob.company_name || sampleJob.organization || 'Unknown'}`);
      }
    } else {
      console.log(`🧪 Broad test failed: ${testResponse.status}`);
    }
  } catch (error) {
    console.log(`🧪 Broad test error:`, error instanceof Error ? error.message : String(error));
  }

  // Search terms for graduate jobs and placements
  const baseSearchTerms = [
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
    'internship',
    'summer internship',
    'junior'
  ];

  const { slotIndex } = getCurrentRunSlot();
  const slotDefinition = SLOT_DEFINITIONS[slotIndex];
  const placementBoostTerms = buildPlacementBoostTerms(slotDefinition).slice(0, 40);
  const dynamicIndustryTerms = placementBoostTerms
    .map(term => term.replace(/\buk\b/g, '').trim())
    .filter(term => term.length > 3);

  const maxTermsEnv = Number(process.env.ACTIVE_JOBS_MAX_SEARCH_TERMS);
  // Increased from 60 to 500 to reach 100k jobs target
  const maxTerms = Number.isFinite(maxTermsEnv) && maxTermsEnv > 0 ? maxTermsEnv : 500;
  const searchTerms = Array.from(new Set([...baseSearchTerms, ...dynamicIndustryTerms])).slice(0, maxTerms);

  console.log(`🔢 RapidAPI Active Jobs: using ${searchTerms.length} search terms (slot: ${slotDefinition.name})`);

  const offsetStepEnv = Number(process.env.ACTIVE_JOBS_OFFSET_STEP);
  const offsetStep = Number.isFinite(offsetStepEnv) && offsetStepEnv > 0 ? offsetStepEnv : 100;
  const maxOffsetsEnv = Number(process.env.ACTIVE_JOBS_MAX_OFFSETS);
  // Increased from 5 to 20 to get more jobs per term
  const maxOffsets = Number.isFinite(maxOffsetsEnv) && maxOffsetsEnv > 0 ? maxOffsetsEnv : 20;

  let requestCount = 0;

  try {
    for (const term of searchTerms) {
      console.log(`  🔍 Searching for: "${term}"`);

      for (let offsetIndex = 0; offsetIndex < maxOffsets; offsetIndex += 1) {
        const offset = offsetIndex * offsetStep;

        try {
          const encodedTerm = encodeURIComponent(`"${term}"`);
          const url = `https://active-jobs-db.p.rapidapi.com/active-ats-24h?title_filter=${encodedTerm}&location_filter="United Kingdom"&limit=100&offset=${offset}`;

          recordRapidApiRequest('active-jobs-db');
          requestCount++;
          const response = await fetch(url, {
            method: 'GET',
            headers: {
              'X-RapidAPI-Key': process.env.RAPIDAPI_KEY!,
              'X-RapidAPI-Host': 'active-jobs-db.p.rapidapi.com'
            }
          });

          if (!response.ok) {
            // Use decompressResponse for error text (might be compressed)
            const { decompressFetchResponse } = await import('../lib/decompressResponse');
            let errorText: string;
            try {
              errorText = await decompressFetchResponse(response);
            } catch {
              errorText = await response.text();
            }
            console.warn(`  ⚠️  RapidAPI request failed: ${response.status} ${response.statusText}`);
            console.warn(`  📄 Error response: ${errorText.substring(0, 200)}`);
            break;
          }

          // Use decompressResponse before parsing JSON (handles compressed responses)
          const { decompressFetchResponse } = await import('../lib/decompressResponse');
          let data: any;
          try {
            const jsonText = await decompressFetchResponse(response);
            data = JSON.parse(jsonText);
          } catch (decompressError) {
            // If decompression fails, try regular json() as fallback
            console.warn(`⚠️  Decompression failed, trying regular json(): ${decompressError instanceof Error ? decompressError.message : String(decompressError)}`);
            data = await response.json() as any;
          }
          const jobArray = Array.isArray(data) ? data : (data.results && Array.isArray(data.results) ? data.results : []);

          if (jobArray.length === 0) {
            console.log(`  📄 No jobs found for "${term}" at offset ${offset}`);
            break;
          }

          console.log(`  📦 Found ${jobArray.length} jobs for "${term}" (offset ${offset})`);

          jobArray.forEach((job: any) => {
            try {
              const title = job.title || 'Unknown Title';
              const description = job.description_text || '';
              const jobText = `${title} ${description}`.trim();
              const jobType = classifyJobType(jobText);

              if (jobType !== 'graduate' && jobType !== 'placement' && jobType !== 'internship') {
                return;
              }

              if (!isRelevantJobType(jobText)) {
                return;
              }

              const canonicalJob: CanonicalJob = {
                title,
                company: { name: job.company_name || job.organization || 'Unknown Company' },
                location: job.location || 'UK',
                applyUrl: job.apply_url || job.details_url || '',
                descriptionText: description,
                descriptionHtml: job.description_html || job.description_text || '',
                source: 'RapidAPI Active Jobs DB',
                sourceUrl: 'https://rapidapi.com/fantastic-jobs/api/active-jobs-db',
                jobType,
                salary: undefined,
                postedAt: job.posted_at ? toISO(job.posted_at) : undefined,
                applyDeadline: job.posted_at ? toISO(job.posted_at) : undefined,
                slug: generateSlug(job.title, job.company_name),
                hash: generateJobHash({
                  title: job.title,
                  company: job.company_name,
                  id: job.id,
                  applyUrl: job.apply_url || job.details_url,
                  location: job.location,
                  postedAt: job.posted_at
                })
              };

              const industryHints = [
                ...slotDefinition.industries,
                job.jobIndustry,
                ...(job.industries || []),
                term
              ].filter((hint): hint is string => Boolean(hint && String(hint).trim()));

              const inferredIndustry = classifyIndustry({
                title,
                description: canonicalJob.descriptionText || canonicalJob.descriptionHtml,
                company: canonicalJob.company?.name,
                hints: industryHints,
                query: term
              });
              if (inferredIndustry) {
                canonicalJob.industry = inferredIndustry;
              }

              jobs.push(canonicalJob);
            } catch (error) {
              console.warn(`  ⚠️  Error processing job:`, error instanceof Error ? error.message : String(error));
            }
          });

          if (jobArray.length < 100) {
            break;
          }

          await new Promise(resolve => setTimeout(resolve, 2000));
        } catch (error) {
          console.warn(`  ❌ Failed to search "${term}" (offset ${offset}):`, error instanceof Error ? error.message : String(error));
          break;
        }
      }
    }
  } catch (error) {
    console.warn('Failed to scrape RapidAPI Active Jobs DB:', error instanceof Error ? error.message : String(error));
  }

  console.log(`📊 RapidAPI Active Jobs DB: Found ${jobs.length} total jobs`);
  logRapidApiUsage('active-jobs-db', { searches: searchTerms.length, requests: requestCount, jobs: jobs.length });
  return jobs;
}

function generateSlug(title: string, company: string): string {
  const slug = `${title}-${company}`.toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
  
  return `${slug}-${Date.now()}`;
}
