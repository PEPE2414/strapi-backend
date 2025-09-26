import { headResolve } from './fetcher';
export async function resolveApplyUrl(url: string) {
  const final = await headResolve(url);
  const u = new URL(final);
  ['utm_source','utm_medium','utm_campaign','utm_term','utm_content','gclid'].forEach(p=>u.searchParams.delete(p));
  return u.toString();
}
