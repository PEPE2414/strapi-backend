import * as cheerio from 'cheerio';
import { CanonicalJob } from '../types';
import { makeUniqueSlug } from './slug';
import { extractDeadlineFromJobCard } from './deadlineExtractor';

/**
 * Debug and ultra-aggressive job extractor
 * This will try every possible method to find jobs and provide detailed logging
 */
export function debugExtractJobs($: cheerio.CheerioAPI, boardName: string, boardKey: string, url: string): CanonicalJob[] {
  const jobs: CanonicalJob[] = [];
  
  console.log(`🔍 DEBUG: Extracting jobs from ${boardName} (${url})`);
  console.log(`📊 DEBUG: Page has ${$.text().length} characters of text`);
  
  // Log page structure for debugging
  const pageStructure = analyzePageStructure($);
  console.log(`🏗️  DEBUG: Page structure analysis:`, pageStructure);
  
  // Strategy 1: Try all possible selectors with detailed logging
  const allSelectors = getAllPossibleSelectors();
  let foundWithSelectors = false;
  
  for (const selector of allSelectors) {
    const elements = $(selector);
    if (elements.length > 0) {
      console.log(`🎯 DEBUG: Found ${elements.length} elements with selector: ${selector}`);
      
      // Extract jobs from these elements
      const selectorJobs = extractJobsFromElements($, elements, boardName, boardKey, selector);
      if (selectorJobs.length > 0) {
        jobs.push(...selectorJobs);
        foundWithSelectors = true;
        console.log(`✅ DEBUG: Extracted ${selectorJobs.length} jobs with selector: ${selector}`);
      }
    }
  }
  
  if (foundWithSelectors) {
    console.log(`🎉 DEBUG: Found ${jobs.length} jobs using selectors`);
    return jobs;
  }
  
  // Strategy 2: Text-based extraction with detailed analysis
  console.log(`🔄 DEBUG: Selectors failed, trying text-based extraction...`);
  const textJobs = extractJobsFromText($, boardName, boardKey);
  if (textJobs.length > 0) {
    jobs.push(...textJobs);
    console.log(`✅ DEBUG: Found ${textJobs.length} jobs using text analysis`);
    return jobs;
  }
  
  // Strategy 3: Link-based extraction
  console.log(`🔄 DEBUG: Text extraction failed, trying link-based extraction...`);
  const linkJobs = extractJobsFromLinks($, boardName, boardKey);
  if (linkJobs.length > 0) {
    jobs.push(...linkJobs);
    console.log(`✅ DEBUG: Found ${linkJobs.length} jobs using link analysis`);
    return jobs;
  }
  
  // Strategy 4: Ultra-aggressive content analysis
  console.log(`🔄 DEBUG: All methods failed, trying ultra-aggressive extraction...`);
  const aggressiveJobs = ultraAggressiveExtraction($, boardName, boardKey);
  if (aggressiveJobs.length > 0) {
    jobs.push(...aggressiveJobs);
    console.log(`✅ DEBUG: Found ${aggressiveJobs.length} jobs using aggressive extraction`);
    return jobs;
  }
  
  console.log(`❌ DEBUG: All extraction methods failed for ${boardName}`);
  return jobs;
}

/**
 * Analyze page structure for debugging
 */
function analyzePageStructure($: cheerio.CheerioAPI): any {
  const structure = {
    totalElements: $('*').length,
    hasJobKeywords: false,
    hasLinks: $('a[href]').length,
    hasHeadings: $('h1, h2, h3, h4, h5, h6').length,
    hasArticles: $('article').length,
    hasDivs: $('div').length,
    hasLists: $('ul, ol, li').length,
    hasTables: $('table, tr, td').length,
    textLength: $.text().length,
    jobKeywords: [] as string[]
  };
  
  const jobKeywords = [
    'graduate', 'internship', 'placement', 'job', 'career', 'opportunity',
    'position', 'role', 'vacancy', 'employment', 'work', 'experience',
    'scheme', 'programme', 'program', 'trainee', 'entry level', 'junior'
  ];
  
  const pageText = $.text().toLowerCase();
  structure.jobKeywords = jobKeywords.filter(keyword => pageText.includes(keyword));
  structure.hasJobKeywords = structure.jobKeywords.length > 0;
  
  return structure;
}

/**
 * Get all possible selectors to try
 */
