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
  // Try Perplexity discovery first to get the most up-to-date URL
  let endpoint = `https://api.teamtailor.com/v1/jobs?host=${host}.teamtailor.com`;
  
  try {
    const { discoverUrlsWithPerplexity } = await import('../lib/perplexityUrlDiscovery');
    const discoveredUrls = await discoverUrlsWithPerplexity('teamtailor', `teamtailor:${host}`, host);
    if (discoveredUrls.length > 0) {
      // Look for valid Teamtailor API endpoint (must have /v1/jobs and ?host= parameter)
      const teamtailorUrl = discoveredUrls.find(url => 
        url.includes('teamtailor.com') && 
        url.includes('/v1/jobs') &&
        url.includes(`host=${host}`)
      );
      if (teamtailorUrl) {
        endpoint = teamtailorUrl;
        console.log(`🤖 Using Perplexity-discovered URL for ${host}: ${endpoint}`);
      } else {
        console.log(`⚠️  Perplexity found URLs but none are valid Teamtailor API endpoints (must include /v1/jobs and host parameter), using default`);
      }
    }
  } catch (error) {
    // Fall back to default endpoint
  }

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
      // Try alternative host name variations
      const altHosts = [
        host.toLowerCase(),
        host.replace(/-/g, ''),
        host.replace(/-/g, '_'),
        host.split('-')[0],
        host.replace(/\./g, '-')
      ];
      
      for (const altHost of altHosts.slice(1)) { // Skip first (already tried)
        if (altHost === host) continue;
        const altEndpoint = `https://api.teamtailor.com/v1/jobs?host=${altHost}.teamtailor.com`;
        console.log(`⚠️  Trying alternative host name: ${altHost} (${altEndpoint})`);
        try {
          const { body: altBody } = await request(altEndpoint, {
            headers: {
              Accept: 'application/json',
              Authorization: 'Token token="public"'
            }
          });
          const altData = await altBody.json() as TeamtailorResponse;
          const altJobs = Array.isArray(altData?.data) ? altData.data : [];
          if (altJobs.length > 0) {
            console.log(`✅ Teamtailor ${host}: Found ${altJobs.length} jobs using alternative host "${altHost}"`);
            // Process jobs with alternative host (same code as below)
            const canonicalJobs = await Promise.all(altJobs.map(async (job) => {
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

              return {
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
              } as CanonicalJob;
            }));
            return canonicalJobs.filter((job): job is CanonicalJob => job !== null);
          }
        } catch (altError) {
          // Continue to next alternative
        }
      }
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

