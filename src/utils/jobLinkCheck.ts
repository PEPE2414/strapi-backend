import { fetch } from 'undici';

export const DEFAULT_JOB_LINK_USER_AGENT =
  process.env.JOB_LINK_CHECK_USER_AGENT ||
  'EffortFreeJobLinkChecker/1.0 (+https://effortfree.co.uk)';

export interface LinkCheckOptions {
  timeoutMs?: number;
  userAgent?: string;
}

export interface LinkCheckResult {
  expired: boolean;
  reason?: string;
}

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

export async function checkJobApplyLink(
  url: string,
  options: LinkCheckOptions = {}
): Promise<LinkCheckResult> {
  const timeoutMs = options.timeoutMs ?? Number(process.env.JOB_LINK_CHECK_TIMEOUT_MS || 10000);
  const userAgent = options.userAgent ?? DEFAULT_JOB_LINK_USER_AGENT;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      method: 'GET',
      redirect: 'follow',
      headers: {
        'User-Agent': userAgent
      },
      signal: controller.signal
    });

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
    const reason =
      error instanceof Error
        ? error.name === 'AbortError'
          ? 'timeout'
          : error.message
        : String(error);
    return { expired: false, reason: `request-error:${reason}` };
  } finally {
    clearTimeout(timer);
  }
}

