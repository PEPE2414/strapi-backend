import { request } from 'undici';
import { CanonicalJob } from '../types';
import { resolveApplyUrl } from '../lib/applyUrl';
import { sha256 } from '../lib/hash';
import { makeUniqueSlug } from '../lib/slug';
import { classifyJobType, toISO, isRelevantJobType, isUKJob } from '../lib/normalize';

export async function scrapeLever(company: string): Promise<CanonicalJob[]> {
  const allPostings: any[] = [];
  let offset = 0;
  const limit = 100; // Lever API limit
  
  try {
    // Paginate through all available postings
    while (true) {
      const api = `https://api.lever.co/v0/postings/${company}?mode=json&limit=${limit}&offset=${offset}`;
      console.log(`🔄 Fetching Lever postings ${offset + 1}-${offset + limit} for ${company}...`);
      
      const { body } = await request(api);
      const response = await body.json();
      
      // Handle case where API returns error or non-array response
      if (!Array.isArray(response)) {
        console.warn(`Lever API returned non-array response for ${company}:`, typeof response);
        break;
      }
      
      const postings = response as any[];
      
      // If no postings returned, we've reached the end
      if (postings.length === 0) {
        console.log(`📄 No more postings at offset ${offset}, stopping pagination`);
        break;
      }
      
      allPostings.push(...postings);
      console.log(`📄 Offset ${offset}: Found ${postings.length} postings (Total: ${allPostings.length})`);
      
      // If we got fewer postings than requested, we're on the last page
      if (postings.length < limit) {
        console.log(`📄 Last page reached (${postings.length} < ${limit})`);
        break;
      }
      
      offset += limit;
      
      // Safety limit to prevent infinite loops
      if (offset > 5000) {
        console.log(`⚠️  Reached safety limit of 5000 postings for ${company}`);
        break;
      }
    }
    
    const postings = allPostings;
  
    // Filter for relevant job types and UK locations only
    const relevantPostings = postings.filter(p => {
      const title = String(p.text || '').trim();
      const description = String(p.description || '').trim();
      const location = String(p.categories?.location || '').trim();
      const team = String(p.categories?.team || '').trim();
      const fullText = `${title} ${description} ${location} ${team}`;
      
      // Must be relevant job type AND UK-based
      return isRelevantJobType(fullText) && isUKJob(fullText);
    });
  
  console.log(`📊 Lever ${company}: ${postings.length} total jobs, ${relevantPostings.length} relevant jobs`);
  
  return Promise.all(relevantPostings.map(async p => {
    const applyUrl = await resolveApplyUrl(p.hostedUrl || p.applyUrl);
    const title = String(p.text || '').trim();
    const companyName = company;
    const hash = sha256([title, companyName, applyUrl].join('|'));
    const slug = makeUniqueSlug(title, companyName, hash, p.categories?.location);
    const job: CanonicalJob = {
      source: `lever:${company}`,
      sourceUrl: p.hostedUrl || p.applyUrl,
      title,
      company: { name: companyName },
      location: p.categories?.location,
      descriptionHtml: p.description,
      applyUrl,
      jobType: classifyJobType(title + ' ' + (p.categories?.team || '')),
      postedAt: p.createdAt ? new Date(p.createdAt).toISOString() : undefined,
        applyDeadline: undefined, salary: undefined, startDate: undefined, endDate: undefined, duration: undefined,
      experience: undefined, companyPageUrl: undefined, relatedDegree: undefined, degreeLevel: undefined,
      descriptionText: undefined, slug, hash
    };
    return job;
  }));
  
  } catch (error) {
    console.warn(`Failed to scrape Lever company ${company}:`, error instanceof Error ? error.message : String(error));
    return [];
  }
}
