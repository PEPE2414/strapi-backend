import { CanonicalJob } from '../types';
import { classifyJobType, isRelevantJobType, isUKJob, toISO } from '../lib/normalize';
import { generateJobHash } from '../lib/jobHash';
import { recordRapidApiRequest, logRapidApiUsage } from '../lib/rapidapiUsage';

type IndeedJob = {
  job_title?: string;
  title?: string;
  company_name?: string;
  company?: string;
  location?: string;
  job_location?: string;
  description?: string;
  job_description?: string;
  job_url?: string;
  url?: string;
  apply_link?: string;
  posted_at?: string;
  publish_date?: string;
  posted_on?: string;
};

const RATE_LIMIT_SLEEP_MS = Number(process.env.INDEED_REQUEST_DELAY_MS || 6500);

export async function scrapeIndeedCompanyJobs(): Promise<CanonicalJob[]> {
  if (!process.env.RAPIDAPI_KEY) {
    console.warn('⚠️  RAPIDAPI_KEY is not set. Skipping Indeed company jobs.');
    return [];
  }

  const companiesEnv = process.env.INDEED_COMPANY_IDS;
  if (!companiesEnv) {
    console.warn('⚠️  INDEED_COMPANY_IDS not provided. Set a comma-separated list of company identifiers.');
    return [];
  }

  const companies = companiesEnv.split(',').map(id => id.trim()).filter(Boolean);
  if (companies.length === 0) {
    console.warn('⚠️  INDEED_COMPANY_IDS did not contain valid company identifiers.');
    return [];
  }

  const locality = process.env.INDEED_LOCALITY || 'gb';
  const maxPagesEnv = Number(process.env.INDEED_MAX_START || 5);
  const maxPages = Number.isFinite(maxPagesEnv) && maxPagesEnv > 0 ? maxPagesEnv : 5;

  const results: CanonicalJob[] = [];

  for (const companyId of companies) {
    console.log(`  🏢 Fetching Indeed jobs for company "${companyId}"`);

    for (let start = 1; start <= maxPages; start += 1) {
      const url = new URL(`https://indeed12.p.rapidapi.com/company/${encodeURIComponent(companyId)}/jobs`);
      url.searchParams.set('locality', locality);
      url.searchParams.set('start', String(start));

      try {
        recordRapidApiRequest('indeed-company');
        const response = await fetch(url.toString(), {
          method: 'GET',
          headers: {
            'X-RapidAPI-Key': process.env.RAPIDAPI_KEY!,
            'X-RapidAPI-Host': 'indeed12.p.rapidapi.com'
          }
        });

        if (!response.ok) {
          const errorText = await response.text();
          console.warn(`  ⚠️  Indeed company request failed (${response.status}): ${errorText.substring(0, 200)}`);
          break;
        }

        const data = await response.json();
        const jobArray = extractIndeedJobs(data);
        if (jobArray.length === 0) {
          console.log(`    📄 No results at start=${start} for ${companyId}`);
          break;
        }

        console.log(`    📦 Indeed "${companyId}" start=${start}: ${jobArray.length} jobs`);

        for (const raw of jobArray) {
          const canonical = convertIndeedJob(raw);
          if (!canonical) continue;
          const fullText = `${canonical.title} ${canonical.descriptionText || canonical.descriptionHtml || ''} ${canonical.location || ''}`;
          if (!isRelevantJobType(fullText)) continue;
          if (!isUKJob(fullText)) continue;

          results.push(canonical);
        }
      } catch (error) {
        console.warn(`  ❌ Indeed company fetch failed (${companyId}, start=${start}):`, error instanceof Error ? error.message : String(error));
        break;
      }

      if (start < maxPages) {
        await new Promise(resolve => setTimeout(resolve, RATE_LIMIT_SLEEP_MS));
      }
    }
  }

  logRapidApiUsage('indeed-company', { jobs: results.length, companies: companies.length });
  return results;
}

function extractIndeedJobs(payload: any): IndeedJob[] {
  if (!payload) return [];
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload.jobs)) return payload.jobs;
  if (Array.isArray(payload.data)) return payload.data;
  if (Array.isArray(payload.results)) return payload.results;
  if (payload.data?.jobs && Array.isArray(payload.data.jobs)) return payload.data.jobs;
  return [];
}

function convertIndeedJob(job: IndeedJob): CanonicalJob | null {
  const title = job.job_title || job.title;
  const company = job.company_name || job.company;
  const applyUrl = job.job_url || job.url || job.apply_link;
  if (!title || !company || !applyUrl) {
    return null;
  }

  const location = job.location || job.job_location || '';
  const description = job.job_description || job.description || '';
  const jobType = classifyJobType(`${title} ${description}`);
  if (jobType === 'other') {
    return null;
  }

  const postedAt = toISO(job.posted_at || job.posted_on || job.publish_date);
  const hash = generateJobHash({
    title,
    company,
    applyUrl,
    location,
    postedAt
  });
  return {
    source: 'indeed-company',
    sourceUrl: applyUrl,
    title,
    company: { name: company },
    location,
    applyUrl,
    jobType,
    descriptionText: description ? description.replace(/\s+/g, ' ').trim() : undefined,
    descriptionHtml: description || undefined,
    postedAt,
    slug: generateSlug(title, company),
    hash
  };
}

function generateSlug(title: string, company: string): string {
  return `${title}-${company}`.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80);
}


