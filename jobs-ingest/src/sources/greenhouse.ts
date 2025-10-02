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
      
      // Safety limit to prevent infinite loops (reduced for efficiency)
      if (page > 5) {
        console.log(`⚠️  Reached safety limit of 5 pages for ${board}`);
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
          hasContent: !!jobs[0].content,
          contentLength: jobs[0].content?.length || 0,
          availableFields: Object.keys(jobs[0]),
          fullJobObject: JSON.stringify(jobs[0], null, 2).substring(0, 500) + '...'
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
  
  return Promise.all(relevantJobs.slice(0, 10).map(async j => {
    const applyUrl = await resolveApplyUrl(j.absolute_url);
    const companyName = j.company?.name || board;
    const title = String(j.title || '').trim();
    
    // Try to fetch full job details for description
    let description = j.content || j.description || j.job_description || '';
    if (!description && j.id) {
      try {
        const jobDetailUrl = `https://boards-api.greenhouse.io/v1/boards/${board}/jobs/${j.id}`;
        const { html: jobDetailJson } = await get(jobDetailUrl);
        const jobDetail = JSON.parse(jobDetailJson);
        description = jobDetail.content || jobDetail.description || '';
        
        if (board === 'stripe') {
          console.log(`🔍 Job detail for ${title}:`, {
            hasDescription: !!description,
            descriptionLength: description.length,
            availableFields: Object.keys(jobDetail),
            contentPreview: description.substring(0, 200)
          });
        }
      } catch (error) {
        console.warn(`Failed to fetch job details for ${j.id}:`, error instanceof Error ? error.message : String(error));
      }
    }
    
    const hash = sha256([title, companyName, applyUrl].join('|'));
    const slug = makeUniqueSlug(title, companyName, hash, j.location?.name);

    const job: CanonicalJob = {
      source: `greenhouse:${board}`,
      sourceUrl: j.absolute_url,
      title,
      company: { name: companyName },
      companyLogo: j.company?.logo_url || undefined,
      location: j.location?.name,
      descriptionHtml: description,
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
