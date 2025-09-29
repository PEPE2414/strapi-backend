import { request } from 'undici';
import { CanonicalJob } from '../types';
import { resolveApplyUrl } from '../lib/applyUrl';
import { sha256 } from '../lib/hash';
import { makeUniqueSlug } from '../lib/slug';
import { classifyJobType, toISO, isRelevantJobType, isUKJob } from '../lib/normalize';

export async function scrapeGreenhouse(board: string): Promise<CanonicalJob[]> {
  const allJobs: any[] = [];
  let page = 0;
  const perPage = 100; // Greenhouse API limit
  
  try {
    // Paginate through all available jobs
    while (true) {
      const api = `https://boards-api.greenhouse.io/v1/boards/${board}/jobs?page=${page}&per_page=${perPage}`;
      console.log(`🔄 Fetching page ${page + 1} for ${board}...`);
      
      const { body } = await request(api);
      const json = await body.json() as any;
    
      // Check if API returned an error
      if (json.error) {
        console.warn(`Greenhouse API error for ${board}:`, json.error);
        break;
      }
      
      const jobs = (json.jobs || []) as any[];
      
      // If no jobs returned, we've reached the end
      if (jobs.length === 0) {
        console.log(`📄 No more jobs on page ${page + 1}, stopping pagination`);
        break;
      }
      
      allJobs.push(...jobs);
      console.log(`📄 Page ${page + 1}: Found ${jobs.length} jobs (Total: ${allJobs.length})`);
      
      // If we got fewer jobs than requested, we're on the last page
      if (jobs.length < perPage) {
        console.log(`📄 Last page reached (${jobs.length} < ${perPage})`);
        break;
      }
      
      page++;
      
      // Safety limit to prevent infinite loops
      if (page > 50) {
        console.log(`⚠️  Reached safety limit of 50 pages for ${board}`);
        break;
      }
    }
    
    const jobs = allJobs;
    
    // Log some debug info for the first few companies
    if (board === 'stripe' || board === 'airbnb') {
      console.log(`Debug ${board}:`, {
        hasJobs: jobs.length > 0,
        jobsLength: jobs.length,
        sampleJob: jobs[0] ? {
          title: jobs[0].title,
          location: jobs[0].location?.name,
          hasContent: !!jobs[0].content
        } : null
      });
    }
  
    // Filter for relevant job types and UK locations only
    const relevantJobs = jobs.filter(j => {
      const title = String(j.title || '').trim();
      const description = String(j.content || '').trim();
      const location = String(j.location?.name || '').trim();
      const fullText = `${title} ${description} ${location}`;
      
      // Must be relevant job type AND UK-based
      return isRelevantJobType(fullText) && isUKJob(fullText);
    });
  
  console.log(`📊 Greenhouse ${board}: ${jobs.length} total jobs, ${relevantJobs.length} relevant jobs`);
  
  return Promise.all(relevantJobs.map(async j => {
    const applyUrl = await resolveApplyUrl(j.absolute_url);
    const companyName = j.company?.name || board;
    const title = String(j.title || '').trim();
    const hash = sha256([title, companyName, applyUrl].join('|'));
    const slug = makeUniqueSlug(title, companyName, hash, j.location?.name);

    const job: CanonicalJob = {
      source: `greenhouse:${board}`,
      sourceUrl: j.absolute_url,
      title,
      company: { name: companyName },
      companyLogo: j.company?.logo_url || undefined,
      location: j.location?.name,
      descriptionHtml: j.content,
      descriptionText: undefined,
      applyUrl,
        applyDeadline: undefined,
      jobType: classifyJobType(title + ' ' + (j.metadata?.map((m:any)=>m.value).join(' ')||'')),
      salary: undefined,
      startDate: undefined,
      endDate: undefined,
      duration: undefined,
      experience: undefined,
      companyPageUrl: undefined,
      relatedDegree: undefined,
      degreeLevel: undefined,
      postedAt: toISO(j.updated_at || j.created_at),
      slug,
      hash
    };
    return job;
  }));
  
  } catch (error) {
    console.warn(`Failed to scrape Greenhouse board ${board}:`, error instanceof Error ? error.message : String(error));
    return [];
  }
}
