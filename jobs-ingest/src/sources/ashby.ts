import { request } from 'undici';
import { CanonicalJob } from '../types';
import { resolveApplyUrl } from '../lib/applyUrl';
import { makeUniqueSlug } from '../lib/slug';
import { generateJobHash } from '../lib/jobHash';
import { classifyJobType, toISO, isRelevantJobType, isUKJob } from '../lib/normalize';

type AshbyJobPosting = {
  title?: string;
  location?: string;
  url?: string;
  updatedAt?: string;
  descriptionHtml?: string;
  description?: string;
  descriptionPlainText?: string;
  sections?: Array<{ content?: string; title?: string }>;
};

type AshbyResponse = {
  jobBoard?: {
    jobPostings?: AshbyJobPosting[];
  };
};

export async function scrapeAshby(organizationSlug: string): Promise<CanonicalJob[]> {
  // Try Perplexity discovery first to get the most up-to-date URL
  let endpoint = `https://jobs.ashbyhq.com/api/non_authenticated/job_board?organization_slug=${organizationSlug}`;
  
  try {
    const { discoverUrlsWithPerplexity } = await import('../lib/perplexityUrlDiscovery');
    const discoveredUrls = await discoverUrlsWithPerplexity('ashby', `ashby:${organizationSlug}`, organizationSlug);
    if (discoveredUrls.length > 0) {
      const ashbyUrl = discoveredUrls.find(url => url.includes('ashbyhq.com'));
      if (ashbyUrl) {
        endpoint = ashbyUrl;
        console.log(`🤖 Using Perplexity-discovered URL for ${organizationSlug}: ${endpoint}`);
      }
    }
  } catch (error) {
    // Fall back to default endpoint
  }

  try {
    const { body } = await request(endpoint, {
      headers: { Accept: 'application/json' }
    });
    const data = await body.json() as AshbyResponse;
    const postings = Array.isArray(data?.jobBoard?.jobPostings) ? data.jobBoard.jobPostings : [];

    if (postings.length === 0) {
      console.log(`📄 Ashby ${organizationSlug}: no postings returned`);
      return [];
    }

    const jobs = await Promise.all(postings.map(async (posting) => {
      const title = String(posting.title || '').trim();
      const location = String(posting.location || '').trim();
      const description =
        posting.descriptionHtml ||
        posting.description ||
        posting.descriptionPlainText ||
        (Array.isArray(posting.sections)
          ? posting.sections.map(section => section?.content || '').join('\n')
          : '');

      const fullText = `${title} ${location} ${description}`;
      if (!isRelevantJobType(fullText) || !isUKJob(fullText)) {
        return null;
      }

      const applyUrl = await resolveApplyUrl(posting.url || '');
      const jobType = classifyJobType(`${title} ${description}`);
      const postedAt = toISO(posting.updatedAt);

      const hash = generateJobHash({
        title,
        company: organizationSlug,
        applyUrl,
        location,
        postedAt
      });
      const slug = makeUniqueSlug(title, organizationSlug, hash, location);

      const canonical: CanonicalJob = {
        source: `ashby:${organizationSlug}`,
        sourceUrl: posting.url || applyUrl,
        title,
        company: { name: organizationSlug },
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

    return jobs.filter((job): job is CanonicalJob => job !== null);
  } catch (error) {
    console.warn(`Failed to scrape Ashby organization ${organizationSlug}:`, error instanceof Error ? error.message : String(error));
    return [];
  }
}

