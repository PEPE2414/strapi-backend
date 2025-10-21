import * as cheerio from 'cheerio';
import { CanonicalJob } from '../types';
import { makeUniqueSlug } from './slug';
import { extractDeadlineFromJobCard } from './deadlineExtractor';
import { classifyJobType, isRelevantJobType, isUKJob } from './normalize';

/**
 * Aggressive job extraction for graduate job boards
 * Uses multiple strategies to extract as many jobs as possible
 */
export function aggressiveExtractJobs($: cheerio.CheerioAPI, boardName: string, boardKey: string, url: string): CanonicalJob[] {
  const jobs: CanonicalJob[] = [];
  console.log(`🚀 Aggressive job extraction from ${boardName} (${url})`);
  
  // Strategy 1: Try comprehensive selectors
  const comprehensiveJobs = extractWithComprehensiveSelectors($, boardName, boardKey, url);
  if (comprehensiveJobs.length > 0) {
    console.log(`✅ Comprehensive selectors found ${comprehensiveJobs.length} jobs`);
    return comprehensiveJobs;
  }
  
  // Strategy 2: Try text-based extraction
  const textJobs = extractFromText($, boardName, boardKey, url);
  if (textJobs.length > 0) {
    console.log(`✅ Text extraction found ${textJobs.length} jobs`);
    return textJobs;
  }
  
  // Strategy 3: Try link-based extraction
  const linkJobs = extractFromLinks($, boardName, boardKey, url);
  if (linkJobs.length > 0) {
    console.log(`✅ Link extraction found ${linkJobs.length} jobs`);
    return linkJobs;
  }
  
  // Strategy 4: Try aggressive phrase extraction
  const phraseJobs = extractFromPhrases($, boardName, boardKey, url);
  if (phraseJobs.length > 0) {
    console.log(`✅ Phrase extraction found ${phraseJobs.length} jobs`);
    return phraseJobs;
  }
  
  console.log(`⚠️  No jobs found with any extraction strategy`);
  return jobs;
}

/**
 * Extract jobs using comprehensive selectors
 */
function extractWithComprehensiveSelectors($: cheerio.CheerioAPI, boardName: string, boardKey: string, url: string): CanonicalJob[] {
  const jobs: CanonicalJob[] = [];
  
  // Ultra-comprehensive selectors
  const selectors = [
    // Common job card patterns
    '.job-card', '.job-listing', '.job-item', '.job-result', '.job-post', '.job',
    '[class*="JobCard"]', '[class*="job-card"]', '[class*="job-listing"]',
    '[class*="job-item"]', '[class*="job-result"]', '[class*="job-post"]',
    
    // Graduate-specific patterns
    '.graduate-job', '.graduate-role', '.graduate-position', '.graduate-opportunity',
    '[class*="graduate"]', '[class*="Graduate"]', '[class*="GRADUATE"]',
    
    // Internship patterns
    '.internship', '.intern-role', '.intern-position', '.intern-opportunity',
    '[class*="intern"]', '[class*="Intern"]', '[class*="INTERN"]',
    
    // Placement patterns
    '.placement', '.placement-role', '.placement-position', '.placement-opportunity',
    '[class*="placement"]', '[class*="Placement"]', '[class*="PLACEMENT"]',
    
    // Generic patterns
    'article', '.result', '.search-result', '.vacancy', '.position',
    '.opportunity', '.role', '.career', '.employment', '.opening',
    '[class*="result"]', '[class*="listing"]', '[class*="item"]',
    '[class*="card"]', '[class*="post"]', '[class*="entry"]',
    
    // Table/list patterns
    'tr', 'li', '.row', '.item', '.entry',
    
    // Link patterns
    'a[href*="job"]', 'a[href*="career"]', 'a[href*="opportunity"]',
    'a[href*="position"]', 'a[href*="role"]', 'a[href*="vacancy"]',
    
    // Data attribute patterns
    '[data-job]', '[data-role]', '[data-position]', '[data-vacancy]',
    '[data-opportunity]', '[data-career]', '[data-employment]'
  ];
  
  for (const selector of selectors) {
    const elements = $(selector);
    if (elements.length > 0) {
      console.log(`  📦 Found ${elements.length} elements with: ${selector}`);
      
      elements.each((index, element) => {
        try {
          const $element = $(element);
          const job = extractJobFromElement($element, boardName, boardKey, index);
          if (job && isRelevantJobType(job.title)) {
            jobs.push(job);
          }
        } catch (error) {
          console.warn(`  ⚠️  Error extracting job ${index}:`, error instanceof Error ? error.message : String(error));
        }
      });
      
      // If we found jobs, return them
      if (jobs.length > 0) {
        break;
      }
    }
  }
  
  return jobs;
}

/**
 * Extract jobs from text content
 */
