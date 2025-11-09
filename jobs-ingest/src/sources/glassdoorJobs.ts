import { CanonicalJob } from '../types';
import { generateJobHash } from '../lib/jobHash';
import { cleanJobDescription, isRelevantJobType, isUKJob } from '../lib/normalize';

interface GlassdoorJob {
  jobId?: string;
  title?: string;
  companyName?: string;
  company?: string;
  description?: string;
  url?: string;
  applyUrl?: string;
  location?: string;
  jobCity?: string;
  jobCountry?: string;
  postedDate?: string;
  industries?: string[];
  jobType?: string;
}

export async function scrapeGlassdoorJobs(jobIds: string[]): Promise<CanonicalJob[]> {
  if (!process.env.RAPIDAPI_KEY) {
    console.warn('⚠️  RAPIDAPI_KEY is not set. Skipping Glassdoor Real-Time API.');
    return [];
  }

  const jobs: CanonicalJob[] = [];

  for (const jobId of jobIds) {
    try {
      const url = `https://glassdoor-real-time.p.rapidapi.com/jobs/detail?jobId=${encodeURIComponent(jobId)}`;

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'X-RapidAPI-Key': process.env.RAPIDAPI_KEY!,
          'X-RapidAPI-Host': 'glassdoor-real-time.p.rapidapi.com'
        }
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.warn(`⚠️  Glassdoor Real-Time API request failed (${response.status}): ${errorText.substring(0, 200)}`);
        continue;
      }

      const data = await response.json() as { data?: GlassdoorJob };
      if (!data?.data) {
        continue;
      }

      const raw = data.data;
      const job = convertJob(raw);
      if (!job) continue;

      const text = `${job.title} ${job.descriptionText || job.descriptionHtml || ''} ${job.location || ''}`.toLowerCase();
      if (!isRelevantJobType(text)) continue;
      if (!isUKJob(text)) continue;

      jobs.push(job);
    } catch (error) {
      console.warn(`❌ Failed to fetch Glassdoor job ${jobId}:`, error instanceof Error ? error.message : String(error));
    }
  }

  return jobs;
}

function convertJob(job: GlassdoorJob): CanonicalJob | null {
  const title = job.title;
  const company = job.companyName || job.company;
  const applyUrl = job.applyUrl || job.url;
  if (!title || !company || !applyUrl) {
    return null;
  }

  const description = job.description || '';
  const cleanDesc = cleanJobDescription(description);
  const location = job.location || job.jobCity || '';
  const postedAt = job.postedDate ? toISO(job.postedDate) : undefined;

  return {
    source: 'glassdoor-real-time',
    sourceUrl: 'https://glassdoor-real-time.p.rapidapi.com/jobs/detail',
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
  if (/\b(internship|intern)\b/.test(lower)) return 'internship';
  if (/\b(placement|year in industry|industrial placement)\b/.test(lower)) return 'placement';
  if (/\b(graduate|graduate scheme|graduate programme|graduate program|early careers)\b/.test(lower)) return 'graduate';
  return 'other';
}

function generateSlug(title: string, company: string): string {
  return `${title}-${company}`.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80);
}

function toISO(value: string): string | undefined {
  const date = new Date(value);
  if (isNaN(date.getTime())) return undefined;
  return date.toISOString();
}

