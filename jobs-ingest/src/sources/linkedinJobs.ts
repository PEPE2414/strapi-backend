import { CanonicalJob } from '../types';
import { toISO } from '../lib/normalize';

/**
 * Scraper for LinkedIn Jobs API
 * Searches for graduate jobs, internships, and placements in UK
 */
export async function scrapeLinkedInJobs(): Promise<CanonicalJob[]> {
  const jobs: CanonicalJob[] = [];
  
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
      console.log(`🧪 LinkedIn broad test found ${testData.results?.length || 0} total jobs in UK`);
      if (testData.results && testData.results.length > 0) {
        console.log(`🧪 LinkedIn sample: ${testData.results[0].title} at ${testData.results[0].company_name}`);
      }
    } else {
      console.log(`🧪 LinkedIn broad test failed: ${testResponse.status}`);
    }
  } catch (error) {
    console.log(`🧪 LinkedIn broad test error:`, error instanceof Error ? error.message : String(error));
  }

  // Search terms for graduate jobs and placements (broader variants)
  const searchTerms = [
    'graduate',
    'graduate scheme', 
    'graduate program',
    'graduate trainee',
    'graduate analyst',
    'graduate engineer',
    'graduate consultant',
    'graduate developer',
    'entry level',
    'entry level analyst',
    'entry level engineer',
    'entry level developer',
    'placement',
    'industrial placement',
    'placement year',
    'year in industry',
    'internship',
    'summer internship',
    'junior',
    'junior analyst',
    'junior engineer',
    'junior developer',
    'trainee',
    'apprentice',
    'new graduate',
    'recent graduate'
  ];

  try {
    for (const term of searchTerms) {
      console.log(`  🔍 Searching LinkedIn for: "${term}"`);
      
      try {
        // Use the correct GET endpoint with query parameters
        const encodedTerm = encodeURIComponent(`"${term}"`);
        const url = `https://linkedin-job-search-api.p.rapidapi.com/active-jb-24h?title_filter=${encodedTerm}&location_filter="United Kingdom"&description_type=text&limit=100&offset=0`;
        
        const response = await fetch(url, {
          method: 'GET',
          headers: {
            'X-RapidAPI-Key': process.env.RAPIDAPI_KEY!,
            'X-RapidAPI-Host': 'linkedin-job-search-api.p.rapidapi.com'
          }
        });

        if (!response.ok) {
          const errorText = await response.text();
          console.warn(`  ⚠️  LinkedIn API request failed: ${response.status} ${response.statusText}`);
          console.warn(`  📄 Error response: ${errorText.substring(0, 200)}`);
          continue;
        }

        const data = await response.json() as any;
        
        if (data.results && Array.isArray(data.results)) {
          console.log(`  📦 Found ${data.results.length} jobs for "${term}"`);
          
          for (const job of data.results) {
            try {
              const canonicalJob: CanonicalJob = {
                title: job.title || 'Unknown Title',
                company: { name: job.company_name || 'Unknown Company' },
                location: job.location || 'UK',
                applyUrl: job.apply_url || job.external_apply_url || '',
                descriptionText: job.description_text || '',
                descriptionHtml: job.description_text || '',
                source: 'LinkedIn Jobs API (via RapidAPI)',
                sourceUrl: 'https://rapidapi.com/fantastic-jobs/api/linkedin-job-search-api',
                jobType: classifyJobType(job.title + ' ' + (job.description_text || '')),
                salary: undefined, // Not provided by this API
                applyDeadline: job.posted_at ? toISO(job.posted_at) : undefined,
                slug: generateSlug(job.title, job.company_name),
                hash: generateHash(job.title, job.company_name, job.id)
              };

              // Filter for UK jobs and relevant job types
              const jobText = canonicalJob.title + ' ' + (canonicalJob.descriptionText || '');
              if (isUKJob(canonicalJob.location || '') && isRelevantJobType(jobText)) {
                jobs.push(canonicalJob);
              }
            } catch (error) {
              console.warn(`  ⚠️  Error processing LinkedIn job:`, error instanceof Error ? error.message : String(error));
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
        console.warn(`  ❌ Failed to search LinkedIn "${term}":`, error instanceof Error ? error.message : String(error));
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
  if (t.includes('placement') || t.includes('year in industry') || t.includes('industrial placement')) {
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

function generateHash(title: string, company: string, id?: string): string {
  const content = `${title}-${company}-${id || Date.now()}`;
  return Buffer.from(content).toString('base64').slice(0, 16);
}
