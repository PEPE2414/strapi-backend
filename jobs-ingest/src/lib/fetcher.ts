import { request } from 'undici';
export async function get(url: string, headers: Record<string,string> = {}) {
  const res = await request(url, {
    method: 'GET',
    headers: { 'user-agent': process.env.USER_AGENT || 'EffortFreeBot/1.0', ...headers },
    maxRedirections: 5
  });
  if (res.statusCode >= 400) throw new Error(`GET ${url} -> ${res.statusCode}`);
  const html = await res.body.text();
  return { url: (res as any).url ?? url, headers: res.headers, html };
}
export async function headResolve(url: string) {
  try {
    const res = await request(url, { method: 'HEAD', maxRedirections: 5 });
    return (res as any).url ?? url;
  } catch { return url; }
}
