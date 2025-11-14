// Rotation and freshness management for job scraping
import { GREENHOUSE_BOARDS, LEVER_COMPANIES, WORKABLE_COMPANIES, ASHBY_COMPANIES, TEAMTAILOR_COMPANIES } from '../config/sources';

export interface CrawlBucket {
  id: string;
  name: string;
  sources: string[];
  lastCrawled?: Date;
  priority: 'high' | 'medium' | 'low';
}

export interface CrawlLog {
  url: string;
  lastSeen: Date;
  status: 'success' | 'error' | 'skipped';
  etag?: string;
  lastModified?: Date;
  contentHash?: string;
  errorReason?: string;
}

// Define source buckets for rotation with expanded coverage
export const CRAWL_BUCKETS: CrawlBucket[] = [
  {
    id: 'ats-daily',
    name: 'ATS Platforms (Daily)',
    sources: [
      'stripe', 'shopify', 'netflix', 'airbnb', 'uber', 'lyft', 'spotify', 'slack', 'zoom',
      'workday:rolls-royce', 'workday:bp', 'workday:shell', 'workday:unilever',
      'successfactors:sap', 'successfactors:siemens', 'successfactors:bosch',
      'icims:jpmorgan', 'icims:goldman-sachs', 'icims:morgan-stanley'
    ],
    priority: 'high'
  },
  {
    id: 'major-job-boards',
    name: 'Major Job Boards (Every 2 days)',
    sources: [
      'https://www.reed.co.uk/sitemap.xml',
      'https://www.totaljobs.com/sitemap.xml', 
      'https://www.monster.co.uk/sitemap.xml',
      'https://www.cv-library.co.uk/sitemap.xml',
      'https://www.jobsite.co.uk/sitemap.xml',
      'https://www.fish4jobs.co.uk/sitemap.xml',
      'https://www.jobs.co.uk/sitemap.xml',
      'https://www.careerjet.co.uk/sitemap.xml',
      'https://www.adzuna.co.uk/sitemap.xml',
      'https://uk.indeed.com/sitemap.xml'
    ],
    priority: 'high'
  },
  {
    id: 'university-job-boards',
    name: 'University Job Boards (Daily)',
    sources: [
      'gradcracker',
      'joblift',
      'savethestudent',
      'jobsacuk',
      'studentcircus',
      'gradsmart',
      'high-volume:targetjobs',
      'high-volume:prospects',
      'https://www.graduatejobs.com/sitemap.xml',
      'https://www.milkround.com/sitemap.xml',
      'https://www.ratemyplacement.co.uk/sitemap.xml',
      'https://www.studentjob.co.uk/sitemap.xml',
      'https://www.graduate-jobs.com/sitemap.xml'
    ],
    priority: 'high'
  },
  {
    id: 'engineering-week1',
    name: 'Engineering & Construction (Week 1)',
    sources: ['arup', 'atkins', 'wsp', 'aecom', 'mott-macdonald', 'jacobs', 'balfour-beatty', 'costain', 'skanska-uk', 'laing-orourke', 'ramboll', 'stantec-uk', 'buro-happold', 'hoare-lea', 'sweco'],
    priority: 'medium'
  },
  {
    id: 'engineering-week2',
    name: 'Engineering & Construction (Week 2)',
    sources: ['mace', 'kier', 'galliford-try', 'interserve', 'carillion', 'amey', 'serco', 'capita', 'mitie', 'g4s', 'sodexo', 'compass', 'elior', 'aramex', 'dhl', 'fedex', 'ups', 'royal-mail', 'parcelforce', 'hermes', 'yodel', 'dpd'],
    priority: 'medium'
  },
  {
    id: 'tech-week3',
    name: 'Technology (Week 3)',
    sources: ['google-london', 'microsoft-uk', 'amazon-uk', 'bloomberg-london', 'deepmind', 'facebook-london', 'apple-uk', 'netflix-uk', 'spotify-uk', 'uber-uk', 'airbnb-uk', 'booking-uk', 'arm', 'nvidia-uk', 'intel-uk', 'amd-uk', 'qualcomm-uk', 'broadcom-uk', 'marvell-uk', 'xilinx-uk', 'altera-uk'],
    priority: 'medium'
  },
  {
    id: 'tech-week4',
    name: 'Technology (Week 4)',
    sources: ['synopsys-uk', 'cadence-uk', 'mentor-graphics-uk', 'ansys-uk', 'dassault-uk', 'autodesk-uk', 'adobe-uk', 'salesforce-uk', 'oracle-uk', 'ibm-uk', 'hp-uk', 'dell-uk', 'cisco-uk', 'juniper-uk', 'arista-uk', 'palo-alto-uk', 'fortinet-uk', 'checkpoint-uk', 'symantec-uk', 'mcafee-uk', 'trend-micro-uk'],
    priority: 'medium'
  },
  {
    id: 'finance-week5',
    name: 'Finance (Week 5)',
    sources: ['goldman-sachs-london', 'jpmorgan-london', 'barclays', 'hsbc', 'lloyds', 'natwest', 'standard-chartered', 'santander-uk', 'rbs', 'tsb', 'virgin-money', 'first-direct', 'halifax', 'schroders', 'man-group', 'brevan-howard', 'marshall-wace', 'citadel', 'point72', 'millennium', 'balyasny', 'exodus-point'],
    priority: 'medium'
  },
  {
    id: 'consulting-week6',
    name: 'Consulting (Week 6)',
    sources: ['deloitte-uk', 'pwc-uk', 'kpmg-uk', 'ey-uk', 'accenture-uk', 'mckinsey-uk', 'bain-uk', 'bcg-uk', 'oliver-wyman-uk', 'kearney-uk', 'roland-berger-uk', 'at-kearney-uk', 'strategy-uk', 'monitor-uk', 'parthenon-uk', 'le-katz-uk', 'booz-allen-uk'],
    priority: 'medium'
  },
  {
    id: 'manufacturing-week7',
    name: 'Manufacturing & Aerospace (Week 7)',
    sources: ['rolls-royce', 'bae-systems', 'dyson', 'jaguar-land-rover', 'airbus-uk', 'gkn', 'mbda', 'siemens-uk', 'schneider-electric-uk', 'bombardier-uk', 'leonardo-uk', 'thales-uk', 'saab-uk', 'lockheed-martin-uk', 'boeing-uk', 'northrop-grumman-uk', 'raytheon-uk', 'general-dynamics-uk', 'l3harris-uk'],
    priority: 'medium'
  },
  {
    id: 'energy-week8',
    name: 'Energy & Utilities (Week 8)',
    sources: ['national-grid', 'sse', 'edf-uk', 'octopus-energy', 'shell-uk', 'bp-uk', 'centrica', 'e-on-uk', 'npower', 'scottish-power', 'british-gas', 'eon-uk', 'rwe-uk', 'vattenfall-uk', 'statkraft-uk', 'orkla-uk', 'equinor-uk', 'total-uk', 'chevron-uk', 'exxonmobil-uk'],
    priority: 'medium'
  },
  {
    id: 'specialized-boards',
    name: 'Specialized Job Boards (Every 4 days)',
    sources: ['engineering-jobs', 'tech-jobs', 'finance-jobs', 'consulting-jobs', 'university-boards'],
    priority: 'low'
  }
];

