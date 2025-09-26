import { request } from 'undici';
import { CanonicalJob } from '../types';
import { resolveApplyUrl } from '../lib/applyUrl';
import { sha256 } from '../lib/hash';
import { makeUniqueSlug } from '../lib/slug';
import { classifyJobType, toISO, isRelevantJobType } from '../lib/normalize';

export async function scrapeLever(company: string): Promise<CanonicalJob[]> {
  const api = `https://api.lever.co/v0/postings/${company}?mode=json`;
  const { body } = await request(api);
  const postings = await body.json() as any[];
  
  // Filter for relevant job types only
  const relevantPostings = postings.filter(p => {
    const title = String(p.text || '').trim();
    const description = String(p.description || '').trim();
    const location = String(p.categories?.location || '').trim();
    const team = String(p.categories?.team || '').trim();
    const fullText = `${title} ${description} ${location} ${team}`;
    
    return isRelevantJobType(fullText);
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
      deadline: undefined, salary: undefined, startDate: undefined, endDate: undefined, duration: undefined,
      experience: undefined, companyPage: undefined, relatedDegree: undefined, degreeLevel: undefined,
      descriptionText: undefined, slug, hash
    };
    return job;
  }));
}
