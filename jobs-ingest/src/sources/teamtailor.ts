import { request } from 'undici';
import { CanonicalJob } from '../types';
import { resolveApplyUrl } from '../lib/applyUrl';
import { makeUniqueSlug } from '../lib/slug';
import { generateJobHash } from '../lib/jobHash';
import { classifyJobType, toISO, isRelevantJobType, isUKJob } from '../lib/normalize';

type TeamtailorAttributes = {
  title?: string;
  body?: string;
  url?: string;
  workplace_address?: string;
  updated_at?: string;
  created_at?: string;
};

type TeamtailorJob = {
  id?: string;
  attributes?: TeamtailorAttributes;
};

type TeamtailorResponse = {
  data?: TeamtailorJob[];
};

export async function scrapeTeamtailor(host: string): Promise<CanonicalJob[]> {
  const endpoint = `https://api.teamtailor.com/v1/jobs?host=${host}.teamtailor.com`;

  try {
    const { body } = await request(endpoint, {
      headers: {
        Accept: 'application/json',
        Authorization: 'Token token="public"'
      }
    });
    const data = await body.json() as TeamtailorResponse;
    const jobs = Array.isArray(data?.data) ? data.data : [];

    if (jobs.length === 0) {
      console.log(`📄 Teamtailor ${host}: no jobs returned`);
      return [];
    }

    const canonicalJobs = await Promise.all(jobs.map(async (job) => {
      const attributes = job.attributes || {};
      const title = String(attributes.title || '').trim();
      const location = String(attributes.workplace_address || '').trim();
      const description = String(attributes.body || '').trim();
      const fullText = `${title} ${location} ${description}`;

      if (!isRelevantJobType(fullText) || !isUKJob(fullText)) {
        return null;
      }

      const applyUrl = await resolveApplyUrl(attributes.url || '');
      const jobType = classifyJobType(`${title} ${description}`);
      const postedAt = toISO(attributes.updated_at || attributes.created_at);

      const hash = generateJobHash({
        title,
        company: host,
        applyUrl,
        location,
        postedAt
      });
      const slug = makeUniqueSlug(title, host, hash, location);

      const canonical: CanonicalJob = {
        source: `teamtailor:${host}`,
        sourceUrl: attributes.url || applyUrl,
        title,
        company: { name: host },
        location: location || undefined,
        descriptionHtml: description || undefined,
        descriptionText: undefined,
        applyUrl,
        jobType,
        postedAt,
        applyDeadline: undefined,
        salary: undefined,
        startDate: undefined,
        endDate: undefined,
        duration: undefined,
        experience: undefined,
        companyPageUrl: undefined,
        relatedDegree: undefined,
        degreeLevel: undefined,
        slug,
        hash
      };

      return canonical;
    }));

    return canonicalJobs.filter((job): job is CanonicalJob => job !== null);
  } catch (error) {
    console.warn(`Failed to scrape Teamtailor host ${host}:`, error instanceof Error ? error.message : String(error));
    return [];
  }
}