// Get current day of month (1-31)
export function getCurrentDayOfMonth(): number {
  return new Date().getDate();
}

// Get current week of month (1-5)
export function getCurrentWeekOfMonth(): number {
  const now = new Date();
  const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
  const pastDaysOfMonth = now.getDate() - 1;
  return Math.ceil((pastDaysOfMonth + firstDay.getDay() + 1) / 7);
}

// Check if we're in test mode (limits to 1 URL per source)
export function isTestMode(): boolean {
  return process.env.TEST_MODE === 'true' || 
         process.env.INGEST_MODE === 'focused-test' || 
         process.env.CRAWL_TYPE === 'focused-test';
}

// Get buckets for focused test mode (only 1 source per category for quick testing)
export function getBucketsForFocusedTestMode(): CrawlBucket[] {
  const buckets: CrawlBucket[] = [];
  
  // ATS Platforms - only 1 company per platform
  const atsSources: string[] = [];
  if (GREENHOUSE_BOARDS.length > 0) {
    atsSources.push(`greenhouse:${GREENHOUSE_BOARDS[0]}`); // First Greenhouse board
  }
  if (LEVER_COMPANIES.length > 0) {
    atsSources.push(`lever:${LEVER_COMPANIES[0]}`); // First Lever company
  }
  if (WORKABLE_COMPANIES.length > 0) {
    atsSources.push(`workable:${WORKABLE_COMPANIES[0]}`); // First Workable company
  }
  if (ASHBY_COMPANIES.length > 0) {
    atsSources.push(`ashby:${ASHBY_COMPANIES[0]}`); // First Ashby company
  }
  if (TEAMTAILOR_COMPANIES.length > 0) {
    atsSources.push(`teamtailor:${TEAMTAILOR_COMPANIES[0]}`); // First Teamtailor company
  }
  
  if (atsSources.length > 0) {
    buckets.push({
      id: 'ats-platforms-focused-test',
      name: 'ATS Platforms (Test Mode - 1 per platform)',
      sources: atsSources,
      priority: 'high'
    });
  }
  
  // RSS Feeds and Bulk Sitemaps - only 1 of each
  buckets.push({
    id: 'feeds-and-sitemaps-focused-test',
    name: 'RSS Feeds & Bulk Sitemaps (Test Mode)',
    sources: ['rss-feeds', 'bulk-sitemaps'],
    priority: 'high'
  });
  
  // Graduate Job Boards - include all for testing (1 URL per source in test mode)
  buckets.push({
    id: 'graduate-boards-focused-test',
    name: 'Graduate Job Boards (Test Mode - 1 URL per board)',
    sources: [
      'targetjobs',
      'prospects',
      'brightnetwork',
      'ratemyplacement',
      'trackr',
      'milkround',
      'gradcracker'
    ],
    priority: 'high'
  });
  
  // TargetConnect and JobTeaser Feeds only
  buckets.push({
    id: 'university-feeds-focused-test',
    name: 'University Feeds (Test Mode)',
    sources: ['university-feeds-only'],
    priority: 'high'
  });
  
  return buckets;
}

