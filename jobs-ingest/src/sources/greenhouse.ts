import { request } from 'undici';
import { CanonicalJob } from '../types';
import { resolveApplyUrl } from '../lib/applyUrl';
import { makeUniqueSlug } from '../lib/slug';
import { generateJobHash } from '../lib/jobHash';
import { classifyJobType, toISO, isRelevantJobType, isUKJob } from '../lib/normalize';
import { decompressUndiciResponse } from '../lib/decompressResponse';

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
  // Try Perplexity discovery first to get the most up-to-date URL
  let endpoint = `https://boards.greenhouse.io/${board}/embed/job_board?content=true`;
  
  try {
    const { discoverUrlsWithPerplexity } = await import('../lib/perplexityUrlDiscovery');
    const discoveredUrls = await discoverUrlsWithPerplexity('greenhouse', `greenhouse:${board}`, board);
    if (discoveredUrls.length > 0) {
      // Use the first discovered URL if it's a valid Greenhouse embed endpoint
      // Must have /embed/job_board in the path, not just boards.greenhouse.io
      const greenhouseUrl = discoveredUrls.find(url => 
        url.includes('greenhouse.io') && 
        url.includes('/embed/job_board')
      );
      if (greenhouseUrl) {
        // Ensure it has the ?content=true parameter
        endpoint = greenhouseUrl.includes('?') ? greenhouseUrl : `${greenhouseUrl}?content=true`;
        console.log(`🤖 Using Perplexity-discovered URL for ${board}: ${endpoint}`);
      } else {
        console.log(`⚠️  Perplexity found URLs but none are valid Greenhouse embed endpoints (must include /embed/job_board), using default`);
      }
    }
  } catch (error) {
    // Fall back to default endpoint if Perplexity fails
    console.log(`⚠️  Perplexity discovery for ${board} failed, using default endpoint`);
  }

  try {
    const { body, statusCode } = await request(endpoint, {
      headers: { 
        Accept: 'application/json',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      },
      maxRedirections: 5 // Follow redirects
    });
    
    // Use decompressResponse to handle binary/compressed data
    let text: string;
    try {
      text = await decompressUndiciResponse(body, {});
    } catch (decompressError) {
      // If decompression fails, try regular text() as fallback
      console.warn(`⚠️  Decompression failed, trying regular text(): ${decompressError instanceof Error ? decompressError.message : String(decompressError)}`);
      text = await body.text();
    }
    if (statusCode !== 200) {
      // Try alternative endpoint format if we got a redirect or error
      if (statusCode === 301 || statusCode === 302 || statusCode === 404) {
        const altEndpoint = `https://boards-api.greenhouse.io/v1/boards/${board}/jobs`;
        console.log(`⚠️  Greenhouse ${board}: Primary endpoint returned ${statusCode}, trying alternative: ${altEndpoint}`);
        try {
          const { body: altBody, statusCode: altStatus } = await request(altEndpoint, {
            headers: { 
              Accept: 'application/json',
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
          });
          // Use decompressResponse for alternative endpoint
          let altText: string;
          try {
            altText = await decompressUndiciResponse(altBody, {});
          } catch (decompressError) {
            altText = await altBody.text();
          }
          if (altStatus === 200 && !altText.trim().startsWith('<')) {
            // Use alternative endpoint response
            const altData = JSON.parse(altText);
            if (Array.isArray(altData.jobs)) {
              // Transform API format to embed format
              const transformedJobs = altData.jobs.map((job: any) => ({
                title: job.title,
                location: { name: job.location?.name || job.offices?.[0]?.location || '' },
                content: job.content || job.description || '',
                absolute_url: job.absolute_url || job.url || '',
                updated_at: job.updated_at || job.created_at,
                metadata: job.metadata || []
              }));
              const relevantJobs = transformedJobs.filter((job: any) => {
                const title = String(job.title || '').trim();
                const location = String(job.location?.name || '').trim();
                const description = String(job.content || '').trim();
                const fullText = `${title} ${location} ${description}`;
                return isRelevantJobType(fullText) && isUKJob(fullText);
              });
              console.log(`📊 Greenhouse ${board} (API): ${transformedJobs.length} jobs, ${relevantJobs.length} relevant UK graduate roles`);
              // Process jobs (code continues below)
              return await Promise.all(relevantJobs.map(async (job: any) => {
                const title = String(job.title || '').trim();
                const location = job.location?.name || '';
                const description = job.content || '';
                const applyUrl = await resolveApplyUrl(job.absolute_url || '');
                const jobType = classifyJobType(title);
                const companyName = board;
                const hash = generateJobHash({
                  title,
                  company: companyName,
                  applyUrl,
                  location,
                  postedAt: job.updated_at
                });
                const slug = makeUniqueSlug(title, companyName, hash, location);
                return {
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
                  postedAt: toISO(job.updated_at),
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
          console.warn(`⚠️  Greenhouse ${board}: Alternative endpoint also failed: ${altError instanceof Error ? altError.message : String(altError)}`);
        }
      }
      console.warn(`⚠️  Greenhouse ${board}: Received non-200 response (${statusCode}), board may not exist or endpoint changed`);
      return [];
    }
    if (text.trim().startsWith('<')) {
      console.warn(`⚠️  Greenhouse ${board}: Received HTML response instead of JSON`);
      return [];
    }
    
    let data: GreenhouseResponse;
    try {
      data = JSON.parse(text) as GreenhouseResponse;
    } catch (parseError) {
      console.warn(`⚠️  Greenhouse ${board}: Failed to parse JSON response: ${text.substring(0, 200)}`);
      return [];
    }

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
