import 'dotenv/config';
import Bottleneck from 'bottleneck';
import { fetch, FormData, File } from 'undici';
import crypto from 'node:crypto';
import { load as loadHtml } from 'cheerio';

type StrapiMedia = {
  id: number;
  attributes?: {
    url?: string;
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

type CompanyAssetAttributes = {
  name: string;
  normalizedName: string;
  status: 'pending' | 'validated' | 'needs_manual_review';
  canonicalDomain?: string | null;
  candidateDomains?: string[] | null;
  logo?: { data?: StrapiMedia | null } | StrapiMedia | number | null;
  logoHash?: string | null;
  sourcesChecked?: Array<Record<string, unknown>> | null;
  lastAttemptedAt?: string | null;
  validatedAt?: string | null;
  lastSeenAt?: string | null;
  notes?: string | null;
};

type CompanyAssetRecord = {
  id: number;
  attributes: CompanyAssetAttributes;
};

type CompanyAssetResponse = {
  data: CompanyAssetRecord[];
  meta?: {
    pagination?: {
      page: number;
      pageCount: number;
      pageSize: number;
      total: number;
    };
  };
};

type CandidateAttempt = {
  source: string;
  url: string;
  domain?: string;
  status: 'ok' | 'error';
  contentType?: string;
  size?: number;
  hash?: string;
  message?: string;
};

type LogoCandidateFetch = {
  source: string;
  url: string;
  domain?: string;
};

type LogoCandidateResult = {
  hash: string;
  buffer: Buffer;
  contentType: string;
  size: number;
  sources: Set<string>;
  urls: Set<string>;
};

type CompanyInfo = {
  name: string;
  normalizedName: string;
  jobs: StrapiJobRecord[];
  candidateDomains: Set<string>;
  asset?: CompanyAssetRecord;
};

function numericEnv(value: string | undefined, fallback: number, { min = 0, max }: { min?: number; max?: number } = {}) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  let clamped = parsed;
  if (min !== undefined && clamped < min) clamped = fallback;
  if (max !== undefined && clamped > max) clamped = max;
  return clamped;
}

const STRAPI_BASE_URL = (process.env.STRAPI_BASE_URL || process.env.STRAPI_URL || '').replace(/\/$/, '');
const STRAPI_TOKEN = process.env.STRAPI_ADMIN_TOKEN || process.env.STRAPI_TOKEN;
const LOGO_SIZE = numericEnv(process.env.COMPANY_LOGO_SIZE, 256, { min: 32, max: 512 });
const JOB_PAGE_SIZE = numericEnv(process.env.COMPANY_LOGO_PAGE_SIZE, 200, { min: 1, max: 500 });
const MAX_COMPANIES_PER_RUN = numericEnv(process.env.COMPANY_LOGO_MAX_COMPANIES, 40, { min: 1 });
const MAX_DOMAINS_PER_COMPANY = numericEnv(process.env.COMPANY_LOGO_MAX_DOMAINS, 5, { min: 1, max: 25 });
const CLEARBIT_AUTOCOMPLETE_ENDPOINT = 'https://autocomplete.clearbit.com/v1/companies/suggest';
const MIN_VALID_BYTES = numericEnv(process.env.COMPANY_LOGO_MIN_BYTES, 8192, { min: 512 });
const FETCH_TIMEOUT_MS = numericEnv(process.env.COMPANY_LOGO_FETCH_TIMEOUT_MS, 8000, { min: 1000, max: 20000 });
const USER_AGENT = process.env.COMPANY_LOGO_USER_AGENT || 'EffortFreeCompanyLogoBot/1.0';

if (!STRAPI_BASE_URL) {
  throw new Error('Missing STRAPI_BASE_URL environment variable');
}

if (!STRAPI_TOKEN) {
  throw new Error('Missing STRAPI_ADMIN_TOKEN environment variable');
}

const httpLimiter = new Bottleneck({
  maxConcurrent: 4,
  minTime: 200,
});

const strapiLimiter = new Bottleneck({
  maxConcurrent: 2,
  minTime: 200,
});

function nowIso(): string {
  return new Date().toISOString();
}

function toArray<T>(value: T | T[] | null | undefined): T[] {
  if (Array.isArray(value)) return value;
  if (value == null) return [];
  return [value];
}

function extractMedia(media: { data?: StrapiMedia | null } | StrapiMedia | number | null | undefined): StrapiMedia | null {
  if (!media) return null;
  if (typeof media === 'number') return null;
  if (typeof (media as any).data === 'object' && (media as any).data) {
    return (media as any).data as StrapiMedia;
  }
  return media as StrapiMedia;
}

function extractMediaId(media: { data?: StrapiMedia | null } | StrapiMedia | number | null | undefined): number | undefined {
  const extracted = extractMedia(media);
  return extracted?.id;
}

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

function extractCompanyName(companyField: StrapiJobRecord['attributes']['company']): string {
  if (!companyField) return '';
  if (typeof companyField === 'string') return companyField;
  if (typeof companyField.name === 'string') return companyField.name;
  return '';
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

function addCandidateDomain(set: Set<string>, ...domains: Array<string | null | undefined>) {
  for (const domain of domains) {
    if (!domain) continue;
    const clean = domain.replace(/^https?:\/\//i, '').replace(/^www\./i, '').toLowerCase();
    if (!clean || /^[0-9.]+$/.test(clean)) continue;
    if (clean.includes('linkedin.com') || clean.includes('google.com')) continue;
    set.add(clean);
  }
  while (set.size > MAX_DOMAINS_PER_COMPANY) {
    const first = set.values().next().value;
    if (!first) break;
    set.delete(first);
  }
}

async function strapiRequest(path: string, opts: { method?: string; body?: unknown; headers?: Record<string, string> } = {}) {
  const method = (opts.method || 'GET').toUpperCase();
  const url = `${STRAPI_BASE_URL}${path.startsWith('/') ? '' : '/'}${path}`;
  const headers: Record<string, string> = {
    Authorization: `Bearer ${STRAPI_TOKEN}`,
    Accept: 'application/json',
    ...opts.headers,
  };
  let body: any;

  if (opts.body && !(opts.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
    body = JSON.stringify(opts.body);
  } else if (opts.body instanceof FormData) {
    body = opts.body as FormData;
  }

  const response = await strapiLimiter.schedule(() =>
    fetch(url, {
      method,
      headers,
      body,
    }),
  );

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Strapi ${method} ${path} failed (${response.status}): ${text}`);
  }

  if (response.status === 204) {
    return null;
  }

  const contentType = response.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    return response.json();
  }

  return response.text();
}

async function fetchAllJobs(): Promise<StrapiJobRecord[]> {
  const all: StrapiJobRecord[] = [];
  let page = 1;
  let pageCount = 1;

  while (page <= pageCount) {
    const params = new URLSearchParams();
    params.set('pagination[page]', String(page));
    params.set('pagination[pageSize]', String(JOB_PAGE_SIZE));
    params.set('fields[0]', 'title');
    params.set('fields[1]', 'company');
    params.set('fields[2]', 'companyPageUrl');
    params.set('fields[3]', 'applyUrl');
    params.set('fields[4]', 'sourceUrl');
    params.set('fields[5]', 'slug');
    params.set('populate[companyLogo]', 'true');

    const json = (await strapiRequest(`/api/jobs?${params.toString()}`)) as StrapiJobResponse;
    const data = json.data || [];
    all.push(...data);

    const meta = json.meta?.pagination;
    if (meta?.pageCount) {
      pageCount = meta.pageCount;
    } else if (data.length < JOB_PAGE_SIZE) {
      break;
    }

    page += 1;
  }

  return all;
}

async function fetchAllCompanyAssets(): Promise<CompanyAssetRecord[]> {
  const all: CompanyAssetRecord[] = [];
  let page = 1;
  let pageCount = 1;

  while (page <= pageCount) {
    const params = new URLSearchParams();
    params.set('pagination[page]', String(page));
    params.set('pagination[pageSize]', '200');
    params.set('populate[logo]', 'true');

    const json = (await strapiRequest(`/api/company-brand-assets?${params.toString()}`)) as CompanyAssetResponse;
    const data = json.data || [];
    all.push(...data);

    const meta = json.meta?.pagination;
    if (meta?.pageCount) {
      pageCount = meta.pageCount;
    } else if (data.length < 200) {
      break;
    }
    page += 1;
  }

  return all;
}

async function createCompanyAsset(data: Partial<CompanyAssetAttributes>) {
  const response = await strapiRequest('/api/company-brand-assets', {
    method: 'POST',
    body: { data },
  });
  return (response as { data: CompanyAssetRecord }).data;
}

async function updateCompanyAsset(id: number, data: Partial<CompanyAssetAttributes>) {
  const response = await strapiRequest(`/api/company-brand-assets/${id}`, {
    method: 'PUT',
    body: { data },
  });
  return (response as { data: CompanyAssetRecord }).data;
}

function gatherCompanyInfo(jobs: StrapiJobRecord[]): Map<string, CompanyInfo> {
  const map = new Map<string, CompanyInfo>();

  for (const job of jobs) {
    if (!job?.attributes) continue;

    const companyName = extractCompanyName(job.attributes.company);
    const normalizedName = normaliseCompanyName(companyName);

    if (!normalizedName || normalizedName === 'unknown' || normalizedName === 'unknown company') {
      continue;
    }

    if (!map.has(normalizedName)) {
      map.set(normalizedName, {
        name: companyName || 'Unknown',
        normalizedName,
        jobs: [],
        candidateDomains: new Set<string>(),
      });
    }

    const info = map.get(normalizedName)!;
    info.jobs.push(job);

    addCandidateDomain(
      info.candidateDomains,
      extractDomainFromUrl(job.attributes.companyPageUrl),
      extractDomainFromUrl(job.attributes.applyUrl),
      extractDomainFromUrl(job.attributes.sourceUrl),
    );
  }

  return map;
}

function mergeCandidateDomains(existing: string[] | null | undefined, incoming: Set<string>): string[] {
  const merged = new Set<string>();
  addCandidateDomain(merged, ...(existing || []));
  addCandidateDomain(merged, ...incoming);
  return Array.from(merged);
}

async function ensureCompanyAssets(map: Map<string, CompanyInfo>, existingAssets: CompanyAssetRecord[]) {
  const existingByNormalized = new Map<string, CompanyAssetRecord>();
  for (const asset of existingAssets) {
    existingByNormalized.set(asset.attributes.normalizedName, asset);
  }

  for (const info of map.values()) {
    const now = nowIso();
    const asset = existingByNormalized.get(info.normalizedName);

    if (!asset) {
      const candidateDomains = mergeCandidateDomains([], info.candidateDomains);
      const created = await createCompanyAsset({
        name: info.name,
        normalizedName: info.normalizedName,
        status: 'pending',
        candidateDomains,
        lastSeenAt: now,
        sourcesChecked: [],
      });
      info.asset = created;
      existingByNormalized.set(info.normalizedName, created);
      console.log(`🆕 Created brand asset record for ${info.name}`);
    } else {
      const candidateDomains = mergeCandidateDomains(asset.attributes.candidateDomains, info.candidateDomains);
      const updates: Partial<CompanyAssetAttributes> = {};
      if (asset.attributes.name !== info.name) {
        updates.name = info.name;
      }
      if (JSON.stringify((asset.attributes.candidateDomains || []).sort()) !== JSON.stringify(candidateDomains.slice().sort())) {
        updates.candidateDomains = candidateDomains;
      }
      updates.lastSeenAt = now;

      if (Object.keys(updates).length > 0) {
        const updated = await updateCompanyAsset(asset.id, updates);
        existingByNormalized.set(info.normalizedName, updated);
        info.asset = updated;
      } else {
        info.asset = asset;
      }
    }
  }
}

async function lookupDomain(companyName: string): Promise<{ domain: string; logoUrl?: string } | null> {
  if (!companyName) return null;

  const query = encodeURIComponent(companyName);
  const apiUrl = `${CLEARBIT_AUTOCOMPLETE_ENDPOINT}?query=${query}`;

  try {
    const response = await httpLimiter.schedule(() =>
      fetch(apiUrl, {
        headers: { Accept: 'application/json' },
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
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
  } catch (error) {
    console.warn(`⚠️  Failed to lookup domain for "${companyName}":`, error instanceof Error ? error.message : String(error));
    return null;
  }
}

async function downloadCandidate(candidate: LogoCandidateFetch): Promise<{ buffer: Buffer; contentType: string; size: number; hash: string } | null> {
  try {
    const response = await httpLimiter.schedule(() =>
      fetch(candidate.url, {
        headers: {
          Accept: 'image/*',
          'User-Agent': USER_AGENT,
        },
        redirect: 'follow',
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      }),
    );

    if (!response.ok) {
      return null;
    }

    const contentType = (response.headers.get('content-type') || '').split(';')[0].trim().toLowerCase();
    if (!contentType.startsWith('image/')) {
      return null;
    }

    const arrayBuffer = await response.arrayBuffer();
    if (!arrayBuffer || arrayBuffer.byteLength === 0) {
      return null;
    }

    const buffer = Buffer.from(arrayBuffer);
    const hash = crypto.createHash('sha256').update(buffer).digest('hex');
    return {
      buffer,
      contentType,
      size: buffer.length,
      hash,
    };
  } catch {
    return null;
  }
}

async function discoverHtmlIcons(domain: string): Promise<string[]> {
  const urls = new Set<string>();
  try {
    const baseUrl = `https://${domain}`;
    const response = await httpLimiter.schedule(() =>
      fetch(baseUrl, {
        headers: { 'User-Agent': USER_AGENT },
        redirect: 'follow',
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      }),
    );

    if (!response.ok) return [];
    const contentType = response.headers.get('content-type') || '';
    if (!contentType.includes('text/html')) return [];

    const html = await response.text();
    const $ = loadHtml(html);

    $('link[rel*=icon], link[rel*=apple-touch-icon], link[rel*=mask-icon]').each((_, el) => {
      const href = ($(el).attr('href') || '').trim();
      if (!href) return;
      try {
        const absolute = new URL(href, baseUrl).toString();
        urls.add(absolute);
      } catch {
        // ignore bad URLs
      }
    });
  } catch {
    // ignore
  }
  return Array.from(urls);
}

function buildDomainCandidates(domain: string, hintLogoUrl?: string): LogoCandidateFetch[] {
  const out: LogoCandidateFetch[] = [];
  out.push({
    source: 'clearbit-direct',
    url: `https://logo.clearbit.com/${encodeURIComponent(domain)}?size=${Math.min(Math.max(LOGO_SIZE, 64), 512)}&format=png`,
    domain,
  });
  out.push({
    source: 'logo.dev',
    url: `https://img.logo.dev/${encodeURIComponent(domain)}?size=${Math.min(Math.max(LOGO_SIZE, 64), 512)}`,
    domain,
  });
  out.push({
    source: 'google-s2',
    url: `https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=256`,
    domain,
  });
  out.push({
    source: 'domain-favicon',
    url: `https://${domain}/favicon.ico`,
    domain,
  });
  out.push({
    source: 'domain-touch-icon',
    url: `https://${domain}/apple-touch-icon.png`,
    domain,
  });

  if (hintLogoUrl && hintLogoUrl.startsWith('http')) {
    out.push({
      source: 'clearbit-autocomplete',
      url: hintLogoUrl,
      domain,
    });
  }

  return out;
}

async function collectCandidatesForDomains(domains: string[], hintLogoUrl?: string): Promise<LogoCandidateFetch[]> {
  const candidates: LogoCandidateFetch[] = [];
  for (const domain of domains.slice(0, MAX_DOMAINS_PER_COMPANY)) {
    candidates.push(...buildDomainCandidates(domain, hintLogoUrl));
    const htmlIcons = await discoverHtmlIcons(domain);
    for (const iconUrl of htmlIcons) {
      candidates.push({ source: 'html-icon', url: iconUrl, domain });
    }
  }
  return candidates;
}

async function uploadLogo(companyName: string, buffer: Buffer, contentType: string) {
  const extension = contentType.includes('svg') ? 'svg' : contentType.includes('webp') ? 'webp' : 'png';
  const fileName = `${slugify(companyName) || 'company'}-logo.${extension}`;
  const file = new File([buffer], fileName, { type: contentType });
  const form = new FormData();
  form.append('files', file);

  const response = (await strapiRequest('/api/upload', { method: 'POST', body: form })) as Array<{ id: number; url?: string }>;
  const uploaded = response?.[0];
  if (!uploaded?.id) {
    throw new Error(`Strapi upload response missing file id for "${companyName}"`);
  }
  return uploaded;
}

async function assignLogoToJob(jobId: number, fileId: number): Promise<void> {
  await strapiRequest(`/api/jobs/${jobId}`, {
    method: 'PUT',
    body: {
      data: {
        companyLogo: fileId,
      },
    },
  });
}

function validateGroup(group: LogoCandidateResult): boolean {
  if (group.sources.size < 2) return false;
  if (group.contentType.includes('svg')) {
    return group.size > 1024;
  }
  return group.size >= MIN_VALID_BYTES;
}

async function processCompany(info: CompanyInfo): Promise<void> {
  const asset = info.asset;
  if (!asset) {
    console.warn(`⚠️  No asset record linked for company "${info.name}" – skipping`);
    return;
  }

  if (asset.attributes.status === 'validated') {
    console.log(`✅ Already validated: ${info.name}`);
    return;
  }

  const sourcesChecked: CandidateAttempt[] = [];
  const domains = mergeCandidateDomains(asset.attributes.candidateDomains, info.candidateDomains);
  let canonicalDomain = asset.attributes.canonicalDomain || null;

  if (!canonicalDomain && domains.length === 1) {
    canonicalDomain = domains[0];
  }

  const suggestion = await lookupDomain(info.name);
  if (suggestion?.domain) {
    domains.unshift(suggestion.domain);
    addCandidateDomain(info.candidateDomains, suggestion.domain);
    if (!canonicalDomain) canonicalDomain = suggestion.domain;
  }

  const uniqueDomains = Array.from(new Set(domains)).filter(Boolean);
  if (uniqueDomains.length === 0) {
    info.asset = await updateCompanyAsset(asset.id, {
      status: 'needs_manual_review',
      lastAttemptedAt: nowIso(),
      candidateDomains: [],
      canonicalDomain: canonicalDomain,
      notes: 'No usable domains discovered for this company.',
    });
    console.warn(`⚠️  No domains to try for "${info.name}", marked for manual review.`);
    return;
  }

  const candidateDescriptors = await collectCandidatesForDomains(uniqueDomains, suggestion?.logoUrl);
  const seenUrls = new Set<string>();
  const groups = new Map<string, LogoCandidateResult>();

  for (const descriptor of candidateDescriptors) {
    if (seenUrls.has(descriptor.url)) {
      continue;
    }
    seenUrls.add(descriptor.url);

    const result = await downloadCandidate(descriptor);
    if (result) {
      const existing = groups.get(result.hash);
      if (existing) {
        existing.sources.add(descriptor.source);
        existing.urls.add(descriptor.url);
        if (result.size > existing.size) {
          existing.size = result.size;
          existing.buffer = result.buffer;
          existing.contentType = result.contentType;
        }
      } else {
        groups.set(result.hash, {
          hash: result.hash,
          buffer: result.buffer,
          contentType: result.contentType,
          size: result.size,
          sources: new Set([descriptor.source]),
          urls: new Set([descriptor.url]),
        });
      }
      sourcesChecked.push({
        source: descriptor.source,
        url: descriptor.url,
        domain: descriptor.domain,
        status: 'ok',
        size: result.size,
        contentType: result.contentType,
        hash: result.hash,
      });
    } else {
      sourcesChecked.push({
        source: descriptor.source,
        url: descriptor.url,
        domain: descriptor.domain,
        status: 'error',
      });
    }
  }

  const validGroups = Array.from(groups.values()).filter(validateGroup);

  if (validGroups.length === 0) {
    info.asset = await updateCompanyAsset(asset.id, {
      candidateDomains: uniqueDomains,
      canonicalDomain: canonicalDomain,
      status: 'needs_manual_review',
      sourcesChecked,
      lastAttemptedAt: nowIso(),
      notes: 'No candidate logo confirmed by multiple sources. Manual review required.',
    });
    console.warn(`⚠️  No validated logo for "${info.name}". Marked for manual review.`);
    return;
  }

  const bestGroup = validGroups.sort((a, b) => b.size - a.size)[0];
  const newHash = bestGroup.hash;
  let logoFileId = extractMediaId(asset.attributes.logo);

  if (asset.attributes.logoHash !== newHash || !logoFileId) {
    const upload = await uploadLogo(info.name, bestGroup.buffer, bestGroup.contentType);
    logoFileId = upload.id;
    console.log(`⬆️  Uploaded logo for "${info.name}" (${bestGroup.contentType}, ${(bestGroup.size / 1024).toFixed(1)} KB)`);
  } else {
    console.log(`ℹ️  Logo already up-to-date for "${info.name}"`);
  }

  info.asset = await updateCompanyAsset(asset.id, {
    status: 'validated',
    validatedAt: nowIso(),
    lastAttemptedAt: nowIso(),
    candidateDomains: uniqueDomains,
    canonicalDomain,
    logo: logoFileId,
    logoHash: newHash,
    sourcesChecked,
    notes: null,
  });

  let updates = 0;
  for (const job of info.jobs) {
    const currentLogoId = extractMediaId(job.attributes.companyLogo);
    if (currentLogoId === logoFileId) continue;
    await assignLogoToJob(job.id, logoFileId);
    updates += 1;
  }

  console.log(`✅ Validated logo for "${info.name}" (assigned to ${updates} jobs)`);
}

async function main() {
  console.log('🚀 Starting company logo validation run');

  const jobs = await fetchAllJobs();
  console.log(`📦 Retrieved ${jobs.length} jobs from Strapi`);

  const companyMap = gatherCompanyInfo(jobs);
  console.log(`🏢 Unique companies detected: ${companyMap.size}`);

  const existingAssets = await fetchAllCompanyAssets();
  await ensureCompanyAssets(companyMap, existingAssets);

  const pendingCompanies = Array.from(companyMap.values())
    .filter((info) => info.asset?.attributes.status === 'pending')
    .slice(0, MAX_COMPANIES_PER_RUN);

  if (pendingCompanies.length === 0) {
    console.log('🎉 No pending companies found. All done!');
    return;
  }

  console.log(`🛠️  Processing ${pendingCompanies.length} companies (max ${MAX_COMPANIES_PER_RUN})`);

  let processed = 0;
  let failures = 0;

  for (const info of pendingCompanies) {
    processed += 1;
    console.log(`→ [${processed}/${pendingCompanies.length}] ${info.name}`);
    try {
      await processCompany(info);
    } catch (error) {
      failures += 1;
      console.error(`❌ Error processing "${info.name}":`, error instanceof Error ? error.stack || error.message : String(error));
    }
  }

  console.log('📊 Run summary');
  console.log(`   Companies processed: ${processed}`);
  console.log(`   Failures: ${failures}`);
  console.log('Done.');
}

main().catch((error) => {
  console.error('❌ Fatal error in company logo sync script:', error);
  process.exitCode = 1;
});