// Get buckets for focused mode (only specific sources)
export function getBucketsForFocusedMode(): CrawlBucket[] {
  const buckets: CrawlBucket[] = [];
  
  // ATS Platforms
  const atsSources: string[] = [];
  GREENHOUSE_BOARDS.forEach((board: string) => {
    atsSources.push(`greenhouse:${board}`);
  });
  LEVER_COMPANIES.forEach((company: string) => {
    atsSources.push(`lever:${company}`);
  });
  WORKABLE_COMPANIES.forEach((company: string) => {
    atsSources.push(`workable:${company}`);
  });
  ASHBY_COMPANIES.forEach((company: string) => {
    atsSources.push(`ashby:${company}`);
  });
  TEAMTAILOR_COMPANIES.forEach((company: string) => {
    atsSources.push(`teamtailor:${company}`);
  });
  
  if (atsSources.length > 0) {
    buckets.push({
      id: 'ats-platforms-focused',
      name: 'ATS Platforms (Focused Mode)',
      sources: atsSources,
      priority: 'high'
    });
  }
  
  // RSS Feeds and Bulk Sitemaps
  buckets.push({
    id: 'feeds-and-sitemaps-focused',
    name: 'RSS Feeds & Bulk Sitemaps (Focused Mode)',
    sources: ['rss-feeds', 'bulk-sitemaps'],
    priority: 'high'
  });
  
  // Graduate Job Boards (partially working)
  buckets.push({
    id: 'graduate-boards-focused',
    name: 'Graduate Job Boards (Focused Mode)',
    sources: [
      'targetjobs',
      'prospects',
      'brightnetwork',
      'ratemyplacement',
      'trackr',
      'milkround',
      'gradcracker'
    ],
    priority: 'high'
  });
  
  // TargetConnect and JobTeaser Feeds only
  buckets.push({
    id: 'university-feeds-focused',
    name: 'University Feeds (Focused Mode)',
    sources: ['university-feeds-only'], // Only TargetConnect and JobTeaser
    priority: 'high'
  });
  
  return buckets;
}

