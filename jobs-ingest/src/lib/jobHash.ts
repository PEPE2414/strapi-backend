import { createHash } from 'crypto';

interface HashInput {
  title: string | undefined;
  company: string | undefined;
  id?: string | number | undefined;
  applyUrl?: string | undefined;
  location?: string | undefined;
  postedAt?: string | Date | undefined;
}

function normalize(value: unknown): string {
  if (value === null || value === undefined) {
    return '';
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  return String(value).trim().toLowerCase();
}

/**
 * Generate a stable SHA-256 hash for a job using key identifying fields.
 * This avoids collisions caused by truncating base64 strings and ensures
 * that jobs with different apply URLs or IDs remain unique.
 */
export function generateJobHash({
  title,
  company,
  id,
  applyUrl,
  location,
  postedAt
}: HashInput): string {
  const normalizedTitle = normalize(title);
  const normalizedCompany = normalize(company);
  const normalizedId = normalize(id);
  const normalizedUrl = normalize(applyUrl).split('?')[0];
  const normalizedLocation = normalize(location);
  const normalizedPostedAt = normalize(postedAt);

  const content = [
    normalizedTitle,
    normalizedCompany,
    normalizedUrl,
    normalizedId,
    normalizedLocation,
    normalizedPostedAt
  ]
    .filter(Boolean)
    .join('|');

  // Fallback to title/company if everything else is missing
  const finalContent = content || `${normalizedTitle}|${normalizedCompany}`;

  return createHash('sha256').update(finalContent).digest('hex');
}

