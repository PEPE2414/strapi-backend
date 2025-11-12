import { CanonicalJob } from '../types';
import { classifyJobType, isRelevantJobType, isUKJob, toISO, cleanJobDescription } from '../lib/normalize';
import { generateJobHash } from '../lib/jobHash';

type JobTeaserFeed = {
  university: string;
  url: string;
};

type JobTeaserJob = {
  id?: string | number;
  name?: string;
  title?: string;
  company?: { name?: string } | string;
  recruiter_name?: string;
  recruiter?: { name?: string };
  description?: string;
  description_html?: string;
  short_description?: string;
  apply_url?: string;
  url?: string;
  locations?: Array<{ name?: string }>;
  location?: string;
  published_at?: string;
  updated_at?: string;
  expires_at?: string;
};

const JOBTEASER_FEEDS: JobTeaserFeed[] = [
  { university: 'Oxford', url: 'https://oxford.jobteaser.com/api/v1/jobs' },
  { university: 'LSE', url: 'https://lse.jobteaser.com/api/v1/jobs' },
  { university: 'Imperial', url: 'https://imperial.jobteaser.com/api/v1/jobs' },
  { university: 'Cambridge', url: 'https://cambridge.jobteaser.com/api/v1/jobs' },
  { university: "King's College London", url: 'https://kcl.jobteaser.com/api/v1/jobs' },
  { university: 'Warwick', url: 'https://warwick.jobteaser.com/api/v1/jobs' },
  { university: 'Glasgow', url: 'https://glasgow.jobteaser.com/api/v1/jobs' },
  { university: 'Edinburgh', url: 'https://edinburgh.jobteaser.com/api/v1/jobs' },
  { university: 'Strathclyde Business School', url: 'https://strathbusiness.jobteaser.com/api/v1/jobs' },
  { university: 'Cranfield', url: 'https://cranfield.jobteaser.com/api/v1/jobs' },
  { university: 'City University London', url: 'https://city.jobteaser.com/api/v1/jobs' }
];

export async function scrapeJobTeaserFeeds(): Promise<CanonicalJob[]> {
  const collected: CanonicalJob[] = [];

  for (const feed of JOBTEASER_FEEDS) {
    try {
      const response = await fetch(feed.url, {
        method: 'GET',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'application/json, text/plain, */*',
          'Accept-Language': 'en-GB,en;q=0.9',
          'Referer': feed.url.replace('/api/v1/jobs', ''),
          'Origin': feed.url.split('/api')[0]
        }
      });
      if (!response.ok) {
        console.warn(`⚠️  JobTeaser feed failed (${feed.university}): ${response.status} ${response.statusText}`);
        continue;
      }

      let data: any;
      try {
        data = await response.json();
      } catch (error) {
        console.warn(`⚠️  JobTeaser feed not JSON (${feed.university})`);
        continue;
      }

      const jobs = extractJobTeaserJobs(data);
      if (jobs.length === 0) {
        console.log(`  📄 JobTeaser feed ${feed.university} returned no jobs`);
        continue;
      }

      console.log(`  📦 JobTeaser ${feed.university}: ${jobs.length} jobs`);

      for (const job of jobs) {
        const canonical = convertJobTeaserJob(job, feed);
        if (!canonical) continue;

        const text = `${canonical.title} ${canonical.descriptionText || canonical.descriptionHtml || ''} ${canonical.location || ''}`;
        if (!isRelevantJobType(text)) continue;
        if (!isUKJob(text)) continue;

        collected.push(canonical);
      }
    } catch (error) {
      console.warn(`⚠️  Error fetching JobTeaser feed ${feed.university}:`, error instanceof Error ? error.message : String(error));
    }
  }

  console.log(`✅ JobTeaser feeds collected ${collected.length} jobs`);
  return collected;
}

function extractJobTeaserJobs(payload: any): JobTeaserJob[] {
  if (!payload) return [];
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload.jobs)) return payload.jobs;
  if (Array.isArray(payload.data?.jobs)) return payload.data.jobs;
  if (Array.isArray(payload.results)) return payload.results;
  return [];
}

function convertJobTeaserJob(job: JobTeaserJob, feed: JobTeaserFeed): CanonicalJob | null {
  const title = job.name || job.title;
  const company =
    (typeof job.company === 'string' ? job.company : job.company?.name) ||
    job.recruiter_name ||
    job.recruiter?.name ||
    'Unknown Company';
  const applyUrl = job.apply_url || job.url;
  if (!title || !applyUrl) {
    return null;
  }

  const location =
    (Array.isArray(job.locations) && job.locations.length > 0 && job.locations[0]?.name) ||
    job.location ||
    'United Kingdom';

  const description = job.description || job.description_html || job.short_description || '';
  const cleanDescription = cleanJobDescription(description);
  const jobType = classifyJobType(`${title} ${cleanDescription}`);
  if (jobType === 'other') {
    return null;
  }

  const postedAt = toISO(job.published_at || job.updated_at);
  const applyDeadline = toISO(job.expires_at);

  const hash = generateJobHash({
    title,
    company,
    applyUrl,
    location,
    postedAt
  });

  return {
    source: `jobteaser:${feed.university.toLowerCase().replace(/\s+/g, '-')}`,
    sourceUrl: feed.url,
    title,
    company: { name: company },
    location,
    applyUrl,
    jobType,
    descriptionText: cleanDescription,
    postedAt,
    applyDeadline,
    slug: generateSlug(title, company),
    hash
  };
}

function generateSlug(title: string, company: string): string {
  return `${title}-${company}`.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80);
}


