import { CanonicalJob } from '../types';
import { toISO } from '../lib/normalize';

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

  // Search terms for graduate jobs and placements
  const searchTerms = [
    'graduate',
    'graduate scheme', 
    'entry level',
    'placement',
    'industrial placement',
    'placement year',
    'year in industry',
    'internship',
    'summer internship',
    'graduate trainee',
    'graduate analyst',
    'graduate engineer',
    'graduate consultant',
    'junior',
    'entry level analyst',
    'entry level engineer'
  ];

  try {
    for (const term of searchTerms) {
      console.log(`  🔍 Searching for: "${term}"`);
      
      try {
        const response = await fetch('https://active-jobs-db.p.rapidapi.com/search', {
          method: 'POST',
          headers: {
            'X-RapidAPI-Key': process.env.RAPIDAPI_KEY,
            'X-RapidAPI-Host': 'active-jobs-db.p.rapidapi.com',
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            query: term,
            location: 'United Kingdom',
            country: 'UK',
            limit: 50, // Max results per search
            sort: 'date' // Most recent first
          })
        });

        if (!response.ok) {
          console.warn(`  ⚠️  RapidAPI request failed: ${response.status} ${response.statusText}`);
          continue;
        }

        const data = await response.json() as any;
        
        if (data.jobs && Array.isArray(data.jobs)) {
          console.log(`  📦 Found ${data.jobs.length} jobs for "${term}"`);
          
          for (const job of data.jobs) {
            try {
              const canonicalJob: CanonicalJob = {
                title: job.title || 'Unknown Title',
                company: { name: job.company || job.employer || 'Unknown Company' },
                location: job.location || job.city || 'UK',
                applyUrl: job.url || job.apply_url || job.link || `https://rapidapi-active-jobs-db.com/job/${job.id}`,
                descriptionText: job.description || job.summary || '',
                descriptionHtml: job.description || job.summary || '',
                source: 'RapidAPI Active Jobs DB',
                sourceUrl: 'https://rapidapi.com/active-jobs-db',
                jobType: classifyJobType(job.title + ' ' + (job.description || '')),
                salary: job.salary ? {
                  min: job.salary.min || job.salary.from,
                  max: job.salary.max || job.salary.to,
                  currency: job.salary.currency || 'GBP',
                  period: job.salary.period || 'year'
                } : undefined,
                applyDeadline: job.deadline || job.expires || job.closing_date ? toISO(job.deadline || job.expires || job.closing_date) : undefined,
                slug: generateSlug(job.title, job.company || job.employer),
                hash: generateHash(job.title, job.company || job.employer, job.id)
              };

              // Filter for UK jobs and relevant job types
              const jobText = canonicalJob.title + ' ' + (canonicalJob.descriptionText || '');
              if (isUKJob(canonicalJob.location || '') && isRelevantJobType(jobText)) {
                jobs.push(canonicalJob);
              }
            } catch (error) {
              console.warn(`  ⚠️  Error processing job:`, error instanceof Error ? error.message : String(error));
            }
          }
        } else {
          console.log(`  📄 No jobs found for "${term}"`);
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