// Get buckets to crawl today - FOCUSED ON HIGH VOLUME JOB BOARDS
export function getBucketsForToday(): CrawlBucket[] {
  // Check if test mode is enabled (limits to 1 URL per source)
  if (isTestMode()) {
    return getBucketsForFocusedTestMode();
  }
  
  // Check if focused mode is enabled (support both INGEST_MODE and CRAWL_TYPE for GitHub Actions)
  const ingestMode = process.env.INGEST_MODE || (process.env.CRAWL_TYPE === 'focused' ? 'focused' : 'full');
  if (ingestMode === 'focused') {
    return getBucketsForFocusedMode();
  }
  
  const dayOfMonth = getCurrentDayOfMonth();
  const weekOfMonth = getCurrentWeekOfMonth();
  const dayOfWeek = new Date().getDay();
  
  const buckets: CrawlBucket[] = [];
  
  // PRIORITY 1: API-based job boards (most reliable, highest volume, no blocking)
  // Target: LinkedIn (10K/month) + JSearch (200K/month MEGA PLAN) = 210K jobs/month
  // JSearch runs MULTIPLE TIMES PER DAY to maximize 200K/month quota
  // Rate limit: 20 requests/second = 72,000 requests/hour
  // Target: 200,000 jobs/month = ~6,667 jobs/day = ~278 jobs/hour
  // We'll run JSearch 3-4 times per day (morning, afternoon, evening, night)
  buckets.push({
    id: 'api-job-boards',
    name: 'API Job Boards (Highest Priority - Multiple Daily Runs)',
    sources: [
      // API-based scrapers - these should yield 6000+ jobs/day
      // LinkedIn API: 10,000/month = ~333/day (with pagination: up to 1000/day)
      // JSearch API: 200,000/month = ~6,667/day (with pagination: up to 8000/day)
      'rapidapi-linkedin-jobs', // RapidAPI + LinkedIn Jobs APIs (runs first)
      'api-job-boards', // Other API boards
      'rss-feeds', // RSS/Atom feed scraping (high volume, low blocking)
      'bulk-sitemaps' // Bulk sitemap processing (processes all listed sitemaps)
    ],
    priority: 'high'
  });
  
  // PRIORITY 1B: JSearch additional runs (runs multiple times per day)
  // Run JSearch 3-4 times per day to maximize 200K/month quota
  // Each run does 500 searches = 25,000 jobs potential (with 5 pages × 10 jobs/page)
  // 4 runs/day × 500 searches = 2,000 searches/day = 100,000 jobs/day potential
  // This ensures we hit the 200K/month quota
  const hourOfDay = new Date().getHours();
  // Run JSearch at: 6am, 12pm, 6pm, 12am (4 times per day)
  const jsearchRunTimes = [6, 12, 18, 0];
  if (jsearchRunTimes.includes(hourOfDay) || hourOfDay % 6 === 0) {
    buckets.push({
      id: 'jsearch-additional-runs',
      name: 'JSearch Additional Run (Multiple Daily - Mega Plan)',
      sources: ['rapidapi-linkedin-jobs'], // JSearch is part of rapidapi-linkedin-jobs
      priority: 'high'
    });
  }
  
  // PRIORITY 2: Graduate-focused job boards (using hybrid multi-strategy approach)
  buckets.push({
    id: 'graduate-job-boards',
    name: 'Graduate Job Boards (High Priority - Hybrid)',
    sources: [
      'hybrid-graduate-boards', // Hybrid multi-strategy scraping
      'direct-graduate-boards', // Direct aggressive scraping fallback
      'gradcracker', 
      'targetjobs',
      'prospects',
      'milkround',
      'brightnetwork',
      'ratemyplacement',
      'trackr'
    ],
    priority: 'high'
  });
  
  // PRIORITY 3: All ATS platforms - process all companies to get 500+ jobs per source
  const atsSources: string[] = [];
  // Add all Greenhouse companies
  GREENHOUSE_BOARDS.forEach((board: string) => {
    atsSources.push(`greenhouse:${board}`);
  });
  // Add all Lever companies
  LEVER_COMPANIES.forEach((company: string) => {
    atsSources.push(`lever:${company}`);
  });
  // Add all Workable companies
  WORKABLE_COMPANIES.forEach((company: string) => {
    atsSources.push(`workable:${company}`);
  });
  // Add all Ashby companies
  ASHBY_COMPANIES.forEach((company: string) => {
    atsSources.push(`ashby:${company}`);
  });
  // Add all Teamtailor companies
  TEAMTAILOR_COMPANIES.forEach((company: string) => {
    atsSources.push(`teamtailor:${company}`);
  });
  
  if (atsSources.length > 0) {
    buckets.push({
      id: 'ats-platforms',
      name: 'ATS Platforms - All Companies (High Priority)',
      sources: atsSources,
      priority: 'high'
    });
  }
  
  // PRIORITY 4: Rotate through company career pages (one sector per day)
  const sectorRotation = weekOfMonth % 5;
  let companySources: string[] = [];
  let sectorName = '';
  
  switch (sectorRotation) {
    case 0: // Engineering
      companySources = ['arup', 'atkins', 'wsp', 'aecom', 'mott-macdonald', 'jacobs', 'balfour-beatty'];
      sectorName = 'Engineering';
      break;
    case 1: // Tech
      companySources = ['arm', 'nvidia-uk', 'intel-uk', 'adobe-uk', 'salesforce-uk', 'oracle-uk'];
      sectorName = 'Technology';
      break;
    case 2: // Finance
      companySources = ['goldman-sachs-london', 'jpmorgan-london', 'barclays', 'hsbc', 'schroders'];
      sectorName = 'Finance';
      break;
    case 3: // Consulting
      companySources = ['deloitte-uk', 'pwc-uk', 'kpmg-uk', 'ey-uk', 'accenture-uk'];
      sectorName = 'Consulting';
      break;
    case 4: // Manufacturing
      companySources = ['rolls-royce', 'bae-systems', 'dyson', 'jaguar-land-rover', 'airbus-uk'];
      sectorName = 'Manufacturing';
      break;
  }
  
  buckets.push({
    id: `company-rotation-${sectorName.toLowerCase()}`,
    name: `${sectorName} Companies (Low Priority)`,
    sources: companySources,
    priority: 'low'
  });
  
  // PRIORITY 5: Finance & Bank Career Sites (Weekly - runs on Sunday)
  // These sites are scraped once per week due to their size and complexity
  if (dayOfWeek === 0) { // Sunday (0 = Sunday, 6 = Saturday)
    buckets.push({
      id: 'finance-bank-careers',
      name: 'Finance & Bank Career Sites (Weekly - Sunday)',
      sources: ['finance-bank-careers'],
      priority: 'medium'
    });
  }
  
  return buckets;
}

