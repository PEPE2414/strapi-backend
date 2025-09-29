export type SalaryNorm = { min?: number; max?: number; currency?: string; period?: 'year'|'month'|'week'|'day'|'hour' };

export type CanonicalJob = {
  // Core identification
  source: string;             // e.g. "greenhouse:company", "workday:company", "site:bristol.ac.uk"
  sourceUrl: string;          // where we scraped
  title: string;              // REQUIRED: Job title
  company: { 
    name: string;             // REQUIRED: Company name
    website?: string; 
    logoUrl?: string 
  };
  
  // Visual elements
  companyLogo?: string;       // URL to company logo image (attempted)
  companyPageUrl?: string;    // REQUIRED: Official company/careers page
  
  // Location and work arrangement
  location?: string;          // city/region/country (raw best-effort)
  remotePolicy?: 'on-site'|'hybrid'|'remote-uk'|'remote-anywhere';
  
  // Job content
  descriptionHtml?: string;   // Raw HTML description
  descriptionText?: string;   // REQUIRED: Clean text description (≥300 chars)
  
  // Application details
  applyUrl: string;           // REQUIRED: Final resolved URL (not aggregator)
  applyDeadline?: string;     // ISO8601 - application deadline
  
  // Job classification
  jobType: 'internship'|'placement'|'graduate'|'other';  // REQUIRED
  experience?: string;        // e.g. "0–2 years", "entry level"
  
  // Dates and duration
  startDate?: string;         // ISO8601 - job start date
  endDate?: string;           // ISO8601 - job end date
  duration?: string;          // e.g. "12 months", "6 weeks"
  postedAt?: string;          // ISO8601 - when job was posted
  
  // Compensation
  salary?: SalaryNorm;        // Salary information
  
  // Education requirements
  relatedDegree?: string[];   // e.g. ["Civil","Mechanical","STEM"]
  degreeLevel?: string[];     // e.g. ["BEng","MEng","MSc","2:1", "UG", "PG-taught"]
  
  // Technical fields
  slug: string;               // REQUIRED: unique slug for FE
  hash: string;               // REQUIRED: stable idempotency key
  
  // Quality indicators
  qualityScore?: number;      // 0-100 quality score based on completeness
  lastValidated?: string;     // ISO8601 - when job was last validated
};
