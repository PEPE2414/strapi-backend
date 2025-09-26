import * as cheerio from 'cheerio';
export function pickLogo(html: string, jsonld?: any): string|undefined {
  const first = jsonld?.hiringOrganization?.logo;
  if (first) return toAbs(first);
  const $ = cheerio.load(html);
  const og = $('meta[property="og:image"]').attr('content'); if (og) return toAbs(og);
  const icon = $('link[rel~="icon"]').attr('href') || $('link[rel="apple-touch-icon"]').attr('href');
  return icon ? toAbs(icon) : undefined;
}
function toAbs(href: string) { try { return new URL(href).toString(); } catch { return href; } }
