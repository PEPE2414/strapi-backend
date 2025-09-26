import { SalaryNorm } from '../types';

// Enhanced classification for UK university students
export function classifyJobType(text: string): 'internship'|'placement'|'graduate'|'other' {
  const t = text.toLowerCase();
  
  // Internship keywords
  if (/\b(intern(ship)?|summer internship|winter internship|spring internship|vacation scheme|vacation work)\b/.test(t)) {
    return 'internship';
  }
  
  // Placement/Year in Industry keywords (UK sandwich courses)
  if (/\b(placement|year in industry|sandwich|industrial placement|work placement|year out|gap year|year abroad)\b/.test(t)) {
    return 'placement';
  }
  
  // Graduate/Early Careers keywords
  if (/\b(graduate|early careers|new grad|new graduate|entry level|junior|trainee|traineeship|graduate scheme|graduate program|graduate programme|graduate trainee|graduate engineer|graduate consultant|graduate analyst|graduate developer|graduate designer|graduate marketing|graduate sales|graduate finance|graduate hr|graduate hr|graduate operations|graduate project|graduate research|graduate scientist|graduate technician|graduate technologist|graduate architect|graduate surveyor|graduate planner|graduate environmental|graduate sustainability|graduate energy|graduate renewable|graduate nuclear|graduate aerospace|graduate automotive|graduate mechanical|graduate electrical|graduate civil|graduate structural|graduate geotechnical|graduate transportation|graduate water|graduate waste|graduate environmental|graduate sustainability|graduate energy|graduate renewable|graduate nuclear|graduate aerospace|graduate automotive|graduate mechanical|graduate electrical|graduate civil|graduate structural|graduate geotechnical|graduate transportation|graduate water|graduate waste)\b/.test(t)) {
    return 'graduate';
  }
  
  return 'other';
}

// Check if a job is relevant for university students
export function isRelevantJobType(text: string): boolean {
  const t = text.toLowerCase();
  
  // Positive keywords (include these)
  const positiveKeywords = [
    // Internships
    'intern', 'internship', 'summer', 'vacation', 'work experience',
    // Placements
    'placement', 'year in industry', 'sandwich', 'industrial placement', 'work placement',
    // Graduate roles
    'graduate', 'early careers', 'new grad', 'entry level', 'junior', 'trainee',
    // Specific graduate roles
    'graduate engineer', 'graduate consultant', 'graduate analyst', 'graduate developer',
    'graduate designer', 'graduate marketing', 'graduate sales', 'graduate finance',
    'graduate hr', 'graduate operations', 'graduate project', 'graduate research',
    'graduate scientist', 'graduate technician', 'graduate technologist',
    'graduate architect', 'graduate surveyor', 'graduate planner',
    // Engineering specializations
    'graduate civil', 'graduate structural', 'graduate mechanical', 'graduate electrical',
    'graduate aerospace', 'graduate automotive', 'graduate environmental',
    'graduate sustainability', 'graduate energy', 'graduate renewable', 'graduate nuclear'
  ];
  
  // Negative keywords (exclude these)
  const negativeKeywords = [
    'senior', 'principal', 'lead', 'head of', 'director', 'manager', 'vp', 'vice president',
    'executive', 'ceo', 'cto', 'cfo', 'coo', 'founder', 'co-founder',
    '5+ years', '10+ years', '15+ years', '20+ years',
    'experienced', 'expert', 'specialist', 'consultant', 'architect',
    'mid-level', 'mid level', 'intermediate', 'advanced'
  ];
  
  // Check for positive keywords
  const hasPositive = positiveKeywords.some(keyword => t.includes(keyword));
  
  // Check for negative keywords
  const hasNegative = negativeKeywords.some(keyword => t.includes(keyword));
  
  // Include if has positive keywords AND no negative keywords
  return hasPositive && !hasNegative;
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
