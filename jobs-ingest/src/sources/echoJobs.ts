import { CanonicalJob } from '../types';
import { SLOT_DEFINITIONS, getCurrentRunSlot, isBacklogSlot, buildPlacementBoostTerms } from '../lib/runSlots';
import { classifyJobType, isRelevantJobType, isUKJob } from '../lib/normalize';
import { generateJobHash } from '../lib/jobHash';
import { cleanJobDescription } from '../lib/normalize';
import { recordRapidApiRequest, logRapidApiUsage } from '../lib/rapidapiUsage';

type EchoJob = {
  title?: string;
  company?: string;
  companyName?: string;
  location?: string;
  description?: string;
  url?: string;
  applyLink?: string;
  postedAt?: string;
  createdAt?: string;
};

const LEVEL_MAP: Record<'graduate' | 'placement' | 'internship', string> = {
  graduate: 'Entry',
  placement: 'Entry',
  internship: 'Internship'
};

export async function scrapeEchoJobs(): Promise<CanonicalJob[]> {
  if (!process.env.RAPIDAPI_KEY) {
    console.warn('⚠️  RAPIDAPI_KEY is not set. Skipping EchoJobs API.');
    return [];
  }

  const { slotIndex } = getCurrentRunSlot();
  const slotDefinition = SLOT_DEFINITIONS[slotIndex];
  const backlogMode = isBacklogSlot(slotIndex);
  const limitPerTypeEnv = Number(process.env.ECHOJOBS_MAX_COMBOS || 80);
  const maxCombos = Number.isFinite(limitPerTypeEnv) && limitPerTypeEnv > 0 ? limitPerTypeEnv : 80;

  const queries = buildEchoQueries(slotDefinition, maxCombos);
  console.log(`  🕒 EchoJobs run slot: ${slotIndex + 1}/${SLOT_DEFINITIONS.length} (${slotDefinition.name})`);
  console.log(`  🔎 EchoJobs will call ${queries.length} query combinations`);

  const jobs: CanonicalJob[] = [];
  let duplicates = 0;
  const seen = new Set<string>();

  for (const query of queries) {
    try {
      const url = new URL('https://jobs-api22.p.rapidapi.com/search');
      url.searchParams.set('levels', query.levels);
      if (query.locations) url.searchParams.set('locations', query.locations);
      if (query.industry) url.searchParams.set('industry', query.industry);
      if (query.focuses) url.searchParams.set('focuses', query.focuses);
      if (query.remote) url.searchParams.set('remote', String(query.remote));
      if (backlogMode) {
        url.searchParams.set('sort', 'date');
      }

      recordRapidApiRequest('echojobs');
      const response = await fetch(url.toString(), {
        method: 'GET',
        headers: {
          'X-RapidAPI-Key': process.env.RAPIDAPI_KEY!,
          'X-RapidAPI-Host': 'jobs-api22.p.rapidapi.com'
        }
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.warn(`  ⚠️  EchoJobs request failed (${response.status}): ${errorText.substring(0, 200)}`);
        continue;
      }

      const data = await response.json();
      const jobArray = extractEchoJobs(data);
      if (jobArray.length === 0) {
        continue;
      }

      console.log(`    📦 EchoJobs "${query.levels}" (${query.industry || query.locations || 'general'}) returned ${jobArray.length} jobs`);

      for (const raw of jobArray) {
        const canonical = convertEchoJob(raw);
        if (!canonical) continue;

        const text = `${canonical.title} ${canonical.descriptionText || canonical.descriptionHtml || ''} ${canonical.location || ''}`;
        if (!isRelevantJobType(text)) continue;
        if (!isUKJob(text)) continue;

        if (seen.has(canonical.hash)) {
          duplicates++;
          continue;
        }
        seen.add(canonical.hash);

        jobs.push(canonical);
      }
    } catch (error) {
      console.warn(`  ❌ EchoJobs query failed:`, error instanceof Error ? error.message : String(error));
    }
  }

  if (duplicates > 0) {
    console.log(`  🔁 EchoJobs dedup removed ${duplicates} duplicates`);
  }

  logRapidApiUsage('echojobs', { queries: queries.length, jobs: jobs.length });
  return jobs;
}

function buildEchoQueries(slot: typeof SLOT_DEFINITIONS[number], maxCombos: number) {
  const combos: Array<{ levels: string; locations?: string; industry?: string; focuses?: string; remote?: boolean }> = [];
  const placementTerms = buildPlacementBoostTerms(slot);
  const remoteFocuses = ['Backend', 'Frontend', 'FullStack', 'DevOps'];

  const addCombo = (combo: { levels: string; locations?: string; industry?: string; focuses?: string; remote?: boolean }) => {
    if (combos.length >= maxCombos) return;
    combos.push(combo);
  };

  for (const industry of slot.industries) {
    for (const [jobType, level] of Object.entries(LEVEL_MAP)) {
      addCombo({ levels: level, industry: capitalizeWords(industry), locations: 'United Kingdom' });
      addCombo({ levels: level, industry: capitalizeWords(industry), locations: 'United Kingdom', remote: true });
    }
  }

  slot.cities.forEach(city => {
    const formattedCity = `${capitalizeWords(city)}, UK`;
    for (const level of Object.values(LEVEL_MAP)) {
      addCombo({ levels: level, locations: formattedCity });
    }
  });

  placementTerms.slice(0, 20).forEach(term => {
    addCombo({ levels: LEVEL_MAP.placement, industry: capitalizeWords(term), locations: 'United Kingdom' });
  });

  remoteFocuses.forEach(focus => {
    addCombo({ levels: LEVEL_MAP.graduate, focuses: focus, remote: true });
  });

  return combos;
}

function extractEchoJobs(payload: any): EchoJob[] {
  if (!payload) return [];
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload.jobs)) return payload.jobs;
  if (payload.data?.jobs && Array.isArray(payload.data.jobs)) return payload.data.jobs;
  if (Array.isArray(payload.results)) return payload.results;
  return [];
}

function convertEchoJob(job: EchoJob): CanonicalJob | null {
  const title = job.title;
  const company = job.company || job.companyName;
  const applyUrl = job.url || job.applyLink;
  if (!title || !company || !applyUrl) {
    return null;
  }

  const location = job.location || '';
  const description = cleanJobDescription(job.description || '');
  const jobType = classifyJobType(`${title} ${description}`);
  if (jobType === 'other') {
    return null;
  }

  const postedAt = job.postedAt || job.createdAt || undefined;
  const hash = generateJobHash({
    title,
    company,
    applyUrl,
    location,
    postedAt
  });

  return {
    source: 'echojobs',
    sourceUrl: 'https://jobs-api22.p.rapidapi.com/search',
    title,
    company: { name: company },
    location,
    applyUrl,
    jobType,
    descriptionText: description || undefined,
    postedAt,
    slug: generateSlug(title, company),
    hash
  };
}

function capitalizeWords(input: string): string {
  return input.replace(/\b\w+/g, word => word.charAt(0).toUpperCase() + word.slice(1));
}

function generateSlug(title: string, company: string): string {
  return `${title}-${company}`.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80);
}


