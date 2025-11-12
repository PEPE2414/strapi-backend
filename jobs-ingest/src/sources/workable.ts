import { request } from 'undici';
import { CanonicalJob } from '../types';
import { resolveApplyUrl } from '../lib/applyUrl';
import { makeUniqueSlug } from '../lib/slug';
import { generateJobHash } from '../lib/jobHash';
import { classifyJobType, toISO, isRelevantJobType, isUKJob } from '../lib/normalize';

type WorkableLocation = {
  city?: string;
  region?: string;
  country?: string;
};

type WorkableJob = {
  shortcode?: string;
  title?: string;
  url?: string;
  updated_at?: string;
  created_at?: string;
  description?: string;
  content?: string;
  location?: WorkableLocation;
};

type WorkableResponse = {
  jobs?: WorkableJob[];
};

export async function scrapeWorkable(company: string): Promise<CanonicalJob[]> {
  // Try Perplexity discovery first to get the most up-to-date URL
  let endpoint = `https://${company}.workable.com/api/v3/jobs?state=published`;
  
  try {
    const { discoverUrlsWithPerplexity } = await import('../lib/perplexityUrlDiscovery');
    const discoveredUrls = await discoverUrlsWithPerplexity('workable', `workable:${company}`, company);
    if (discoveredUrls.length > 0) {
      const workableUrl = discoveredUrls.find(url => url.includes('workable.com'));
      if (workableUrl) {
        endpoint = workableUrl;
        console.log(`🤖 Using Perplexity-discovered URL for ${company}: ${endpoint}`);
      }
    }
  } catch (error) {
    // Fall back to default endpoint
  }

  try {
    const { body } = await request(endpoint, {
      headers: { Accept: 'application/json' }
    });
    const data = await body.json() as WorkableResponse;
    const jobs = Array.isArray(data?.jobs) ? data.jobs : [];

    if (jobs.length === 0) {
      console.log(`📄 Workable ${company}: no published jobs returned`);
      return [];
    }

    const enriched = await Promise.all(jobs.map(async (job) => {
      let description = job.description || job.content || '';

      if (!description && job.shortcode) {
        try {
          const detailUrl = `https://${company}.workable.com/api/v3/jobs/${job.shortcode}`;
          const { body: detailBody } = await request(detailUrl, {
            headers: { Accept: 'application/json' }
          });
          const detailJson = await detailBody.json() as any;
          description = detailJson?.job?.description || detailJson?.description || detailJson?.content || '';
        } catch (error) {
          console.warn(`⚠️  Failed to fetch Workable job detail (${company}/${job.shortcode}):`, error instanceof Error ? error.message : String(error));
        }
      }

      const title = String(job.title || '').trim();
      const locationParts = [
        job.location?.city,
        job.location?.region,
        job.location?.country
      ].filter(Boolean);
      const location = locationParts.join(', ');
      const fullText = `${title} ${location} ${description}`;

      if (!isRelevantJobType(fullText) || !isUKJob(fullText)) {
        return null;
      }

      const applyUrl = await resolveApplyUrl(job.url || '');
      const jobType = classifyJobType(`${title} ${description}`);
      const postedAt = toISO(job.updated_at || job.created_at);

      const hash = generateJobHash({
        title,
        company,
        applyUrl,
        location,
        postedAt
      });
      const slug = makeUniqueSlug(title, company, hash, location);

      const canonical: CanonicalJob = {
        source: `workable:${company}`,
        sourceUrl: job.url || applyUrl,
        title,
        company: { name: company },
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

    return enriched.filter((job): job is CanonicalJob => job !== null);
  } catch (error) {
    console.warn(`Failed to scrape Workable company ${company}:`, error instanceof Error ? error.message : String(error));
    return [];
  }
}

