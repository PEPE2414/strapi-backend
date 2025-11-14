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
  // Try Perplexity discovery first to get the most up-to-date URL
  let endpoint = `https://api.lever.co/v0/postings/${company}?mode=json`;
  
  try {
    const { discoverUrlsWithPerplexity } = await import('../lib/perplexityUrlDiscovery');
    const discoveredUrls = await discoverUrlsWithPerplexity('lever', `lever:${company}`, company);
    if (discoveredUrls.length > 0) {
      // Look for valid Lever API endpoint (v0 with /postings/ path)
      const leverUrl = discoveredUrls.find(url => 
        url.includes('lever.co') && 
        url.includes('/postings/') &&
        (url.includes('/v0/') || url.includes('api.lever.co/v0/'))
      );
      if (leverUrl) {
        // Ensure it has ?mode=json parameter
        endpoint = leverUrl.includes('?') ? leverUrl : `${leverUrl}?mode=json`;
        console.log(`🤖 Using Perplexity-discovered URL for ${company}: ${endpoint}`);
      } else {
        console.log(`⚠️  Perplexity found URLs but none are valid Lever API endpoints (must include /v0/postings/), using default`);
      }
    }
  } catch (error) {
    // Fall back to default endpoint
  }

  try {
    const { body, statusCode } = await request(endpoint, {
      headers: { Accept: 'application/json' }
    });
    const text = await body.text();
    
    // Check for authentication errors
    if (statusCode === 401 || statusCode === 403) {
      console.warn(`⚠️  Lever ${company}: Authentication required (${statusCode}). The API may require authentication or the company name may be incorrect.`);
      // Try alternative company name variations
      const altNames = [
        company.toLowerCase(), // netflix
        company.replace(/-/g, ''), // netflix
        company.replace(/-/g, '_'), // netflix
        company.split('-')[0], // netflix
        'netflix-uk', // Try with suffix
        'netflixinc', // Alternative format
        'netflix-inc' // With hyphen
      ];
      
      for (const altName of altNames.slice(1)) { // Skip first (already tried)
        if (altName === company) continue;
        const altEndpoint = `https://api.lever.co/v0/postings/${altName}?mode=json`;
        console.log(`⚠️  Trying alternative company name: ${altName}`);
        try {
          const { body: altBody, statusCode: altStatus } = await request(altEndpoint, {
            headers: { Accept: 'application/json' }
          });
          if (altStatus === 200) {
            const altText = await altBody.text();
            const altResponse = JSON.parse(altText);
            if (Array.isArray(altResponse) && altResponse.length > 0) {
              console.log(`✅ Lever ${company}: Found ${altResponse.length} jobs using alternative name "${altName}"`);
              // Process jobs with alternative name
              const postings = altResponse as LeverPosting[];
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
                return {
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
                } as CanonicalJob;
              }));
            }
          }
        } catch (altError) {
          // Continue to next alternative
        }
      }
      console.log(`⚠️  Lever ${company}: API requires auth, skipping (would need to scrape careers page instead)`);
      return [];
    }
    
    let response;
    try {
      response = JSON.parse(text);
    } catch (parseError) {
      console.warn(`⚠️  Lever ${company}: Failed to parse JSON response: ${text.substring(0, 200)}`);
      return [];
    }

    if (!Array.isArray(response)) {
      // Check if it's an error object
      if (response.error || response.message) {
        console.warn(`⚠️  Lever API error for ${company}:`, response.error || response.message);
        return [];
      }
      console.warn(`⚠️  Lever API returned non-array payload for ${company}`, response);
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
