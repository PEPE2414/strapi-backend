import 'dotenv/config';
import Bottleneck from 'bottleneck';
import { fetch, FormData, File } from 'undici';

type StrapiMedia = {
  id: number;
  attributes?: {
    url?: string;
    name?: string;
    alternativeText?: string | null;
  };
};

type StrapiJobRecord = {
  id: number;
  attributes: {
    title?: string | null;
    company?: {
      name?: string | null;
      [key: string]: unknown;
    } | string | null;
    companyPageUrl?: string | null;
    applyUrl?: string | null;
    sourceUrl?: string | null;
    slug?: string | null;
    companyLogo?: {
      data?: StrapiMedia | null;
    } | StrapiMedia | null;
  };
};

type StrapiJobResponse = {
  data: StrapiJobRecord[];
  meta?: {
    pagination?: {
      page: number;
      pageCount: number;
      pageSize: number;
      total: number;
    };
  };
};

type CompanyEntry = {
  displayName: string;
  key: string;
  jobs: StrapiJobRecord[];
  hasLogo: boolean;
  existingLogoId?: number;
  existingLogoUrl?: string;
  possibleDomains: Set<string>;
};

type UploadResult = {
  id: number;
  url: string;
};

const STRAPI_BASE_URL = (process.env.STRAPI_BASE_URL || process.env.STRAPI_URL || '').replace(/\/$/, '');
const STRAPI_TOKEN = process.env.STRAPI_ADMIN_TOKEN || process.env.STRAPI_TOKEN;
const LOGO_SIZE = Number(process.env.COMPANY_LOGO_SIZE || 256);
const PAGE_SIZE = Number(process.env.COMPANY_LOGO_PAGE_SIZE || 200);
const MAX_COMPANIES_PER_RUN = Number(process.env.COMPANY_LOGO_MAX_COMPANIES || 40);
const CLEARBIT_AUTOCOMPLETE_ENDPOINT = 'https://autocomplete.clearbit.com/v1/companies/suggest';

if (!STRAPI_BASE_URL) {
  throw new Error('Missing STRAPI_BASE_URL environment variable');
}

if (!STRAPI_TOKEN) {
  throw new Error('Missing STRAPI_ADMIN_TOKEN environment variable');
}

const httpLimiter = new Bottleneck({
  maxConcurrent: 4,
  minTime: 150,
});

const strapiLimiter = new Bottleneck({
  maxConcurrent: 2,
  minTime: 200,
});

