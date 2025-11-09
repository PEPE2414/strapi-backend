import 'dotenv/config';
import Bottleneck from 'bottleneck';
import { fetch } from 'undici';

type StrapiJobAttributes = {
  title?: string | null;
  applyUrl?: string | null;
  location?: string | null;
  isExpired?: boolean | null;
  lastCheckedAt?: string | null;
};

type StrapiJobRecord = {
  id: number;
  attributes: StrapiJobAttributes;
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

const STRAPI_BASE_URL = (process.env.STRAPI_BASE_URL || process.env.STRAPI_URL || '').replace(/\/$/, '');
const STRAPI_TOKEN = process.env.STRAPI_ADMIN_TOKEN || process.env.STRAPI_TOKEN;

if (!STRAPI_BASE_URL) {
  throw new Error('Missing STRAPI_BASE_URL environment variable');
}

if (!STRAPI_TOKEN) {
  throw new Error('Missing STRAPI_ADMIN_TOKEN environment variable');
}

const PAGE_SIZE = Number(process.env.JOB_LINK_CHECK_PAGE_SIZE || 100);
const MAX_JOBS = Number(process.env.JOB_LINK_CHECK_LIMIT || 500);
const MAX_CONCURRENT = Number(process.env.JOB_LINK_CHECK_CONCURRENCY || 8);
const TIMEOUT_MS = Number(process.env.JOB_LINK_CHECK_TIMEOUT_MS || 10000);
const RECHECK_HOURS = Number(process.env.JOB_LINK_CHECK_INTERVAL_HOURS || 24);

const STATUS_EXPIRED = new Set([404, 410, 451]);
const PHRASES_EXPIRED = [
  'job is no longer available',
  'this job is no longer available',
  'position has been filled',
  'job has expired',
  'posting has expired',
  'job posting has expired',
  'job closed',
  'no longer accepting applications',
  'no longer accepting candidates',
  'job not found'
];

const httpLimiter = new Bottleneck({
  maxConcurrent: MAX_CONCURRENT,
  minTime: 100
});

async function strapiRequest(path: string, options: RequestInit = {}) {
  const url = `${STRAPI_BASE_URL}${path}`;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${STRAPI_TOKEN}`,
    ...(options.headers as Record<string, string> | undefined)
  };

  const response = await fetch(url, { ...options, headers });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Strapi ${options.method || 'GET'} ${path} failed (${response.status}): ${text}`);
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

async function fetchJobsToCheck(): Promise<StrapiJobRecord[]> {
  const all: StrapiJobRecord[] = [];
  let page = 1;
  let pageCount = 1;

  const threshold = new Date(Date.now() - RECHECK_HOURS * 3600 * 1000).toISOString();

  while (page <= pageCount && all.length < MAX_JOBS) {
    const params = new URLSearchParams();
    params.set('pagination[page]', String(page));
    params.set('pagination[pageSize]', String(PAGE_SIZE));
    params.set('fields[0]', 'title');
    params.set('fields[1]', 'applyUrl');
    params.set('fields[2]', 'location');
    params.set('fields[3]', 'isExpired');
    params.set('fields[4]', 'lastCheckedAt');
    params.set('filters[isExpired][$ne]', 'true');
    params.set('filters[$or][0][lastCheckedAt][$null]', 'true');
    params.set('filters[$or][1][lastCheckedAt][$lte]', threshold);

    const json = (await strapiRequest(`/api/jobs?${params.toString()}`)) as StrapiJobResponse;
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

  return all.slice(0, MAX_JOBS);
}

async function verifyJob(job: StrapiJobRecord): Promise<{ expired: boolean; reason?: string }> {
  const applyUrl = job.attributes.applyUrl;
  if (!applyUrl) {
    return { expired: true, reason: 'missing-url' };
  }

  try {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), TIMEOUT_MS);
    const response = await fetch(applyUrl, {
      method: 'GET',
      redirect: 'follow',
      headers: {
        'User-Agent':
          process.env.JOB_LINK_CHECK_USER_AGENT ||
          'EffortFreeJobLinkChecker/1.0 (+https://effortfree.co.uk)'
      },
      signal: controller.signal
    }).finally(() => clearTimeout(id));

    if (STATUS_EXPIRED.has(response.status)) {
      return { expired: true, reason: `status-${response.status}` };
    }

    if (response.status >= 500) {
      return { expired: true, reason: `status-${response.status}` };
    }

    if (response.status >= 400) {
      return { expired: false, reason: `status-${response.status}` };
    }

    const text = (await response.text()).slice(0, 4000).toLowerCase();
    if (PHRASES_EXPIRED.some(phrase => text.includes(phrase))) {
      return { expired: true, reason: 'phrase-match' };
    }

    return { expired: false };
  } catch (error) {
    console.warn(`    ⚠️  Failed to verify ${applyUrl}:`, error instanceof Error ? error.message : String(error));
    return { expired: false, reason: 'request-error' };
  }
}

async function updateJobStatus(job: StrapiJobRecord, expired: boolean) {
  const nowIso = new Date().toISOString();
  const body = JSON.stringify({
    data: {
      isExpired: expired,
      lastCheckedAt: nowIso
    }
  });
  await strapiRequest(`/api/jobs/${job.id}`, { method: 'PUT', body });
}

async function main() {
  console.log('🔍 Checking job apply links...');
  const jobs = await fetchJobsToCheck();
  console.log(`  📥 Loaded ${jobs.length} jobs to verify`);

  let checked = 0;
  let expiredCount = 0;
  let activeCount = 0;

  for (const job of jobs) {
    await httpLimiter.schedule(async () => {
      const title = job.attributes.title || 'Untitled';
      const url = job.attributes.applyUrl || 'N/A';
      console.log(`    🔗 Checking "${title}" (${url})`);
      const result = await verifyJob(job);
      await updateJobStatus(job, result.expired);
      checked += 1;
      if (result.expired) {
        expiredCount += 1;
        console.log(`      🚫 Marked as expired (${result.reason || 'expired'})`);
      } else {
        activeCount += 1;
        console.log(`      ✅ Still active (${result.reason || 'ok'})`);
      }
    });
  }

  console.log('\n📊 Job link check summary:');
  console.log(`  • Checked: ${checked}`);
  console.log(`  • Active: ${activeCount}`);
  console.log(`  • Expired: ${expiredCount}`);
}

main().catch(error => {
  console.error('❌ Job link check failed:', error);
  process.exit(1);
});

