import { CanonicalJob } from '../types';
import { SLOT_DEFINITIONS, getCurrentRunSlot, isBacklogSlot, buildPlacementBoostTerms } from '../lib/runSlots';
import { cleanJobDescription, isRelevantJobType, isUKJob, classifyJobType } from '../lib/normalize';
import { generateJobHash } from '../lib/jobHash';
import { enhanceJobDescription } from '../lib/descriptionEnhancer';
import { getPopularTitles, JobTypeKey } from '../lib/jobKeywords';
import { classifyIndustry } from '../lib/industryClassifier';
import { recordRapidApiRequest, logRapidApiUsage } from '../lib/rapidapiUsage';

type JobsApi14Job = {
  jobTitle?: string;
  title?: string;
  companyName?: string;
  company?: string;
  location?: string;
  jobLocation?: string;
  workplaceTypes?: string[];
  jobUrl?: string;
  applyUrl?: string;
  url?: string;
  listedAt?: string;
  postedAt?: string;
  publishedAt?: string;
  description?: string;
  jobDescription?: string;
  workplaceType?: string;
  jobWorkplaceType?: string;
  employmentType?: string;
  jobEmploymentType?: string;
  jobIndustry?: string;
  industries?: string[];
  jobCompany?: {
    name?: string;
    companyUrl?: string;
  };
};

const JOB_TYPES = ['graduate', 'placement', 'internship'] as const;

export async function scrapeJobsAPI14(): Promise<CanonicalJob[]> {
  if (!process.env.RAPIDAPI_KEY) {
    console.warn('⚠️  RAPIDAPI_KEY is not set. Skipping Jobs API 14.');
    return [];
  }

  const { slotIndex } = getCurrentRunSlot();
  const slotDefinition = SLOT_DEFINITIONS[slotIndex];
  const backlogMode = isBacklogSlot(slotIndex);
  const datePosted = backlogMode ? 'all' : 'month';

  const queryTerms = buildQueryTerms(slotDefinition);
  console.log(`  🕒 Jobs API 14 run slot: ${slotIndex + 1}/${SLOT_DEFINITIONS.length} (${slotDefinition.name})`);
  console.log(`  🔎 Jobs API 14 will search ${queryTerms.length} term combinations`);

  const jobs: CanonicalJob[] = [];
  const seen = new Set<string>();
  let duplicates = 0;

  for (const { query, workplaceTypes, employmentTypes, experienceLevels } of queryTerms) {
    try {
      const url = new URL('https://jobs-api14.p.rapidapi.com/v2/linkedin/search');
      url.searchParams.set('query', query);
      url.searchParams.set('experienceLevels', experienceLevels.join('%3B'));
      url.searchParams.set('workplaceTypes', workplaceTypes.join('%3B'));
      url.searchParams.set('location', 'United Kingdom');
      url.searchParams.set('datePosted', datePosted);
      url.searchParams.set('employmentTypes', employmentTypes.join('%3B'));

      recordRapidApiRequest('jobs-api14');
      const response = await fetch(url.toString(), {
        method: 'GET',
        headers: {
          'X-RapidAPI-Key': process.env.RAPIDAPI_KEY!,
          'X-RapidAPI-Host': 'jobs-api14.p.rapidapi.com'
        }
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.warn(`  ⚠️  Jobs API 14 request failed (${response.status}): ${errorText.substring(0, 200)}`);
        continue;
      }

      const data = await response.json();
      const jobArray = extractJobs(data);

      if (jobArray.length === 0) {
        continue;
      }

      console.log(`    📦 Jobs API 14 "${query}" returned ${jobArray.length} results`);

      for (const raw of jobArray) {
        const canonical = convertJob(raw);
        if (!canonical) continue;

        const industryHints = [
          ...slotDefinition.industries,
          raw.jobIndustry,
          ...(raw.industries ?? []),
          query
        ].filter((hint): hint is string => Boolean(hint && String(hint).trim()));

        const inferredIndustry = classifyIndustry({
          title: canonical.title,
          description: canonical.descriptionText || canonical.descriptionHtml,
          company: canonical.company?.name,
          hints: industryHints,
          query
        });

        if (inferredIndustry) {
          canonical.industry = inferredIndustry;
        }

        const key = `${canonical.hash}`;
        if (seen.has(key)) {
          duplicates++;
          continue;
        }
        seen.add(key);

        const jobText = `${canonical.title} ${canonical.descriptionText || canonical.descriptionHtml || ''} ${canonical.location || ''}`.toLowerCase();
        if (!isRelevantJobType(jobText)) continue;
        if (!isUKJob(jobText)) continue;

        jobs.push(canonical);
      }
    } catch (error) {
      console.warn(`  ❌ Jobs API 14 query "${query}" failed:`, error instanceof Error ? error.message : String(error));
    }
  }

  if (duplicates > 0) {
    console.log(`  🔁 Jobs API 14 dedup removed ${duplicates} duplicates`);
  }

  logRapidApiUsage('jobs-api14', { queries: queryTerms.length, jobs: jobs.length });
  return jobs;
}

function extractJobs(data: any): JobsApi14Job[] {
  if (!data) return [];
  if (Array.isArray(data)) return data;
  if (Array.isArray(data.data)) return data.data;
  if (Array.isArray(data.results)) return data.results;
  if (Array.isArray(data.jobs)) return data.jobs;
  if (data.data?.jobs && Array.isArray(data.data.jobs)) return data.data.jobs;
  return [];
}

function convertJob(job: JobsApi14Job): CanonicalJob | null {
  const title = job.jobTitle || job.title;
  const company = job.companyName || job.company || job.jobCompany?.name;
  const applyUrl = job.applyUrl || job.jobUrl || job.url;
  if (!title || !company || !applyUrl) {
    return null;
  }

  const location = job.location || job.jobLocation || '';
  const description = job.jobDescription || job.description || '';
  const cleanDesc = cleanJobDescription(description);
  const postedAt = toISODate(job.listedAt || job.postedAt || job.publishedAt);
  const workplace = job.workplaceTypes?.[0] || job.jobWorkplaceType || job.workplaceType;

  const workplaceMap: Record<string, CanonicalJob['remotePolicy']> = {
    remote: 'remote-uk',
    hybrid: 'hybrid',
    onsite: 'on-site',
    'on-site': 'on-site',
    'on site': 'on-site'
  };

  const remotePolicy = workplace ? workplaceMap[workplace.toLowerCase()] : undefined;

  return {
    source: 'jobs-api14',
    sourceUrl: 'https://jobs-api14.p.rapidapi.com/v2/linkedin/search',
    title,
    company: { name: company },
    location,
    applyUrl,
    jobType: determineJobType(job),
    descriptionText: cleanDesc,
    descriptionHtml: description || undefined,
    remotePolicy,
    postedAt,
    slug: generateSlug(title, company),
    hash: generateJobHash({
      title,
      company,
      applyUrl,
      location,
      postedAt
    })
  };
}

function generateSlug(title: string, company: string): string {
  return `${title}-${company}`.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80);
}

