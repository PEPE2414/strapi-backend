import * as cheerio from '../../../node_modules/cheerio';
export function extractJobPostingJSONLD(html: string) {
  const $ = cheerio.load(html);
  const blocks = $('script[type="application/ld+json"]').toArray().map(el => $(el).contents().text());
  const objs = blocks.flatMap(txt => {
    try { const p = JSON.parse(txt.trim()); return Array.isArray(p) ? p : [p]; } catch { return []; }
  });
  const flat = (node: any): any[] => !node || typeof node !== 'object' ? [] :
    [node, ...Object.values(node).flatMap(v => Array.isArray(v) ? v.flatMap(flat) : typeof v === 'object' ? flat(v) : [])];
  const all = objs.flatMap(flat);
  return all.find(n => {
    const t = n?.['@type']; if (!t) return false;
    const arr = Array.isArray(t) ? t : [t];
    return arr.map((x: any)=>String(x).toLowerCase()).includes('jobposting');
  });
}
