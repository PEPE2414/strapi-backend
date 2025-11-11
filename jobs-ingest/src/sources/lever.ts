import { request } from 'undici';
import { CanonicalJob } from '../types';
import { resolveApplyUrl } from '../lib/applyUrl';
import { generateJobHash } from '../lib/jobHash';
import { makeUniqueSlug } from '../lib/slug';
import { classifyJobType, toISO, isRelevantJobType, isUKJob } from '../lib/normalize';

type LeverPosting = {
  id?: string;
  text?: string;
  hostedUrl?: string;
  applyUrl?: string;
  description?: string;
  descriptionPlain?: string;
  createdAt?: string | number;
  updatedAt?: string | number;
  categories?: {
    location?: string;
    commitment?: string;
    team?: string;
  };
};

export async function scrapeLever(company: string): Promise<CanonicalJob[]> {
  const endpoint = `https://api.lever.co/v0/postings/${company}?mode=json`;

  try {
    const { body } = await request(endpoint, {
      headers: { Accept: 'application/json' }
    });
    const response = await body.json();

    if (!Array.isArray(response)) {
      console.warn(`Lever API returned non-array payload for ${company}`, response);
      return [];
    }

    const postings = response as LeverPosting[];

    const relevantPostings = postings.filter((posting) => {
      const title = String(posting.text || '').trim();
      const location = String(posting.categories?.location || '').trim();
      const description = String(posting.descriptionPlain || posting.description || '').trim();
      const team = String(posting.categories?.team || '').trim();
      const fullText = `${title} ${location} ${description} ${team}`;

      return isRelevantJobType(fullText) && isUKJob(fullText);
    });

    console.log(`📊 Lever ${company}: ${postings.length} jobs, ${relevantPostings.length} relevant UK graduate roles`);

    return await Promise.all(relevantPostings.map(async (posting) => {
      const title = String(posting.text || '').trim();
      const location = posting.categories?.location || '';
      const descriptionHtml = posting.description || posting.descriptionPlain || '';
      const applyUrl = await resolveApplyUrl(posting.hostedUrl || posting.applyUrl || '');
      const jobType = classifyJobType(`${title} ${posting.categories?.team || ''}`);
      const companyName = company;
      const rawTimestamp = posting.updatedAt ?? posting.createdAt;
      const postedAt =
        typeof rawTimestamp === 'number'
          ? new Date(rawTimestamp).toISOString()
          : toISO(rawTimestamp);

      const hash = generateJobHash({
        title,
        company: companyName,
        applyUrl,
        location,
        postedAt
      });
      const slug = makeUniqueSlug(title, companyName, hash, location);

      const canonical: CanonicalJob = {
        source: `lever:${company}`,
        sourceUrl: posting.hostedUrl || posting.applyUrl || applyUrl,
        title,
        company: { name: companyName },
        location: location || undefined,
        descriptionHtml: descriptionHtml || undefined,
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
  } catch (error) {
    console.warn(`Failed to scrape Lever company ${company}:`, error instanceof Error ? error.message : String(error));
    return [];
  }
}