function getAllPossibleSelectors(): string[] {
  return [
    // Common job patterns
    '.job', '.job-card', '.job-listing', '.job-item', '.job-result', '.job-post',
    '.job-title', '.job-description', '.job-content', '.job-details',
    '[class*="job"]', '[class*="Job"]', '[class*="JOB"]',
    
    // Graduate specific
    '.graduate', '.graduate-job', '.graduate-role', '.graduate-position',
    '.graduate-opportunity', '.graduate-scheme', '.graduate-programme',
    '[class*="graduate"]', '[class*="Graduate"]', '[class*="GRADUATE"]',
    
    // Internship specific
    '.internship', '.intern', '.intern-role', '.intern-position',
    '[class*="intern"]', '[class*="Intern"]', '[class*="INTERN"]',
    
    // Placement specific
    '.placement', '.placement-role', '.placement-position',
    '[class*="placement"]', '[class*="Placement"]', '[class*="PLACEMENT"]',
    
    // Generic content
    'article', '.article', '.content', '.main', '.primary', '.secondary',
    '.result', '.search-result', '.listing', '.item', '.card', '.post',
    '.entry', '.box', '.tile', '.block', '.section',
    
    // Data attributes
    '[data-job]', '[data-role]', '[data-position]', '[data-vacancy]',
    '[data-opportunity]', '[data-career]', '[data-employment]',
    '[data-testid*="job"]', '[data-cy*="job"]', '[data-test*="job"]',
    
    // Table/list patterns
    'tr', 'td', 'li', '.row', '.item', '.entry',
    'tr[class*="job"]', 'td[class*="job"]', 'li[class*="job"]',
    
    // Link patterns
    'a[href*="job"]', 'a[href*="career"]', 'a[href*="opportunity"]',
    'a[href*="position"]', 'a[href*="role"]', 'a[href*="vacancy"]',
    'a[class*="job"]', 'a[class*="career"]', 'a[class*="opportunity"]',
    
    // Generic patterns
    '[class*="result"]', '[class*="listing"]', '[class*="item"]',
    '[class*="card"]', '[class*="post"]', '[class*="entry"]',
    '[class*="content"]', '[class*="main"]', '[class*="primary"]',
    
    // Very generic
    'div', 'span', 'p', 'section', 'header', 'main', 'aside'
  ];
}

/**
 * Extract jobs from specific elements
 */
function extractJobsFromElements(
  $: cheerio.CheerioAPI, 
  elements: cheerio.Cheerio<any>, 
  boardName: string, 
  boardKey: string, 
  selector: string
): CanonicalJob[] {
  const jobs: CanonicalJob[] = [];
  
  elements.each((index, element) => {
    try {
      const $element = $(element);
      const text = $element.text().trim();
      
      // Skip if too short or contains navigation text
      if (text.length < 10 || 
          text.includes('cookie') || 
          text.includes('privacy') || 
          text.includes('terms') ||
          text.includes('navigation') ||
          text.includes('menu')) {
        return;
      }
      
      // Extract job data
      const job = extractJobFromElement($element, boardName, boardKey, index, selector);
      if (job) {
        jobs.push(job);
        console.log(`  📝 DEBUG: Extracted job "${job.title}" from ${selector}`);
      }
    } catch (error) {
      console.warn(`  ⚠️  DEBUG: Error extracting from ${selector}:`, error);
    }
  });
  
  return jobs;
}

/**
 * Extract job from a single element
 */
