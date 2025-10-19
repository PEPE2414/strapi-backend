import * as cheerio from 'cheerio';
import { CanonicalJob } from '../types';
import { makeUniqueSlug } from './slug';
import { extractDeadlineFromJobCard } from './deadlineExtractor';

/**
 * Specialized job extractor for graduate job boards
 * Uses multiple strategies to find jobs even when selectors fail
 */
export function extractGraduateJobs($: cheerio.CheerioAPI, boardName: string, boardKey: string): CanonicalJob[] {
  const jobs: CanonicalJob[] = [];
  
  console.log(`🔍 Extracting jobs from ${boardName}...`);
  
  // Strategy 1: Try comprehensive job selectors
  const jobSelectors = [
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
    '[data-opportunity]', '[data-career]', '[data-employment]',
    
    // Generic content patterns
    '.content', '.main', '.primary', '.secondary', '.sidebar',
    '[class*="content"]', '[class*="main"]', '[class*="primary"]'
  ];
  
  let jobCards: cheerio.Cheerio<any> | null = null;
  let usedSelector = '';
  
  // Try each selector until we find job cards
  for (const selector of jobSelectors) {
    const elements = $(selector);
    if (elements.length > 0) {
      console.log(`  📦 Found ${elements.length} elements with: ${selector}`);
      jobCards = elements;
      usedSelector = selector;
      break;
    }
  }
  
  if (!jobCards || jobCards.length === 0) {
    console.warn(`  ⚠️  No job cards found with standard selectors, trying fallback...`);
    return extractJobsFallback($, boardName, boardKey);
  }
  
  console.log(`  ✅ Using selector: ${usedSelector} (${jobCards.length} elements)`);
  
  // Extract jobs from found elements
  jobCards.each((index, element) => {
    try {
      const $card = $(element);
      const job = extractJobFromCard($card, boardName, boardKey, index);
      if (job) {
        jobs.push(job);
      }
    } catch (error) {
      console.warn(`  ⚠️  Error extracting job ${index}:`, error instanceof Error ? error.message : String(error));
    }
  });
  
  console.log(`  📊 Extracted ${jobs.length} jobs from ${jobCards.length} elements`);
  return jobs;
}

/**
 * Extract job data from a single card element
 */