function toISODate(value?: string): string | undefined {
  if (!value) return undefined;
  const date = new Date(value);
  if (isNaN(date.getTime())) return undefined;
  return date.toISOString();
}

function determineJobType(job: JobsApi14Job): 'internship' | 'placement' | 'graduate' | 'other' {
  const text = [
    job.jobTitle,
    job.title,
    job.description,
    job.jobDescription,
    job.jobIndustry,
    job.industries?.join(' ')
  ].join(' ').toLowerCase();
  return classifyJobType(text);
}

type QueryTerm = {
  query: string;
  employmentTypes: string[];
  workplaceTypes: string[];
  experienceLevels: string[];
};

function buildQueryTerms(slot: typeof SLOT_DEFINITIONS[number]): QueryTerm[] {
  const terms: QueryTerm[] = [];

  const employmentTypeMap: Record<string, string[]> = {
    graduate: ['fulltime', 'contractor'],
    placement: ['intern', 'contractor', 'temporary'],
    internship: ['intern']
  };

  const experienceLevelsMap: Record<string, string[]> = {
    graduate: ['entry', 'associate'],
    placement: ['intern'],
    internship: ['intern']
  };

  const workplaceTypes = ['remote', 'hybrid', 'onSite'];

  const placementBoostTerms = buildPlacementBoostTerms(slot);
  const placementQueries = placementBoostTerms.map(term => {
    const base = term.includes('uk') || term.includes('united kingdom') ? term : `${term} united kingdom`;
    return {
      query: base,
      employmentTypes: employmentTypeMap.placement,
      workplaceTypes,
      experienceLevels: experienceLevelsMap.placement
    };
  });

  for (const industry of slot.industries) {
    for (const jobType of JOB_TYPES) {
      const baseQuery = `${jobType} ${industry}`;
      terms.push({
        query: `${baseQuery} united kingdom`,
        employmentTypes: employmentTypeMap[jobType],
        workplaceTypes,
        experienceLevels: experienceLevelsMap[jobType]
      });

      getPopularTitles(industry, jobType)
        .slice(0, 5)
        .forEach(title => {
          terms.push({
            query: `${title} united kingdom`,
            employmentTypes: employmentTypeMap[jobType],
            workplaceTypes,
            experienceLevels: experienceLevelsMap[jobType]
          });
        });
    }
  }

  for (const city of slot.cities) {
    for (const jobType of JOB_TYPES) {
      terms.push({
        query: `${jobType} jobs ${city}`,
        employmentTypes: employmentTypeMap[jobType],
        workplaceTypes,
        experienceLevels: experienceLevelsMap[jobType]
      });

      getPopularTitles(city, jobType)
        .slice(0, 3)
        .forEach(title => {
          terms.push({
            query: `${title} ${city}`,
            employmentTypes: employmentTypeMap[jobType],
            workplaceTypes,
            experienceLevels: experienceLevelsMap[jobType]
          });
        });
    }
  }

  const combined = [...placementQueries, ...terms];
  const maxQueriesEnv = Number(process.env.JOBS_API14_MAX_QUERIES_PER_RUN);
  const maxQueries = Number.isFinite(maxQueriesEnv) && maxQueriesEnv > 0 ? maxQueriesEnv : 160;
  return combined.slice(0, maxQueries);
}

