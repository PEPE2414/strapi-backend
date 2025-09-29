import { request } from 'undici';
import { CanonicalJob } from '../types';
import { resolveApplyUrl } from '../lib/applyUrl';
import { sha256 } from '../lib/hash';
import { makeUniqueSlug } from '../lib/slug';
import { classifyJobType, toISO, isRelevantJobType, isUKJob, validateJobRequirements, cleanJobDescription } from '../lib/normalize';

export async function scrapeSuccessFactors(company: string, subdomain?: string): Promise<CanonicalJob[]> {
  // SuccessFactors (SAP) career pages
  const baseUrl = subdomain ? `https://${subdomain}.successfactors.eu` : `https://${company}.successfactors.eu`;
  const apiUrl = `${baseUrl}/careers/api/apply/v2/jobs`;
  
  try {
    const { body } = await request(apiUrl, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'User-Agent': process.env.USER_AGENT || 'EffortFreeBot/1.0'
      }
    });
    
    const response = await body.json() as any;
    
    if (!response.jobs || !Array.isArray(response.jobs)) {
      console.warn(`SuccessFactors API returned no jobs for ${company}`);
      return [];
    }
    
    const jobs = response.jobs as any[];
    
    // Filter for UK locations and relevant job types
    const relevantJobs = jobs.filter(j => {
      const title = String(j.title || '').trim();
      const description = String(j.description || '').trim();
      const location = String(j.location || '').trim();
      const fullText = `${title} ${description} ${location}`;

      // Must be relevant job type AND UK-based
      return isRelevantJobType(fullText) && isUKJob(fullText);
    });

    console.log(`📊 SuccessFactors ${company}: ${jobs.length} total jobs, ${relevantJobs.length} relevant jobs`);

    return Promise.all(relevantJobs.map(async j => {
      const applyUrl = await resolveApplyUrl(`${baseUrl}${j.applyUrl}`);
      const companyName = j.company || company;
      const title = String(j.title || '').trim();
      const hash = sha256([title, companyName, applyUrl].join('|'));
      const slug = makeUniqueSlug(title, companyName, hash, j.location);

      // Clean and validate description
      const descriptionHtml = j.description || '';
      const descriptionText = cleanJobDescription(descriptionHtml);

      const job: CanonicalJob = {
        source: `successfactors:${company}`,
        sourceUrl: `${baseUrl}${j.jobUrl}`,
        title,
        company: { 
          name: companyName,
          website: j.companyWebsite || baseUrl
        },
        companyLogo: j.companyLogo || undefined,
        companyPageUrl: j.companyWebsite || baseUrl,
        location: j.location,
        descriptionHtml: descriptionHtml || undefined,
        descriptionText: descriptionText || undefined,
        applyUrl,
        applyDeadline: toISO(j.deadline),
        jobType: classifyJobType(title + ' ' + (j.categories?.join(' ') || '')),
        salary: undefined, // SuccessFactors doesn't typically expose salary
        startDate: toISO(j.startDate),
        endDate: toISO(j.endDate),
        duration: j.duration || undefined,
        experience: j.experienceLevel || undefined,
        relatedDegree: undefined,
        degreeLevel: undefined,
        postedAt: toISO(j.postedDate),
        slug,
        hash,
        qualityScore: calculateQualityScore(j),
        lastValidated: new Date().toISOString()
      };

      // Validate job requirements
      const validation = validateJobRequirements(job);
      if (!validation.valid) {
        console.log(`⏭️  Skipping invalid job: ${title} - ${validation.reason}`);
        return null;
      }

      return job;
    })).then(jobs => jobs.filter(job => job !== null));
    
  } catch (error) {
    console.warn(`Failed to scrape SuccessFactors for ${company}:`, error instanceof Error ? error.message : String(error));
    return [];
  }
}

function calculateQualityScore(job: any): number {
  let score = 0;
  
  // Basic required fields (40 points)
  if (job.title) score += 10;
  if (job.company) score += 10;
  if (job.applyUrl) score += 10;
  if (job.description) score += 10;
  
  // Additional quality indicators (60 points)
  if (job.salary) score += 15;
  if (job.companyLogo) score += 10;
  if (job.startDate) score += 10;
  if (job.duration) score += 10;
  if (job.experience) score += 10;
  if (job.postedAt) score += 5;
  
  return Math.min(100, score);
}