// Check if a URL should be crawled based on freshness
export function shouldCrawlUrl(url: string, crawlLog: CrawlLog | null, maxAgeHours: number = 24): boolean {
  if (!crawlLog) return true; // Never crawled before
  
  const now = new Date();
  const lastCrawled = new Date(crawlLog.lastSeen);
  const ageHours = (now.getTime() - lastCrawled.getTime()) / (1000 * 60 * 60);
  
  // Always crawl if it's been too long
  if (ageHours > maxAgeHours) return true;
  
  // Skip if last crawl was successful and recent
  if (crawlLog.status === 'success' && ageHours < maxAgeHours) return false;
  
  // Always retry if last crawl failed
  if (crawlLog.status === 'error') return true;
  
  return false;
}

// Calculate priority score for URL ordering
export function calculateUrlPriority(url: string, crawlLog: CrawlLog | null): number {
  let score = 0;
  
  // Base score by source type
  if (url.includes('greenhouse.io') || url.includes('lever.co')) score += 100;
  else if (url.includes('workday') || url.includes('successfactors')) score += 90;
  else if (url.includes('reed.co.uk') || url.includes('totaljobs.com')) score += 80;
  else if (url.includes('arup.com') || url.includes('atkinsglobal.com')) score += 70;
  else score += 50;
  
  // Boost for never-crawled URLs
  if (!crawlLog) score += 50;
  
  // Boost for failed crawls (retry priority)
  if (crawlLog?.status === 'error') score += 30;
  
  // Boost for URLs with recent changes
  if (crawlLog?.lastModified) {
    const daysSinceModified = (Date.now() - new Date(crawlLog.lastModified).getTime()) / (1000 * 60 * 60 * 24);
    if (daysSinceModified < 7) score += 20;
  }
  
  // Penalty for recently successful crawls
  if (crawlLog?.status === 'success') {
    const hoursSinceCrawl = (Date.now() - new Date(crawlLog.lastSeen).getTime()) / (1000 * 60 * 60);
    if (hoursSinceCrawl < 12) score -= 30;
  }
  
  return Math.max(0, score);
}

