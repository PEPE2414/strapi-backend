type RapidApiSource =
  | 'jsearch'
  | 'linkedin-jobs'
  | 'jobs-api14'
  | 'glassdoor-real-time'
  | 'active-jobs-db';

type UsageEntry = {
  requests: number;
  quota: number;
};

const DEFAULT_LIMITS: Record<RapidApiSource, number> = {
  'jsearch': 200_000,
  'linkedin-jobs': 50_000,
  'jobs-api14': 50_000,
  'glassdoor-real-time': 30_000,
  'active-jobs-db': 30_000
};

const usage: Record<RapidApiSource, UsageEntry> = {
  'jsearch': { requests: 0, quota: resolveQuota('jsearch') },
  'linkedin-jobs': { requests: 0, quota: resolveQuota('linkedin-jobs') },
  'jobs-api14': { requests: 0, quota: resolveQuota('jobs-api14') },
  'glassdoor-real-time': { requests: 0, quota: resolveQuota('glassdoor-real-time') },
  'active-jobs-db': { requests: 0, quota: resolveQuota('active-jobs-db') }
};

function resolveQuota(source: RapidApiSource): number {
  const envKey = `RAPIDAPI_LIMIT_${source.replace(/[- ]/g, '_').toUpperCase()}`;
  const envValue = process.env[envKey];
  if (!envValue) {
    return DEFAULT_LIMITS[source];
  }
  const parsed = Number(envValue);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_LIMITS[source];
}

export function recordRapidApiRequest(source: RapidApiSource, count = 1) {
  const entry = usage[source];
  entry.requests += count;
}

export function logRapidApiUsage(
  source: RapidApiSource,
  context?: Record<string, string | number | undefined>
) {
  const { requests, quota } = usage[source];
  if (requests === 0) {
    return;
  }

  const utilisation = quota > 0 ? Math.min(100, (requests / quota) * 100) : null;
  const contextParts = context
    ? Object.entries(context)
        .filter(([, value]) => value !== undefined && value !== '')
        .map(([key, value]) => `${key}: ${value}`)
    : [];

  const contextSuffix = contextParts.length > 0 ? ` | ${contextParts.join(' | ')}` : '';
  const utilisationText = utilisation !== null
    ? ` (${requests}/${quota} ≈ ${utilisation.toFixed(2)}%)`
    : '';

  console.log(`📈 RapidAPI usage [${source}]: ${requests} requests${utilisationText}${contextSuffix}`);
}

export function summarizeRapidApiUsage() {
  console.log('\n📊 RapidAPI request summary (this run)');
  (Object.keys(usage) as RapidApiSource[]).forEach((source) => {
    logRapidApiUsage(source);
  });
}

export function getRapidApiUsage(source: RapidApiSource): UsageEntry {
  return usage[source];
}

