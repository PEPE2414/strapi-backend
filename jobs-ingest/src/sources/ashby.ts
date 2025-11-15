import { request } from 'undici';
import { CanonicalJob } from '../types';
import { resolveApplyUrl } from '../lib/applyUrl';
import { makeUniqueSlug } from '../lib/slug';
import { generateJobHash } from '../lib/jobHash';
import { classifyJobType, toISO, isRelevantJobType, isUKJob } from '../lib/normalize';
import { decompressUndiciResponse } from '../lib/decompressResponse';

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
      // Look for valid Ashby API endpoint (must have /job_board and organization_slug parameter)
      const ashbyUrl = discoveredUrls.find(url => 
        url.includes('ashbyhq.com') && 
        (url.includes('/job_board') || url.includes('/non_authenticated/job_board')) &&
        url.includes(`organization_slug=${organizationSlug}`)
      );
      if (ashbyUrl) {
        endpoint = ashbyUrl;
        console.log(`🤖 Using Perplexity-discovered URL for ${organizationSlug}: ${endpoint}`);
      } else {
        console.log(`⚠️  Perplexity found URLs but none are valid Ashby API endpoints (must include /job_board and organization_slug), using default`);
      }
    }
  } catch (error) {
    // Fall back to default endpoint
  }

  try {
    const { body, statusCode } = await request(endpoint, {
      headers: { Accept: 'application/json' }
    });
    // Use decompressResponse to handle binary/compressed data
    let text: string;
    try {
      text = await decompressUndiciResponse(body, {});
    } catch (decompressError) {
      text = await body.text();
    }
    
    // Check if response is text (error) instead of JSON
    if (statusCode !== 200 || text.trim().startsWith('Unauthorized') || text.trim().startsWith('<')) {
      console.warn(`⚠️  Ashby ${organizationSlug}: Received error response (${statusCode}): ${text.substring(0, 100)}`);
      // Try alternative endpoint format and organization slug variations
      const altSlugs = [
        organizationSlug.toLowerCase(), // monzo
        organizationSlug.replace(/-/g, ''), // monzo
        organizationSlug.replace(/-/g, '_'), // monzo
        organizationSlug.split('-')[0], // monzo
        'monzo-bank', // Try with suffix
        'monzo-banking', // Alternative
        'getmonzo' // Alternative name
      ];
      
      // Try alternative endpoint format first
      const altEndpoint = `https://jobs.ashbyhq.com/${organizationSlug}`;
      console.log(`⚠️  Trying alternative endpoint: ${altEndpoint}`);
      try {
        const { body: altBody } = await request(altEndpoint, {
          headers: { Accept: 'application/json' }
        });
        // Use decompressResponse for alternative endpoint
        let altText: string;
        try {
          altText = await decompressUndiciResponse(altBody, {});
        } catch (decompressError) {
          altText = await altBody.text();
        }
        if (!altText.trim().startsWith('Unauthorized') && !altText.trim().startsWith('<')) {
          try {
            const altData = JSON.parse(altText) as AshbyResponse;
            const postings = Array.isArray(altData?.jobBoard?.jobPostings) ? altData.jobBoard.jobPostings : [];
            if (postings.length > 0) {
              console.log(`✅ Ashby ${organizationSlug}: Found ${postings.length} jobs via alternative endpoint`);
              // Process postings (continue with existing code)
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
                return {
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
                } as CanonicalJob;
              }));
              return jobs.filter((job): job is CanonicalJob => job !== null);
            }
          } catch (parseError) {
            console.warn(`⚠️  Ashby ${organizationSlug}: Failed to parse alternative endpoint response`);
          }
        }
      } catch (altError) {
        // Try alternative organization slug variations
        for (const altSlug of altSlugs.slice(1)) { // Skip first (already tried)
          if (altSlug === organizationSlug) continue;
          const altSlugEndpoint = `https://jobs.ashbyhq.com/api/non_authenticated/job_board?organization_slug=${altSlug}`;
          console.log(`⚠️  Trying alternative organization slug: ${altSlug} (${altSlugEndpoint})`);
          try {
            const { body: altSlugBody } = await request(altSlugEndpoint, {
              headers: { Accept: 'application/json' }
            });
            const altSlugText = await altSlugBody.text();
            if (!altSlugText.trim().startsWith('Unauthorized') && !altSlugText.trim().startsWith('<')) {
              const altSlugData = JSON.parse(altSlugText) as AshbyResponse;
              const altSlugPostings = Array.isArray(altSlugData?.jobBoard?.jobPostings) ? altSlugData.jobBoard.jobPostings : [];
              if (altSlugPostings.length > 0) {
                console.log(`✅ Ashby ${organizationSlug}: Found ${altSlugPostings.length} jobs using alternative slug "${altSlug}"`);
                // Process postings (same code as below)
                const jobs = await Promise.all(altSlugPostings.map(async (posting) => {
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
                  return {
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
                  } as CanonicalJob;
                }));
                return jobs.filter((job): job is CanonicalJob => job !== null);
              }
            }
          } catch (altSlugError) {
            // Continue to next alternative
          }
        }
        console.warn(`⚠️  Ashby ${organizationSlug}: All alternative endpoints and slugs failed`);
      }
      return [];
    }
    
    const data = JSON.parse(text) as AshbyResponse;
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