// Get crawl schedule for the week
export function getWeeklySchedule(): { [key: string]: CrawlBucket[] } {
  const schedule: { [key: string]: CrawlBucket[] } = {};
  
  for (let day = 1; day <= 7; day++) {
    const buckets = getBucketsForDay(day);
    schedule[`day-${day}`] = buckets;
  }
  
  return schedule;
}

function getBucketsForDay(dayOfWeek: number): CrawlBucket[] {
  const buckets: CrawlBucket[] = [];
  
  // Always include ATS platforms
  buckets.push(CRAWL_BUCKETS.find(b => b.id === 'ats-daily')!);
  
  // Add job boards on specific days
  if (dayOfWeek % 2 === 1) { // Odd days
    buckets.push(CRAWL_BUCKETS.find(b => b.id === 'job-boards')!);
  }
  
  // Add one company bucket per day
  const companyBuckets = CRAWL_BUCKETS.filter(b => 
    b.id.startsWith('engineering') || 
    b.id.startsWith('manufacturing') || 
    b.id.startsWith('tech-finance') || 
    b.id.startsWith('consulting')
  );
  
  const bucketIndex = (dayOfWeek - 1) % companyBuckets.length;
  buckets.push(companyBuckets[bucketIndex]);
  
  return buckets;
}

// Rate limiting based on domain
export function getRateLimitForDomain(domain: string): { requestsPerMinute: number; delayMs: number } {
  // Be more aggressive with ATS platforms (they're designed for it)
  if (domain.includes('greenhouse.io') || domain.includes('lever.co')) {
    return { requestsPerMinute: 60, delayMs: 1000 };
  }
  
  // Moderate rate for job boards
  if (domain.includes('reed.co.uk') || domain.includes('totaljobs.com') || domain.includes('monster.co.uk')) {
    return { requestsPerMinute: 30, delayMs: 2000 };
  }
  
  // Conservative rate for company sites
  return { requestsPerMinute: 20, delayMs: 3000 };
}
