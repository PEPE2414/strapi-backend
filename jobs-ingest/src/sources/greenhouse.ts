import { request } from 'undici';
import { CanonicalJob } from '../types';
import { resolveApplyUrl } from '../lib/applyUrl';
import { sha256 } from '../lib/hash';
import { makeUniqueSlug } from '../lib/slug';
import { classifyJobType, toISO } from '../lib/normalize';

export async function scrapeGreenhouse(board: string): Promise<CanonicalJob[]> {
  const api = `https://boards-api.greenhouse.io/v1/boards/${board}/jobs`;
  const { body } = await request(api);
  const json = await body.json() as any;
  const jobs = (json.jobs || []) as any[];
  return Promise.all(jobs.map(async j => {
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
      deadline: undefined,
      jobType: classifyJobType(title + ' ' + (j.metadata?.map((m:any)=>m.value).join(' ')||'')),
      salary: undefined,
      startDate: undefined,
      endDate: undefined,
      duration: undefined,
      experience: undefined,
      companyPage: undefined,
      relatedDegree: undefined,
      degreeLevel: undefined,
      postedAt: toISO(j.updated_at || j.created_at),
      slug,
      hash
    };
    return job;
  }));
}
