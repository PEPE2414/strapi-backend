import { request } from 'undici';
import { CanonicalJob } from '../types';
import { resolveApplyUrl } from '../lib/applyUrl';
import { makeUniqueSlug } from '../lib/slug';
import { generateJobHash } from '../lib/jobHash';
import { classifyJobType, toISO, isRelevantJobType, isUKJob } from '../lib/normalize';

type GreenhouseJob = {
  id: number;
  title?: string;
  location?: { name?: string };
  absolute_url?: string;
  updated_at?: string;
  metadata?: Array<{ name?: string; value?: string }>;
  content?: string;
};

type GreenhouseResponse = {
  jobs?: GreenhouseJob[];
  error?: string;
};

export async function scrapeGreenhouse(board: string): Promise<CanonicalJob[]> {
  const endpoint = `https://boards.greenhouse.io/${board}/embed/job_board?content=true`;

  try {
    const { body } = await request(endpoint, {
      headers: { Accept: 'application/json' }
    });
    const data = await body.json() as GreenhouseResponse;

    if (data.error) {
      console.warn(`Greenhouse embed error for ${board}: ${data.error}`);
      return [];
    }

    const jobs = Array.isArray(data.jobs) ? data.jobs : [];
    if (jobs.length === 0) {
      console.log(`📄 Greenhouse ${board}: no jobs returned from embed endpoint`);
      return [];
    }

    const relevantJobs = jobs.filter(job => {
      const title = String(job.title || '').trim();
      const location = String(job.location?.name || '').trim();
      const description = String(job.content || '').trim();
      const fullText = `${title} ${location} ${description}`;

      return isRelevantJobType(fullText) && isUKJob(fullText);
    });

    console.log(`📊 Greenhouse ${board}: ${jobs.length} jobs, ${relevantJobs.length} relevant UK graduate roles`);

    return await Promise.all(relevantJobs.map(async (job) => {
      const title = String(job.title || '').trim();
      const location = job.location?.name || '';
      const description = job.content || '';
      const applyUrl = await resolveApplyUrl(job.absolute_url || '');
      const metadataValues = Array.isArray(job.metadata)
        ? job.metadata.map(item => item?.value || '').join(' ')
        : '';

      const jobTypeText = `${title} ${metadataValues}`;
      const jobType = classifyJobType(jobTypeText);
      const companyName = board;

      const hash = generateJobHash({
        title,
        company: companyName,
        applyUrl,
        location,
        postedAt: job.updated_at
      });
      const slug = makeUniqueSlug(title, companyName, hash, location);

      const canonical: CanonicalJob = {
        source: `greenhouse:${board}`,
        sourceUrl: job.absolute_url || applyUrl,
        title,
        company: { name: companyName },
        location: location || undefined,
        descriptionHtml: description || undefined,
        descriptionText: undefined,
        applyUrl,
        applyDeadline: undefined,
        jobType,
        salary: undefined,
        startDate: undefined,
        endDate: undefined,
        duration: undefined,
        experience: undefined,
        companyPageUrl: undefined,
        relatedDegree: undefined,
        degreeLevel: undefined,
        postedAt: toISO(job.updated_at),
        slug,
        hash
      };

      return canonical;
    }));
  } catch (error) {
    console.warn(`Failed to scrape Greenhouse board ${board}:`, error instanceof Error ? error.message : String(error));
    return [];
  }
}