function extractJobFromCard($card: cheerio.Cheerio<any>, boardName: string, boardKey: string, index: number): CanonicalJob | null {
  // Try multiple title selectors
  const titleSelectors = [
    'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
    '.title', '.job-title', '.position-title', '.role-title',
    '[class*="title"]', '[class*="Title"]', '[class*="TITLE"]',
    '.name', '.job-name', '.position-name', '.role-name',
    '[class*="name"]', '[class*="Name"]', '[class*="NAME"]',
    'a', '.link', '[class*="link"]', '[class*="Link"]',
    '.heading', '[class*="heading"]', '[class*="Heading"]'
  ];
  
  let title = '';
  for (const selector of titleSelectors) {
    const titleElement = $card.find(selector).first();
    if (titleElement.length > 0) {
      title = titleElement.text().trim();
      if (title && title.length > 3) {
        break;
      }
    }
  }
  
  // Fallback: use the card's own text if no title found
  if (!title) {
    title = $card.text().trim().split('\n')[0].trim();
  }
  
  if (!title || title.length < 3) {
    return null;
  }
  
  // Try multiple company selectors
  const companySelectors = [
    '.company', '.employer', '.organization', '.firm',
    '[class*="company"]', '[class*="employer"]', '[class*="organization"]',
    '[class*="firm"]', '[class*="Company"]', '[class*="Employer"]',
    '.brand', '.logo', '[class*="brand"]', '[class*="logo"]'
  ];
  
  let company = '';
  for (const selector of companySelectors) {
    const companyElement = $card.find(selector).first();
    if (companyElement.length > 0) {
      company = companyElement.text().trim();
      if (company && company.length > 1) {
        break;
      }
    }
  }
  
  // Try multiple location selectors
  const locationSelectors = [
    '.location', '.place', '.area', '.region',
    '[class*="location"]', '[class*="place"]', '[class*="area"]',
    '[class*="region"]', '[class*="Location"]', '[class*="Place"]',
    '.address', '[class*="address"]', '[class*="Address"]'
  ];
  
  let location = '';
  for (const selector of locationSelectors) {
    const locationElement = $card.find(selector).first();
    if (locationElement.length > 0) {
      location = locationElement.text().trim();
      if (location && location.length > 1) {
        break;
      }
    }
  }
  
  // Try multiple link selectors
  const linkSelectors = [
    'a[href]', '.link', '[class*="link"]', '[class*="Link"]',
    '.url', '[class*="url"]', '[class*="Url"]', '[class*="URL"]'
  ];
  
  let applyUrl = '';
  for (const selector of linkSelectors) {
    const linkElement = $card.find(selector).first();
    if (linkElement.length > 0) {
      const href = linkElement.attr('href');
      if (href) {
        applyUrl = href.startsWith('http') ? href : `https://${boardKey}.com${href}`;
        break;
      }
    }
  }
  
  // Try multiple description selectors
  const descriptionSelectors = [
    '.description', '.summary', '.details', '.content',
    '[class*="description"]', '[class*="summary"]', '[class*="details"]',
    '[class*="content"]', '[class*="Description"]', '[class*="Summary"]',
    '.text', '[class*="text"]', '[class*="Text"]', 'p'
  ];
  
  let description = '';
  for (const selector of descriptionSelectors) {
    const descElement = $card.find(selector).first();
    if (descElement.length > 0) {
      description = descElement.text().trim();
      if (description && description.length > 10) {
        break;
      }
    }
  }
  
  // Extract deadline
  const deadline = extractDeadlineFromJobCard($card);
  
  // Create job object
  const job: CanonicalJob = {
    title: title,
    company: { name: company || 'Unknown Company' },
    location: location || 'UK',
    applyUrl: applyUrl || `https://${boardKey}.com/job-${index}`,
    descriptionText: description || '',
    descriptionHtml: description || '',
    source: boardName,
    sourceUrl: `https://${boardKey}.com`,
    jobType: 'graduate', // Default to graduate for these boards
    salary: undefined,
    applyDeadline: deadline,
    slug: makeUniqueSlug(title, company, `job-${index}-${Date.now()}`),
    hash: `job-${index}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
  };
  
  return job;
}

/**
 * Fallback extraction when standard selectors fail
 */
function extractJobsFallback($: cheerio.CheerioAPI, boardName: string, boardKey: string): CanonicalJob[] {
  console.log(`  🔄 Trying fallback extraction...`);
  
  const jobs: CanonicalJob[] = [];
  
  // Strategy 1: Look for any text that might be job titles
  const jobKeywords = [
    'graduate', 'internship', 'placement', 'trainee', 'entry level',
    'junior', 'assistant', 'coordinator', 'analyst', 'engineer',
    'developer', 'consultant', 'advisor', 'specialist', 'officer'
  ];
  
  const allText = $('body').text().toLowerCase();
  const lines = allText.split('\n').map(line => line.trim()).filter(line => line.length > 10);
  
  let jobCount = 0;
  for (const line of lines) {
    if (jobKeywords.some(keyword => line.includes(keyword)) && line.length < 200) {
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
        slug: makeUniqueSlug(line, 'Unknown Company', `fallback-${jobCount}-${Date.now()}`),
        hash: `fallback-${jobCount}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
      };
      
      jobs.push(job);
      jobCount++;
      
      if (jobCount >= 20) break; // Limit fallback jobs
    }
  }
  
  console.log(`  📊 Fallback extracted ${jobs.length} jobs from text analysis`);
  return jobs;
}
