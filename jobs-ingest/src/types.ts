export type SalaryNorm = { min?: number; max?: number; currency?: string; period?: 'year'|'month'|'week'|'day'|'hour' };

export type CanonicalJob = {
  source: string;             // e.g. "greenhouse:company", "site:bristol.ac.uk"
  sourceUrl: string;          // where we scraped
  title: string;
  company: { name: string; website?: string; logoUrl?: string };
  companyLogo?: string;       // URL to company logo image
  location?: string;          // city/region/country (raw best-effort)
  descriptionHtml?: string;
  descriptionText?: string;
  applyUrl: string;           // final resolved URL
  deadline?: string;          // ISO8601
  jobType: 'internship'|'placement'|'graduate'|'other';
  salary?: SalaryNorm;
  startDate?: string;         // ISO8601
  endDate?: string;           // ISO8601
  duration?: string;          // e.g. "12 months"
  experience?: string;        // e.g. "0–1 years"
  companyPage?: string;       // official company/careers
  relatedDegree?: string[];   // e.g. ["Civil","Mechanical","STEM"]
  degreeLevel?: string[];     // e.g. ["BEng","MEng","MSc","2:1"]
  postedAt?: string;          // ISO8601
  slug: string;               // unique slug for FE
  hash: string;               // stable idempotency key
};
