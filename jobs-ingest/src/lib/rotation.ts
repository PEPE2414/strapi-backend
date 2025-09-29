// Rotation and freshness management for job scraping

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

// Define source buckets for rotation
export const CRAWL_BUCKETS: CrawlBucket[] = [
  {
    id: 'ats-daily',
    name: 'ATS Platforms (Daily)',
    sources: ['greenhouse', 'lever', 'workday', 'successfactors', 'icims'],
    priority: 'high'
  },
  {
    id: 'job-boards',
    name: 'Job Boards (Every 3 days)',
    sources: ['reed', 'totaljobs', 'monster', 'gradcracker', 'prospects', 'targetjobs'],
    priority: 'high'
  },
  {
    id: 'engineering-week1',
    name: 'Engineering Companies (Week 1)',
    sources: ['arup', 'atkins', 'wsp', 'aecom', 'mott-macdonald', 'jacobs', 'balfour-beatty', 'costain'],
    priority: 'medium'
  },
  {
    id: 'engineering-week2',
    name: 'Engineering Companies (Week 2)',
    sources: ['skanska-uk', 'laing-orourke', 'ramboll', 'stantec-uk', 'buro-happold', 'hoare-lea', 'sweco', 'ayesa-uk'],
    priority: 'medium'
  },
  {
    id: 'manufacturing-week3',
    name: 'Manufacturing & Aerospace (Week 3)',
    sources: ['rolls-royce', 'bae-systems', 'dyson', 'jaguar-land-rover', 'airbus-uk', 'gkn', 'mbda', 'siemens-uk', 'schneider-electric-uk'],
    priority: 'medium'
  },
  {
    id: 'tech-finance-week4',
    name: 'Tech & Finance (Week 4)',
    sources: ['national-grid', 'sse', 'edf-uk', 'octopus-energy', 'shell-uk', 'bp-uk', 'google-london', 'microsoft-uk', 'amazon-uk', 'bloomberg-london', 'deepmind'],
    priority: 'medium'
  },
  {
    id: 'consulting-public-week5',
    name: 'Consulting & Public Sector (Week 5)',
    sources: ['goldman-sachs-london', 'jpmorgan-london', 'barclays', 'hsbc', 'lloyds', 'natwest', 'deloitte-uk', 'pwc-uk', 'kpmg-uk', 'ey-uk', 'civil-service', 'network-rail', 'tfl', 'hs2'],
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

// Get buckets to crawl today
export function getBucketsForToday(): CrawlBucket[] {
  const dayOfMonth = getCurrentDayOfMonth();
  const weekOfMonth = getCurrentWeekOfMonth();
  
  const buckets: CrawlBucket[] = [];
  
  // Always crawl ATS platforms daily
  buckets.push(CRAWL_BUCKETS.find(b => b.id === 'ats-daily')!);
  
  // Crawl job boards every 3 days
  if (dayOfMonth % 3 === 1) {
    buckets.push(CRAWL_BUCKETS.find(b => b.id === 'job-boards')!);
  }
  
  // Rotate through company buckets weekly
  const companyBuckets = CRAWL_BUCKETS.filter(b => b.id.startsWith('engineering') || b.id.startsWith('manufacturing') || b.id.startsWith('tech-finance') || b.id.startsWith('consulting'));
  const bucketIndex = (weekOfMonth - 1) % companyBuckets.length;
  buckets.push(companyBuckets[bucketIndex]);
  
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

// Smart early exit logic
export function shouldExitEarly(
  totalJobsFound: number,
  startTime: Date,
  maxRuntimeMinutes: number = 30,
  minJobsThreshold: number = 100
): boolean {
  const runtimeMinutes = (Date.now() - startTime.getTime()) / (1000 * 60);
  
  // Exit if we've been running too long
  if (runtimeMinutes > maxRuntimeMinutes) {
    console.log(`⏰ Runtime limit reached (${maxRuntimeMinutes} minutes), exiting early`);
    return true;
  }
  
  // Exit if we have enough jobs and it's been a reasonable time
  if (totalJobsFound >= minJobsThreshold && runtimeMinutes > 10) {
    console.log(`✅ Found ${totalJobsFound} jobs in ${runtimeMinutes.toFixed(1)} minutes, exiting early`);
    return true;
  }
  
  return false;
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