function slugify(input: string): string {
  return input
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

function normaliseCompanyName(name?: string | null): string {
  if (!name) return '';
  return name
    .normalize('NFKC')
    .replace(/&amp;/gi, 'and')
    .replace(/株式会社|Inc\.?|Ltd\.?|Limited|PLC|LLC|LLP|S\.A\.|S\.p\.A\.|AG|GmbH|Co\.?/gi, '')
    .replace(/\(.*?\)/g, '')
    .replace(/[^a-z0-9 ]+/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

function extractCompanyName(companyField: CompanyEntry['displayName'] | StrapiJobRecord['attributes']['company']): string {
  if (!companyField) return '';
  if (typeof companyField === 'string') return companyField;
  if (typeof companyField.name === 'string') return companyField.name;
  return '';
}

function extractLogoInfo(companyLogo: StrapiJobRecord['attributes']['companyLogo']): { id?: number; url?: string } {
  if (!companyLogo) return {};

  const media = (companyLogo as { data?: StrapiMedia | null })?.data ?? (companyLogo as StrapiMedia);
  if (!media) return {};

  const url = media.attributes?.url;
  const id = media.id;
  return { id, url };
}

function extractDomainFromUrl(rawUrl?: string | null): string | null {
  if (!rawUrl) return null;
  try {
    const url = new URL(rawUrl);
    const hostname = url.hostname.replace(/^www\./i, '').toLowerCase();
    if (!hostname || /^[0-9.]+$/.test(hostname)) return null;
    return hostname;
  } catch {
    return null;
  }
}

async function fetchAllJobs(): Promise<StrapiJobRecord[]> {
  const all: StrapiJobRecord[] = [];
  let page = 1;
  let pageCount = 1;

  while (page <= pageCount) {
    const params = new URLSearchParams();
    params.set('pagination[page]', String(page));
    params.set('pagination[pageSize]', String(PAGE_SIZE));
    params.set('fields[0]', 'title');
    params.set('fields[1]', 'company');
    params.set('fields[2]', 'companyPageUrl');
    params.set('fields[3]', 'applyUrl');
    params.set('fields[4]', 'sourceUrl');
    params.set('fields[5]', 'slug');
    params.set('populate[companyLogo]', '*');

    const url = `${STRAPI_BASE_URL}/api/jobs?${params.toString()}`;

    const response = await strapiLimiter.schedule(() =>
      fetch(url, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${STRAPI_TOKEN}`,
          Accept: 'application/json',
        },
      }),
    );

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Failed to fetch jobs (${response.status}): ${text}`);
    }

    const json = (await response.json()) as StrapiJobResponse;
    const data = json.data || [];
    all.push(...data);

    const meta = json.meta?.pagination;
    if (meta?.pageCount) {
      pageCount = meta.pageCount;
    } else if (data.length < PAGE_SIZE) {
      break;
    }

    page += 1;
  }

  return all;
}

async function lookupDomain(companyName: string): Promise<{ domain: string; logoUrl?: string } | null> {
  if (!companyName) return null;

  const query = encodeURIComponent(companyName);
  const apiUrl = `${CLEARBIT_AUTOCOMPLETE_ENDPOINT}?query=${query}`;

  const response = await httpLimiter.schedule(() =>
    fetch(apiUrl, {
      headers: { Accept: 'application/json' },
    }),
  );

  if (!response.ok) {
    console.warn(`⚠️  Clearbit autocomplete failed for "${companyName}" (${response.status})`);
    return null;
  }

  const suggestions = (await response.json()) as Array<{ domain?: string; name?: string; logo?: string }>;
  if (!Array.isArray(suggestions) || suggestions.length === 0) return null;

  const normalisedTarget = companyName.trim().toLowerCase();
  const exact = suggestions.find((s) => (s.name ?? '').trim().toLowerCase() === normalisedTarget);
  const chosen = exact ?? suggestions[0];

  if (!chosen?.domain) return null;

  return {
    domain: chosen.domain.toLowerCase(),
    logoUrl: chosen.logo,
  };
}

async function downloadLogo(domain: string, providedUrl?: string): Promise<{ buffer: Buffer; contentType: string } | null> {
  const targetUrl =
    providedUrl ||
    `https://logo.clearbit.com/${encodeURIComponent(domain)}?size=${Number.isFinite(LOGO_SIZE) ? LOGO_SIZE : 256}&format=png`;

  const response = await httpLimiter.schedule(() =>
    fetch(targetUrl, {
      headers: {
        Accept: 'image/*',
        'User-Agent': 'EffortFreeLogoBot/1.0',
      },
    }),
  );

  if (!response.ok) {
    console.warn(`⚠️  Logo download failed for ${domain} (${response.status})`);
    return null;
  }

  const arrayBuffer = await response.arrayBuffer();
  if (!arrayBuffer || arrayBuffer.byteLength === 0) {
    console.warn(`⚠️  Empty logo response for ${domain}`);
    return null;
  }

  const contentType = response.headers.get('content-type') || 'image/png';
  return { buffer: Buffer.from(arrayBuffer), contentType };
}

async function uploadLogo(companyName: string, payload: { buffer: Buffer; contentType: string }): Promise<UploadResult> {
  const fileName = `${slugify(companyName) || 'company'}-logo.png`;
  const file = new File([payload.buffer], fileName, { type: payload.contentType || 'image/png' });
  const body = new FormData();
  body.append('files', file);

  const response = await strapiLimiter.schedule(() =>
    fetch(`${STRAPI_BASE_URL}/api/upload`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${STRAPI_TOKEN}`,
      },
      body,
    }),
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Logo upload failed for "${companyName}" (${response.status}): ${errorText}`);
  }

  const json = (await response.json()) as Array<{ id: number; url?: string }>;
  const uploaded = json?.[0];

  if (!uploaded?.id) {
    throw new Error(`Strapi upload response missing file id for "${companyName}"`);
  }

  return {
    id: uploaded.id,
    url: uploaded.url || '',
  };
}

async function assignLogoToJob(jobId: number, fileId: number): Promise<void> {
  const response = await strapiLimiter.schedule(() =>
    fetch(`${STRAPI_BASE_URL}/api/jobs/${jobId}`, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${STRAPI_TOKEN}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        data: {
          companyLogo: fileId,
        },
      }),
    }),
  );

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Failed to assign logo to job ${jobId} (${response.status}): ${text}`);
  }
}

function buildCompanyMap(jobs: StrapiJobRecord[]): Map<string, CompanyEntry> {
  const map = new Map<string, CompanyEntry>();

  for (const job of jobs) {
    const companyName = extractCompanyName(job.attributes.company);
    const displayName = companyName || 'Unknown';
    const key = normaliseCompanyName(displayName);

    if (!key || key === 'unknown' || key === 'unknown company') {
      continue;
    }

    const { id: logoId, url: logoUrl } = extractLogoInfo(job.attributes.companyLogo);

    if (!map.has(key)) {
      map.set(key, {
        displayName,
        key,
        jobs: [],
        hasLogo: Boolean(logoId),
        existingLogoId: logoId,
        existingLogoUrl: logoUrl,
        possibleDomains: new Set<string>(),
      });
    }

    const entry = map.get(key)!;
    entry.jobs.push(job);

    if (logoId && !entry.hasLogo) {
      entry.hasLogo = true;
      entry.existingLogoId = logoId;
      entry.existingLogoUrl = logoUrl;
    }

    const pageDomain = extractDomainFromUrl(job.attributes.companyPageUrl);
    if (pageDomain) entry.possibleDomains.add(pageDomain);

    const applyDomain = extractDomainFromUrl(job.attributes.applyUrl);
    if (applyDomain) entry.possibleDomains.add(applyDomain);

    const sourceDomain = extractDomainFromUrl(job.attributes.sourceUrl);
    if (sourceDomain) entry.possibleDomains.add(sourceDomain);
  }

  return map;
}

async function propagateExistingLogo(entry: CompanyEntry): Promise<number> {
  if (!entry.existingLogoId) return 0;
  let updates = 0;

  for (const job of entry.jobs) {
    const { id: currentLogoId } = extractLogoInfo(job.attributes.companyLogo);
    if (currentLogoId) continue;

    await assignLogoToJob(job.id, entry.existingLogoId);
    updates += 1;
  }

  return updates;
}

async function processCompany(entry: CompanyEntry): Promise<{ assigned: number; uploaded?: number }> {
  if (entry.hasLogo && entry.existingLogoId) {
    const propagated = await propagateExistingLogo(entry);
    return { assigned: propagated };
  }

  let domain: string | null = null;
  let logoFromSuggestion: string | undefined;

  for (const candidate of entry.possibleDomains) {
    domain = candidate;
    break;
  }

  if (!domain) {
    const suggestion = await lookupDomain(entry.displayName);
    if (suggestion?.domain) {
      domain = suggestion.domain;
      logoFromSuggestion = suggestion.logoUrl;
    }
  }

  if (!domain) {
    console.warn(`⚠️  No domain found for company "${entry.displayName}", skipping`);
    return { assigned: 0 };
  }

  const logoData = await downloadLogo(domain, logoFromSuggestion);
  if (!logoData) {
    console.warn(`⚠️  Unable to download logo for ${domain} (${entry.displayName})`);
    return { assigned: 0 };
  }

  const upload = await uploadLogo(entry.displayName, logoData);

  let updated = 0;
  for (const job of entry.jobs) {
    const { id: currentLogoId } = extractLogoInfo(job.attributes.companyLogo);
    if (currentLogoId) continue;
    await assignLogoToJob(job.id, upload.id);
    updated += 1;
  }

  return { assigned: updated, uploaded: 1 };
}

async function main() {
  console.log('🚀 Starting company logo sync');
  console.log(`Strapi base URL: ${STRAPI_BASE_URL}`);

  const jobs = await fetchAllJobs();
  console.log(`📦 Retrieved ${jobs.length} jobs from Strapi`);

  const companyMap = buildCompanyMap(jobs);
  const companies = Array.from(companyMap.values());

  const missingCompanies = companies.filter((company) => !company.hasLogo);
  const alreadyCovered = companies.length - missingCompanies.length;

  console.log(`🏢 Unique companies: ${companies.length}`);
  console.log(`✅ Companies already with logos: ${alreadyCovered}`);
  console.log(`❔ Companies missing logos: ${missingCompanies.length}`);

  const targets = missingCompanies.slice(0, MAX_COMPANIES_PER_RUN);
  if (targets.length === 0) {
    console.log('🎉 No companies without logos found. All done!');
    return;
  }

  console.log(`🛠️  Processing ${targets.length} companies (of max ${MAX_COMPANIES_PER_RUN})`);

  let uploadedCount = 0;
  let assignedCount = 0;
  let processedCount = 0;
  let failures = 0;

  for (const entry of targets) {
    processedCount += 1;
    try {
      console.log(`→ [${processedCount}/${targets.length}] ${entry.displayName}`);
      const result = await processCompany(entry);
      assignedCount += result.assigned;
      if (result.uploaded) {
        uploadedCount += result.uploaded;
      }
      console.log(`   Assigned to ${result.assigned} jobs${result.uploaded ? ' (uploaded new asset)' : ''}`);
    } catch (error) {
      failures += 1;
      const message = error instanceof Error ? error.message : String(error);
      console.error(`❌ Failed to process "${entry.displayName}": ${message}`);
    }
  }

  console.log('📊 Summary');
  console.log(`   Companies processed: ${processedCount}`);
  console.log(`   Logos uploaded: ${uploadedCount}`);
  console.log(`   Jobs updated: ${assignedCount}`);
  console.log(`   Failures: ${failures}`);

  if (failures > 0) {
    console.warn('⚠️  Some companies failed to process. Check logs for details.');
  }
}

main().catch((error) => {
  console.error('❌ Fatal error in company logo sync script:', error);
  process.exitCode = 1;
});

