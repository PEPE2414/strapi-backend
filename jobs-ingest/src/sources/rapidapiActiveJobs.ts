import { CanonicalJob } from '../types';
import { toISO } from '../lib/normalize';
import { generateJobHash } from '../lib/jobHash';

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
    'internship',
    'summer internship',
    'junior'
  ];

  try {
    for (const term of searchTerms) {
      console.log(`  🔍 Searching for: "${term}"`);
      
      try {
        // Use the correct GET endpoint with query parameters
        const encodedTerm = encodeURIComponent(`"${term}"`);
        const url = `https://active-jobs-db.p.rapidapi.com/active-ats-24h?title_filter=${encodedTerm}&location_filter="United Kingdom"&limit=100&offset=0`;
        
        const response = await fetch(url, {
          method: 'GET',
          headers: {
            'X-RapidAPI-Key': process.env.RAPIDAPI_KEY!,
            'X-RapidAPI-Host': 'active-jobs-db.p.rapidapi.com'
          }
        });

        if (!response.ok) {
          const errorText = await response.text();
          console.warn(`  ⚠️  RapidAPI request failed: ${response.status} ${response.statusText}`);
          console.warn(`  📄 Error response: ${errorText.substring(0, 200)}`);
          continue;
        }

        const data = await response.json() as any;
        
        // Handle both array response and wrapped response
        const jobArray = Array.isArray(data) ? data : (data.results && Array.isArray(data.results) ? data.results : []);
        
        if (jobArray.length > 0) {
          console.log(`  📦 Found ${jobArray.length} jobs for "${term}"`);
          
          // Debug: Show first few jobs to understand the data structure
          if (jobArray.length > 0) {
            const sampleJob = jobArray[0];
            console.log(`  🔍 Sample job: ${sampleJob.title} at ${sampleJob.company_name || sampleJob.organization || 'Unknown'}`);
          }
          
          for (const job of jobArray) {
            try {
              const canonicalJob: CanonicalJob = {
                title: job.title || 'Unknown Title',
                company: { name: job.company_name || 'Unknown Company' },
                location: job.location || 'UK',
                applyUrl: job.apply_url || job.details_url || '',
                descriptionText: job.description_text || '',
                descriptionHtml: job.description_html || job.description_text || '',
                source: 'RapidAPI Active Jobs DB',
                sourceUrl: 'https://rapidapi.com/fantastic-jobs/api/active-jobs-db',
                jobType: classifyJobType(job.title + ' ' + (job.description_text || '')),
                salary: undefined, // Not provided by this API
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
          if (jobArray.length === 0) {
            console.log(`  🔍 Response structure:`, JSON.stringify(data).substring(0, 200));
          }
        }

        // Rate limiting - wait between requests
        await new Promise(resolve => setTimeout(resolve, 2000));
        
      } catch (error) {
        console.warn(`  ❌ Failed to search "${term}":`, error instanceof Error ? error.message : String(error));
      }
    }

  } catch (error) {
    console.warn('Failed to scrape RapidAPI Active Jobs DB:', error instanceof Error ? error.message : String(error));
  }

  console.log(`📊 RapidAPI Active Jobs DB: Found ${jobs.length} total jobs`);
  return jobs;
}

function classifyJobType(text: string): 'internship' | 'placement' | 'graduate' | 'other' {
  const t = text.toLowerCase();
  
  if (t.includes('internship') || t.includes('intern')) {
    return 'internship';
  }
  if (t.includes('placement') || t.includes('year in industry') || t.includes('industrial placement') || 
      t.includes('sandwich course') || t.includes('work experience placement')) {
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