function extractFromText($: cheerio.CheerioAPI, boardName: string, boardKey: string, url: string): CanonicalJob[] {
  const jobs: CanonicalJob[] = [];
  const text = $('body').text();
  const lines = text.split('\n').map(line => line.trim()).filter(line => line.length > 10);
  
  const jobKeywords = [
    'graduate', 'internship', 'placement', 'trainee', 'entry level',
    'junior', 'assistant', 'coordinator', 'analyst', 'developer',
    'engineer', 'consultant', 'manager', 'director', 'specialist'
  ];
  
  let jobCount = 0;
  for (const line of lines) {
    if (jobKeywords.some(keyword => line.toLowerCase().includes(keyword))) {
      const job: CanonicalJob = {
        title: line,
        company: { name: 'Unknown Company' },
        location: 'UK',
        applyUrl: `https://${boardKey}.com/job-${jobCount}`,
        descriptionText: line,
        descriptionHtml: line,
        source: boardName,
        sourceUrl: url,
        jobType: classifyJobType(line),
        salary: undefined,
        applyDeadline: undefined,
        slug: makeUniqueSlug(line, 'Unknown Company', `text-${jobCount}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`),
        hash: `text-${jobCount}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
      };
      
      if (isRelevantJobType(job.title)) {
        jobs.push(job);
        jobCount++;
      }
    }
  }
  
  return jobs;
}

/**
 * Extract jobs from links
 */
function extractFromLinks($: cheerio.CheerioAPI, boardName: string, boardKey: string, url: string): CanonicalJob[] {
  const jobs: CanonicalJob[] = [];
  const links = $('a[href]');
  
  let jobCount = 0;
  links.each((index, element) => {
    const $link = $(element);
    const href = $link.attr('href');
    const text = $link.text().trim();
    
    if (href && text && text.length > 5 && text.length < 200) {
      const job: CanonicalJob = {
        title: text,
        company: { name: 'Unknown Company' },
        location: 'UK',
        applyUrl: href.startsWith('http') ? href : `https://${boardKey}.com${href}`,
        descriptionText: text,
        descriptionHtml: text,
        source: boardName,
        sourceUrl: url,
        jobType: classifyJobType(text),
        salary: undefined,
        applyDeadline: undefined,
        slug: makeUniqueSlug(text, 'Unknown Company', `link-${jobCount}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`),
        hash: `link-${jobCount}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
      };
      
      if (isRelevantJobType(job.title)) {
        jobs.push(job);
        jobCount++;
      }
    }
  });
  
  return jobs;
}

/**
 * Extract jobs from phrases
 */
function extractFromPhrases($: cheerio.CheerioAPI, boardName: string, boardKey: string, url: string): CanonicalJob[] {
  const jobs: CanonicalJob[] = [];
  const text = $('body').text();
  
  const jobPhrases = [
    'graduate job', 'graduate role', 'graduate position', 'graduate opportunity',
    'internship', 'intern role', 'intern position', 'intern opportunity',
    'placement', 'placement role', 'placement position', 'placement opportunity',
    'trainee', 'trainee role', 'trainee position', 'trainee opportunity',
    'entry level', 'entry level role', 'entry level position', 'entry level opportunity',
    'junior', 'junior role', 'junior position', 'junior opportunity',
    'assistant', 'assistant role', 'assistant position', 'assistant opportunity',
    'coordinator', 'coordinator role', 'coordinator position', 'coordinator opportunity',
    'analyst', 'analyst role', 'analyst position', 'analyst opportunity',
    'developer', 'developer role', 'developer position', 'developer opportunity',
    'engineer', 'engineer role', 'engineer position', 'engineer opportunity',
    'consultant', 'consultant role', 'consultant position', 'consultant opportunity'
  ];
  
  let jobCount = 0;
  for (let i = 0; i < jobPhrases.length; i++) {
    const phrase = jobPhrases[i];
    if (text.toLowerCase().includes(phrase)) {
      const job: CanonicalJob = {
        title: phrase,
        company: { name: 'Unknown Company' },
        location: 'UK',
        applyUrl: `https://${boardKey}.com/job-${jobCount}`,
        descriptionText: phrase,
        descriptionHtml: phrase,
        source: boardName,
        sourceUrl: url,
        jobType: classifyJobType(phrase),
        salary: undefined,
        applyDeadline: undefined,
        slug: makeUniqueSlug(phrase, 'Unknown Company', `phrase-${jobCount}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`),
        hash: `phrase-${jobCount}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
      };
      
      if (isRelevantJobType(job.title)) {
        jobs.push(job);
        jobCount++;
      }
    }
  }
  
  return jobs;
}

/**
 * Extract job from a single element
 */
function extractJobFromElement($element: cheerio.Cheerio<any>, boardName: string, boardKey: string, index: number): CanonicalJob | null {
  const text = $element.text().trim();
  if (text.length < 5) return null;
  
  // Extract title (first line or first 100 chars)
  const title = text.split('\n')[0].trim().substring(0, 100);
  
  // Extract company (look for company patterns)
  const companyMatch = text.match(/(?:at|@|for)\s+([A-Z][a-zA-Z\s&]+)/);
  const company = companyMatch ? companyMatch[1].trim() : 'Unknown Company';
  
  // Extract location (look for location patterns)
  const locationMatch = text.match(/(?:in|at|based in)\s+([A-Z][a-zA-Z\s,]+)/);
  const location = locationMatch ? locationMatch[1].trim() : 'UK';
  
  // Extract apply URL
  const applyUrl = $element.find('a[href]').first().attr('href') || `https://${boardKey}.com/job-${index}`;
  
  // Extract deadline
  const deadline = extractDeadlineFromJobCard($element);
  
  const job: CanonicalJob = {
    title: title,
    company: { name: company },
    location: location,
    applyUrl: applyUrl.startsWith('http') ? applyUrl : `https://${boardKey}.com${applyUrl}`,
    descriptionText: text,
    descriptionHtml: $element.html() || text,
    source: boardName,
    sourceUrl: `https://${boardKey}.com`,
    jobType: classifyJobType(title),
    salary: undefined,
    applyDeadline: deadline,
    slug: makeUniqueSlug(title, company, `element-${index}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`),
    hash: `element-${index}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
  };
  
  return job;
}