function extractJobFromElement(
  $element: cheerio.Cheerio<any>, 
  boardName: string, 
  boardKey: string, 
  index: number, 
  selector: string
): CanonicalJob | null {
  const text = $element.text().trim();
  
  // Try to find title
  let title = '';
  const titleSelectors = ['h1', 'h2', 'h3', 'h4', 'h5', 'h6', '.title', '[class*="title"]', 'a'];
  for (const titleSel of titleSelectors) {
    const titleEl = $element.find(titleSel).first();
    if (titleEl.length > 0) {
      title = titleEl.text().trim();
      if (title && title.length > 3) break;
    }
  }
  
  // Fallback to first line of text
  if (!title) {
    title = text.split('\n')[0].trim();
  }
  
  if (!title || title.length < 3) {
    return null;
  }
  
  // Try to find company
  let company = '';
  const companySelectors = ['.company', '.employer', '.organization', '[class*="company"]', '[class*="employer"]'];
  for (const companySel of companySelectors) {
    const companyEl = $element.find(companySel).first();
    if (companyEl.length > 0) {
      company = companyEl.text().trim();
      if (company && company.length > 1) break;
    }
  }
  
  // Try to find location
  let location = '';
  const locationSelectors = ['.location', '.place', '.area', '[class*="location"]', '[class*="place"]'];
  for (const locationSel of locationSelectors) {
    const locationEl = $element.find(locationSel).first();
    if (locationEl.length > 0) {
      location = locationEl.text().trim();
      if (location && location.length > 1) break;
    }
  }
  
  // Try to find apply URL
  let applyUrl = '';
  const linkEl = $element.find('a[href]').first();
  if (linkEl.length > 0) {
    const href = linkEl.attr('href');
    if (href) {
      applyUrl = href.startsWith('http') ? href : `https://${boardKey}.com${href}`;
    }
  }
  
  // Extract deadline
  const deadline = extractDeadlineFromJobCard($element);
  
  const job: CanonicalJob = {
    title: title,
    company: { name: company || 'Unknown Company' },
    location: location || 'UK',
    applyUrl: applyUrl || `https://${boardKey}.com/job-${index}`,
    descriptionText: text.substring(0, 500),
    descriptionHtml: text.substring(0, 500),
    source: boardName,
    sourceUrl: `https://${boardKey}.com`,
    jobType: 'graduate',
    salary: undefined,
    applyDeadline: deadline,
    slug: makeUniqueSlug(title, company, `debug-${index}-${Date.now()}`),
    hash: `debug-${index}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
  };
  
  return job;
}

/**
 * Extract jobs from text analysis
 */
function extractJobsFromText($: cheerio.CheerioAPI, boardName: string, boardKey: string): CanonicalJob[] {
  const jobs: CanonicalJob[] = [];
  const jobKeywords = [
    'graduate', 'internship', 'placement', 'job', 'career', 'opportunity',
    'position', 'role', 'vacancy', 'employment', 'work', 'experience',
    'scheme', 'programme', 'program', 'trainee', 'entry level', 'junior'
  ];
  
  const allText = $.text();
  const lines = allText.split('\n').map(line => line.trim()).filter(line => 
    line.length > 10 && 
    line.length < 300 &&
    !line.includes('cookie') &&
    !line.includes('privacy') &&
    !line.includes('terms') &&
    !line.includes('navigation') &&
    !line.includes('menu')
  );
  
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
        sourceUrl: `https://${boardKey}.com`,
        jobType: 'graduate',
        salary: undefined,
        applyDeadline: undefined,
        slug: makeUniqueSlug(line, 'Unknown Company', `text-${jobCount}-${Date.now()}`),
        hash: `text-${jobCount}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
      };
      
      jobs.push(job);
      jobCount++;
      
      if (jobCount >= 50) break; // Limit text-based jobs
    }
  }
  
  return jobs;
}

/**
 * Extract jobs from links
 */
function extractJobsFromLinks($: cheerio.CheerioAPI, boardName: string, boardKey: string): CanonicalJob[] {
  const jobs: CanonicalJob[] = [];
  const jobKeywords = [
    'graduate', 'internship', 'placement', 'job', 'career', 'opportunity',
    'position', 'role', 'vacancy', 'employment', 'work', 'experience'
  ];
  
  const links = $('a[href]');
  let jobCount = 0;
  
  links.each((index, element) => {
    const $link = $(element);
    const text = $link.text().trim();
    const href = $link.attr('href');
    
    if (text && text.length > 5 && text.length < 200 && 
        jobKeywords.some(keyword => text.toLowerCase().includes(keyword))) {
      
      const job: CanonicalJob = {
        title: text,
        company: { name: 'Unknown Company' },
        location: 'UK',
        applyUrl: href ? (href.startsWith('http') ? href : `https://${boardKey}.com${href}`) : `https://${boardKey}.com/job-${jobCount}`,
        descriptionText: text,
        descriptionHtml: text,
        source: boardName,
        sourceUrl: `https://${boardKey}.com`,
        jobType: 'graduate',
        salary: undefined,
        applyDeadline: undefined,
        slug: makeUniqueSlug(text, 'Unknown Company', `link-${jobCount}-${Date.now()}`),
        hash: `link-${jobCount}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
      };
      
      jobs.push(job);
      jobCount++;
      
      if (jobCount >= 30) return false; // Break out of each loop
    }
  });
  
  return jobs;
}

/**
 * Ultra-aggressive extraction - last resort
 */
function ultraAggressiveExtraction($: cheerio.CheerioAPI, boardName: string, boardKey: string): CanonicalJob[] {
  const jobs: CanonicalJob[] = [];
  
  // Get all text and split into potential job phrases
  const allText = $.text();
  const words = allText.split(/\s+/);
  const jobPhrases: string[] = [];
  
  const jobKeywords = [
    'graduate', 'internship', 'placement', 'job', 'career', 'opportunity',
    'position', 'role', 'vacancy', 'employment', 'work', 'experience'
  ];
  
  // Look for job-related phrases
  for (let i = 0; i < words.length - 2; i++) {
    const phrase = words.slice(i, i + 3).join(' ').toLowerCase();
    if (jobKeywords.some(keyword => phrase.includes(keyword))) {
      const fullPhrase = words.slice(i, i + 5).join(' ').trim();
      if (fullPhrase.length > 20 && fullPhrase.length < 200) {
        jobPhrases.push(fullPhrase);
      }
    }
  }
  
  // Remove duplicates and create jobs
  const uniquePhrases = [...new Set(jobPhrases)];
  
  for (let i = 0; i < Math.min(uniquePhrases.length, 20); i++) {
    const phrase = uniquePhrases[i];
    if (phrase && phrase.length > 10) {
      const job: CanonicalJob = {
        title: phrase,
        company: { name: 'Unknown Company' },
        location: 'UK',
        applyUrl: `https://${boardKey}.com/job-${i}`,
        descriptionText: phrase,
        descriptionHtml: phrase,
        source: boardName,
        sourceUrl: `https://${boardKey}.com`,
        jobType: 'graduate',
        salary: undefined,
        applyDeadline: undefined,
        slug: makeUniqueSlug(phrase, 'Unknown Company', `aggressive-${i}-${Date.now()}`),
        hash: `aggressive-${i}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
      };
      
      jobs.push(job);
    }
  }
  
  return jobs;
}
