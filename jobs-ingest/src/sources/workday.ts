import { request } from 'undici';
import { CanonicalJob } from '../types';
import { resolveApplyUrl } from '../lib/applyUrl';
import { sha256 } from '../lib/hash';
import { makeUniqueSlug } from '../lib/slug';
import { classifyJobType, toISO, isRelevantJobType, isUKJob, validateJobRequirements, cleanJobDescription } from '../lib/normalize';

export async function scrapeWorkday(company: string, subdomain?: string): Promise<CanonicalJob[]> {
  // Workday API endpoints vary by company
  const baseUrl = subdomain ? `https://${subdomain}.myworkdayjobs.com` : `https://${company}.myworkdayjobs.com`;
  const apiUrl = `${baseUrl}/wday/cxs/${company}/jobs`;
  
  try {
    const { body } = await request(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'User-Agent': process.env.USER_AGENT || 'EffortFreeBot/1.0'
      },
      body: JSON.stringify({
        appliedFacets: {
          locations: ['United Kingdom', 'UK', 'London', 'Manchester', 'Birmingham', 'Bristol', 'Edinburgh', 'Glasgow'],
          jobCategories: ['Internship', 'Graduate', 'Entry Level', 'Early Career', 'Industrial Placement']
        },
        limit: 100,
        offset: 0,
        searchText: ''
      })
    });
    
    const response = await body.json() as any;
    
    if (!response.jobPostings || !Array.isArray(response.jobPostings)) {
      console.warn(`Workday API returned no job postings for ${company}`);
      return [];
    }
    
    const jobs = response.jobPostings as any[];
    
    // Filter for relevant job types and UK locations only
    const relevantJobs = jobs.filter(j => {
      const title = String(j.title || '').trim();
      const description = String(j.summary || j.description || '').trim();
      const location = String(j.locationsText || '').trim();
      const fullText = `${title} ${description} ${location}`;

      // Must be relevant job type AND UK-based
      return isRelevantJobType(fullText) && isUKJob(fullText);
    });

    console.log(`📊 Workday ${company}: ${jobs.length} total jobs, ${relevantJobs.length} relevant jobs`);

    return Promise.all(relevantJobs.map(async j => {
      const applyUrl = await resolveApplyUrl(`${baseUrl}${j.externalPath}`);
      const companyName = j.company || company;
      const title = String(j.title || '').trim();
      const hash = sha256([title, companyName, applyUrl].join('|'));
      const slug = makeUniqueSlug(title, companyName, hash, j.locationsText);

      // Clean and validate description
      const descriptionHtml = j.summary || j.description || '';
      const descriptionText = cleanJobDescription(descriptionHtml);

      const job: CanonicalJob = {
        source: `workday:${company}`,
        sourceUrl: `${baseUrl}${j.externalPath}`,
        title,
        company: { 
          name: companyName,
          website: j.companyWebsite || baseUrl
        },
        companyLogo: j.companyLogo || undefined,
        companyPageUrl: j.companyWebsite || baseUrl,
        location: j.locationsText,
        descriptionHtml: descriptionHtml || undefined,
        descriptionText: descriptionText || undefined,
        applyUrl,
        applyDeadline: toISO(j.applicationDeadline),
        jobType: classifyJobType(title + ' ' + (j.jobCategories?.join(' ') || '')),
        salary: undefined, // Workday doesn't typically expose salary in API
        startDate: toISO(j.startDate),
        endDate: toISO(j.endDate),
        duration: j.duration || undefined,
        experience: j.experienceLevel || undefined,
        relatedDegree: undefined, // Would need to parse from description
        degreeLevel: undefined, // Would need to parse from description
        postedAt: toISO(j.postedOn),
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
    console.warn(`Failed to scrape Workday for ${company}:`, error instanceof Error ? error.message : String(error));
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
