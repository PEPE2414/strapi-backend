import { CanonicalJob } from '../types';
import { SLOT_DEFINITIONS, getCurrentRunSlot, isBacklogSlot, buildPlacementBoostTerms } from '../lib/runSlots';
import { cleanJobDescription, isRelevantJobType, isUKJob } from '../lib/normalize';
import { generateJobHash } from '../lib/jobHash';
import { getPopularTitles, JobTypeKey } from '../lib/jobKeywords';

interface GlassdoorJob {
  jobId?: string;
  jobTitle?: string;
  title?: string;
  companyName?: string;
  employerName?: string;
  company?: string;
  jobDescription?: string;
  description?: string;
  jobUrl?: string;
  url?: string;
  applyUrl?: string;
  jobLocation?: string;
  location?: string;
  jobCity?: string;
  jobCountry?: string;
  postedDate?: string;
  publishDate?: string;
  industries?: string[];
}

const JOB_TYPES: JobTypeKey[] = ['graduate', 'placement', 'internship'];

export async function scrapeGlassdoorJobs(): Promise<CanonicalJob[]> {
  if (!process.env.RAPIDAPI_KEY) {
    console.warn('⚠️  RAPIDAPI_KEY is not set. Skipping Glassdoor Real-Time API.');
    return [];
  }

  const { slotIndex } = getCurrentRunSlot();
  const slotDefinition = SLOT_DEFINITIONS[slotIndex];
  const backlogMode = isBacklogSlot(slotIndex);

  const queries = buildQueries(slotDefinition, backlogMode);
  console.log(`  🕒 Glassdoor run slot: ${slotIndex + 1}/${SLOT_DEFINITIONS.length} (${slotDefinition.name})`);
  console.log(`  🔎 Glassdoor will search ${queries.length} query combinations`);

  const seen = new Set<string>();
  const results: CanonicalJob[] = [];
  let duplicates = 0;

  for (const { query, page } of queries) {
    try {
      const url = new URL('https://glassdoor-real-time.p.rapidapi.com/jobs/search');
      url.searchParams.set('query', query);
      url.searchParams.set('location', 'United Kingdom');
      url.searchParams.set('page', page.toString());

      const response = await fetch(url.toString(), {
        method: 'GET',
        headers: {
          'X-RapidAPI-Key': process.env.RAPIDAPI_KEY!,
          'X-RapidAPI-Host': 'glassdoor-real-time.p.rapidapi.com'
        }
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.warn(`  ⚠️  Glassdoor request failed (${response.status}): ${errorText.substring(0, 200)}`);
        continue;
      }

      const data = await response.json();
      const jobs = extractJobs(data);
      if (jobs.length === 0) continue;

      console.log(`    📦 Glassdoor "${query}" page ${page}: ${jobs.length} jobs`);

      for (const raw of jobs) {
        const canonical = convertJob(raw);
        if (!canonical) continue;

        const key = canonical.hash;
        if (seen.has(key)) {
          duplicates++;
          continue;
        }
        seen.add(key);

        const text = `${canonical.title} ${canonical.descriptionText || canonical.descriptionHtml || ''} ${canonical.location || ''}`.toLowerCase();
        if (!isRelevantJobType(text)) continue;
        if (!isUKJob(text)) continue;

        results.push(canonical);
      }
    } catch (error) {
      console.warn(`  ❌ Glassdoor query "${query}" failed:`, error instanceof Error ? error.message : String(error));
    }
  }

  if (duplicates > 0) {
    console.log(`  🔁 Glassdoor dedup removed ${duplicates} duplicates`);
  }

  return results;
}

function extractJobs(data: any): GlassdoorJob[] {
  if (!data) return [];
  if (Array.isArray(data)) return data;
  if (Array.isArray(data.data)) return data.data;
  if (Array.isArray(data.results)) return data.results;
  if (data.data?.jobs && Array.isArray(data.data.jobs)) return data.data.jobs;
  return [];
}

function convertJob(job: GlassdoorJob): CanonicalJob | null {
  const title = job.jobTitle || job.title;
  const company = job.companyName || job.employerName || job.company;
  const applyUrl = job.applyUrl || job.jobUrl || job.url;
  if (!title || !company || !applyUrl) {
    return null;
  }

  const location = job.jobLocation || job.location || job.jobCity || '';
  const description = job.jobDescription || job.description || '';
  const cleanDesc = cleanJobDescription(description);
  const postedAt = toISO(job.postedDate || job.publishDate);

  return {
    source: 'glassdoor-real-time',
    sourceUrl: 'https://glassdoor-real-time.p.rapidapi.com/jobs/search',
    title,
    company: { name: company },
    location,
    applyUrl,
    descriptionText: cleanDesc,
    descriptionHtml: description || undefined,
    jobType: classifyJobType(description),
    postedAt,
    slug: generateSlug(title, company),
    hash: generateJobHash({
      title,
      company,
      applyUrl,
      location,
      postedAt
    })
  };
}

function classifyJobType(text: string): 'internship' | 'placement' | 'graduate' | 'other' {
  const lower = text.toLowerCase();
  if (/\b(internship|intern|summer analyst|spring week|off-cycle)\b/.test(lower)) return 'internship';
  if (/\b(placement|placement year|year placement|year in industry|industrial placement|industrial placement year|industrial trainee|industrial training placement|work placement|student placement|placement student|professional placement|undergraduate placement|industry placement|placement scheme|placement programme|sandwich placement|sandwich course|sandwich degree|sandwich year)\b/.test(lower)) return 'placement';
  if (/\b(graduate|graduate scheme|graduate programme|graduate program|early careers)\b/.test(lower)) return 'graduate';
  return 'other';
}

function buildQueries(slot: typeof SLOT_DEFINITIONS[number], backlog: boolean): { query: string; page: number }[] {
  const queries: { query: string; page: number }[] = [];
  const pages = backlog ? 2 : 1;

  const placementBoostTerms = buildPlacementBoostTerms(slot);
  placementBoostTerms.forEach(term => {
    const base = term.includes('uk') || term.includes('united kingdom') ? term : `${term} uk`;
    for (let page = 1; page <= pages; page++) {
      queries.push({ query: base, page });
    }
  });

  slot.industries.forEach(industry => {
    JOB_TYPES.forEach(jobType => {
      const baseQuery = `${jobType} ${industry}`;
      for (let page = 1; page <= pages; page++) {
        queries.push({ query: `${baseQuery} uk`, page });
      }

      getPopularTitles(industry, jobType)
        .slice(0, 5)
        .forEach(title => {
          for (let page = 1; page <= pages; page++) {
            queries.push({ query: `${title}`, page });
          }
        });
    });
  });

  slot.cities.forEach(city => {
    JOB_TYPES.forEach(jobType => {
      for (let page = 1; page <= pages; page++) {
        queries.push({ query: `${jobType} jobs ${city}`, page });
      }

      getPopularTitles(city, jobType)
        .slice(0, 3)
        .forEach(title => {
          for (let page = 1; page <= pages; page++) {
            queries.push({ query: `${title} ${city}`, page });
          }
        });
    });
  });

  return queries.slice(0, 120);
}

function generateSlug(title: string, company: string): string {
  return `${title}-${company}`.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80);
}

function toISO(value?: string): string | undefined {
  if (!value) return undefined;
  const date = new Date(value);
  if (isNaN(date.getTime())) return undefined;
  return date.toISOString();
}


