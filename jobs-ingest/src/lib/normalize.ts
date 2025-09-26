import { SalaryNorm } from '../types';

// basic, rules-first parsers; LLM used only when these fail
export function classifyJobType(text: string): 'internship'|'placement'|'graduate'|'other' {
  const t = text.toLowerCase();
  if (/\b(intern(ship)?|summer|industrial placement)\b/.test(t)) return 'internship';
  if (/\b(placement|year in industry|sandwich)\b/.test(t)) return 'placement';
  if (/\b(graduate|early careers|new grad)\b/.test(t)) return 'graduate';
  return 'other';
}

export function parseSalary(text?: string): SalaryNorm|undefined {
  if (!text) return undefined;
  // very light parser; prefer JSON-LD if present
  const m = text.replace(/[, ]/g,'').match(/£?(\d{2,6})(?:[-–/to]+£?(\d{2,6}))?(?:\s*(pa|perannum|year|hour|day|week|month))?/i);
  if (!m) return undefined;
  const min = Number(m[1]), max = m[2] ? Number(m[2]) : undefined;
  let period: SalaryNorm['period'] = 'year';
  if (m[3]) {
    const p = m[3].toLowerCase();
    if (p.includes('hour')) period='hour';
    else if (p.includes('day')) period='day';
    else if (p.includes('week')) period='week';
    else if (p.includes('month')) period='month';
  }
  return { min, max, currency:'GBP', period };
}

export const toISO = (s?: string) => {
  if (!s) return undefined;
  const d = new Date(s);
  return isNaN(d.getTime()) ? undefined : d.toISOString();
}
