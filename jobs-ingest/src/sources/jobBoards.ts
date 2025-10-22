import { get } from '../lib/fetcher';
import { fetchWithCloudflareBypass, getBypassStatus } from '../lib/cloudflareBypass';
import { smartFetch } from '../lib/smartFetcher';
import { getWorkingUrls } from '../lib/urlDiscovery';
import { extractDeadlineFromJobCard } from '../lib/deadlineExtractor';
import { extractGraduateJobs } from '../lib/graduateJobExtractor';
import { debugExtractJobs } from '../lib/debugExtractor';
import { aggressiveExtractJobs } from '../lib/aggressiveJobExtractor';
import * as cheerio from 'cheerio';
import { extractJobPostingJSONLD } from '../lib/jsonld';
import { pickLogo } from '../lib/logo';
import { resolveApplyUrl } from '../lib/applyUrl';
import { CanonicalJob } from '../types';
import { makeUniqueSlug } from '../lib/slug';
import { sha256 } from '../lib/hash';
import { classifyJobType, parseSalary, toISO, isRelevantJobType, isUKJob } from '../lib/normalize';

// Job board configurations with MULTIPLE URL patterns
// The scraper will auto-discover which URLs actually work
const JOB_BOARDS = {
  'targetjobs': {
    name: 'TARGETjobs',
    baseUrl: 'https://targetjobs.co.uk',
    urlPatterns: [
      'https://targetjobs.co.uk/uk/en/search/offers',
      'https://targetjobs.co.uk/graduate-jobs',
      'https://targetjobs.co.uk/careers-advice/job-search',
      'https://targetjobs.co.uk/search',
      'https://targetjobs.co.uk/jobs',
      'https://targetjobs.co.uk/internships',
      'https://targetjobs.co.uk/placements',
      'https://targetjobs.co.uk/graduate-schemes',
      'https://targetjobs.co.uk/uk/en/search/internships',
      'https://targetjobs.co.uk/uk/en/search/placements'
    ]
  },
  'milkround': {
    name: 'Milkround',
    baseUrl: 'https://www.milkround.com',
    urlPatterns: [
      'https://www.milkround.com/jobs',
      'https://www.milkround.com/graduate-jobs',
      'https://www.milkround.com/jobs/search',
      'https://www.milkround.com/search',
      'https://www.milkround.com/internships',
      'https://www.milkround.com/placements',
      'https://www.milkround.com/graduate-schemes',
      'https://www.milkround.com/work-experience'
    ]
  },
  'prospects': {
    name: 'Prospects',
    baseUrl: 'https://www.prospects.ac.uk',
    urlPatterns: [
      'https://www.prospects.ac.uk/job-search',
      'https://www.prospects.ac.uk/graduate-jobs',
      'https://www.prospects.ac.uk/jobs-and-work-experience/job-search',
      'https://www.prospects.ac.uk/graduate-jobs-and-work-experience',
      'https://www.prospects.ac.uk/jobs',
      'https://www.prospects.ac.uk/internships',
      'https://www.prospects.ac.uk/placements',
      'https://www.prospects.ac.uk/work-experience',
      'https://www.prospects.ac.uk/graduate-schemes'
    ]
  },
  'ratemyplacement': {
    name: 'RateMyPlacement',
    baseUrl: 'https://www.ratemyplacement.co.uk',
    urlPatterns: [
      'https://www.ratemyplacement.co.uk/placements',
      'https://www.ratemyplacement.co.uk/jobs',
      'https://www.ratemyplacement.co.uk/search-jobs',
      'https://www.ratemyplacement.co.uk/placement-jobs',
      'https://www.ratemyplacement.co.uk/jobs/search',
      'https://www.ratemyplacement.co.uk/internships',
      'https://www.ratemyplacement.co.uk/graduate-jobs',
      'https://www.ratemyplacement.co.uk/work-experience'
    ]
  },
  'brightnetwork': {
    name: 'BrightNetwork',
    baseUrl: 'https://www.brightnetwork.co.uk',
    urlPatterns: [
      'https://www.brightnetwork.co.uk/jobs',
      'https://www.brightnetwork.co.uk/graduate-jobs',
      'https://www.brightnetwork.co.uk/graduate-jobs-search',
      'https://www.brightnetwork.co.uk/search',
      'https://www.brightnetwork.co.uk/career-path/graduate-jobs',
      'https://www.brightnetwork.co.uk/internships',
      'https://www.brightnetwork.co.uk/placements',
      'https://www.brightnetwork.co.uk/graduate-schemes',
      'https://www.brightnetwork.co.uk/work-experience'
    ]
  },
  'studentjob': {
    name: 'StudentJob UK',
    baseUrl: 'https://www.studentjob.co.uk',
    urlPatterns: [
      'https://www.studentjob.co.uk/graduate-jobs',
      'https://www.studentjob.co.uk/internships',
      'https://www.studentjob.co.uk/jobs'
    ]
  },
  'e4s': {
    name: 'Employment 4 Students',
    baseUrl: 'https://www.e4s.co.uk',
    urlPatterns: [
      'https://www.e4s.co.uk/graduate-jobs',
      'https://www.e4s.co.uk/internships',
      'https://www.e4s.co.uk/jobs'
    ]
  },
  'ratemyapprenticeship': {
    name: 'RateMyApprenticeship',
    baseUrl: 'https://www.ratemyapprenticeship.co.uk',
    urlPatterns: [
      'https://www.ratemyapprenticeship.co.uk/apprenticeships',
      'https://www.ratemyapprenticeship.co.uk/school-leaver-programmes',
      'https://www.ratemyapprenticeship.co.uk/jobs'
    ]
  },
  'workinstartups': {
    name: 'WorkInStartups',
    baseUrl: 'https://workinstartups.com',
    urlPatterns: [
      'https://workinstartups.com/job-board',
      'https://workinstartups.com/jobs',
      'https://workinstartups.com/graduate-jobs'
    ]
  },
  'totaljobs': {
    name: 'Totaljobs',
    baseUrl: 'https://www.totaljobs.com',
    urlPatterns: [
      'https://www.totaljobs.com/jobs/graduate',
      'https://www.totaljobs.com/jobs/internship',
      'https://www.totaljobs.com/graduate-jobs'
    ]
  },
  'reed': {
    name: 'Reed',
    baseUrl: 'https://www.reed.co.uk',
    urlPatterns: [
      'https://www.reed.co.uk/jobs/graduate-jobs',
      'https://www.reed.co.uk/jobs/internships',
      'https://www.reed.co.uk/graduate-jobs'
    ]
  },
  'escapethecity': {
    name: 'Escape the City',
    baseUrl: 'https://www.escapethecity.org',
    urlPatterns: [
      'https://www.escapethecity.org/jobs',
      'https://www.escapethecity.org/graduate-jobs',
      'https://www.escapethecity.org/opportunities'
    ]
  }
};

export async function scrapeJobBoard(boardKey: string): Promise<CanonicalJob[]> {
  console.log(`🚀 Starting job board scraper for: ${boardKey}`);
  console.log(`🛡️  ${getBypassStatus()}`);
  
  const board = JOB_BOARDS[boardKey as keyof typeof JOB_BOARDS];
  if (!board) {
    console.warn(`❌ Unknown job board: ${boardKey}`);
    return [];
  }

  console.log(`🔄 Scraping ${board.name}...`);
  const jobs: CanonicalJob[] = [];

  try {
    // AUTO-DISCOVER working URLs (tries multiple patterns, caches results)
    console.log(`🔍 Auto-discovering working URLs...`);
    const workingUrls = await getWorkingUrls(
      boardKey,
      board.urlPatterns,
      board.baseUrl
    );
    
    if (workingUrls.length === 0) {
      console.warn(`❌ No working URLs found for ${board.name} - all patterns failed`);
      return [];
    }
    
    console.log(`✅ Found ${workingUrls.length} working URLs for ${board.name}`);
    
    // Scrape each working URL
    for (const searchUrl of workingUrls.slice(0, 2)) {
      try {
        console.log(`🔄 Scraping: ${searchUrl}`);
        const searchJobs = await scrapeSearchPageDirect(searchUrl, board.name, boardKey);
        jobs.push(...searchJobs);
        console.log(`✅ Extracted ${searchJobs.length} jobs from this URL`);
        
        // Add delay between URLs
        await new Promise(resolve => setTimeout(resolve, 5000 + Math.random() * 3000));
        } catch (error) {
        console.warn(`Failed to scrape ${searchUrl}:`, error instanceof Error ? error.message : String(error));
      }
    }

    console.log(`✅ ${board.name}: Found ${jobs.length} total jobs`);
    return jobs;

  } catch (error) {
    console.warn(`Failed to scrape ${board.name}:`, error instanceof Error ? error.message : String(error));
    return [];
  }
}

/**
 * Extract jobs DIRECTLY from search page HTML (no individual page scraping)
 */
async function scrapeSearchPageDirect(url: string, boardName: string, boardKey: string): Promise<CanonicalJob[]> {
  try {
    const { html } = await smartFetch(url);
    const $ = cheerio.load(html);
    const jobs: CanonicalJob[] = [];

    console.log(`📊 Fetched ${html.length} chars, parsing...`);

    // Use aggressive extractor for maximum job discovery
    const aggressiveJobs = aggressiveExtractJobs($, boardName, boardKey, url);
    if (aggressiveJobs.length > 0) {
      console.log(`✅ Aggressive extractor found ${aggressiveJobs.length} jobs`);
      return aggressiveJobs;
    }
    
    console.log(`⚠️  Aggressive extractor found 0 jobs, trying debug extractor...`);
    
    // Fallback to debug extractor
    const debugJobs = debugExtractJobs($, boardName, boardKey, url);
    if (debugJobs.length > 0) {
      console.log(`✅ Debug extractor found ${debugJobs.length} jobs`);
      return debugJobs;
    }
    
    console.log(`⚠️  Debug extractor found 0 jobs, trying specialized graduate extractor...`);
    
    // Fallback to specialized graduate extractor
    const graduateJobs = extractGraduateJobs($, boardName, boardKey);
    if (graduateJobs.length > 0) {
      console.log(`✅ Graduate extractor found ${graduateJobs.length} jobs`);
      return graduateJobs;
    }
    
    console.log(`⚠️  All extractors found 0 jobs, trying fallback methods...`);

    // Try multiple job card selectors (ultra comprehensive)
    const jobSelectors = [
      // Common job card patterns
      '.job-card', '.job-listing', '.job-item', '.job-result', '.job-post', '.job',
      '[class*="JobCard"]', '[class*="job-card"]', '[class*="job-listing"]',
      '[class*="job-item"]', '[class*="job-result"]', '[class*="job-post"]',
      '[class*="job"]', '[class*="Job"]',
      
      // Article and result patterns
      'article[class*="job"]', 'article[class*="listing"]', 'article[class*="result"]',
      'article[class*="post"]', 'article[class*="item"]', 'article[class*="card"]',
      '.search-result', '.result', '.vacancy', '.position', '.opportunity',
      '.role', '.career', '.employment', '.listing', '.post', '.item', '.card',
      
      // Data attribute patterns (comprehensive)
      '[data-testid*="job"]', '[data-testid*="listing"]', '[data-testid*="result"]',
      '[data-testid*="post"]', '[data-testid*="item"]', '[data-testid*="card"]',
      '[data-cy*="job"]', '[data-cy*="listing"]', '[data-cy*="result"]',
      '[data-cy*="post"]', '[data-cy*="item"]', '[data-cy*="card"]',
      '[data-test*="job"]', '[data-test*="listing"]', '[data-test*="result"]',
      
      // Generic patterns
      'article', '.item', '.entry', '.post', '.content', '.card', '.box',
      '[class*="listing"]', '[class*="result"]', '[class*="vacancy"]',
      '[class*="position"]', '[class*="opportunity"]', '[class*="role"]',
      '[class*="career"]', '[class*="employment"]', '[class*="item"]',
      '[class*="entry"]', '[class*="post"]', '[class*="content"]',
      '[class*="card"]', '[class*="box"]', '[class*="tile"]',
      
      // Table row patterns (some sites use tables)
      'tr[class*="job"]', 'tr[class*="listing"]', 'tr[class*="result"]',
      'tr[class*="post"]', 'tr[class*="item"]', 'tr[class*="card"]',
      'td[class*="job"]', 'td[class*="listing"]', 'td[class*="result"]',
      'td[class*="post"]', 'td[class*="item"]', 'td[class*="card"]',
      
      // List item patterns
      'li[class*="job"]', 'li[class*="listing"]', 'li[class*="result"]',
      'li[class*="vacancy"]', 'li[class*="position"]', 'li[class*="opportunity"]',
      'li[class*="post"]', 'li[class*="item"]', 'li[class*="card"]',
      
      // Div patterns (very common)
      'div[class*="job"]', 'div[class*="listing"]', 'div[class*="result"]',
      'div[class*="post"]', 'div[class*="item"]', 'div[class*="card"]',
      'div[class*="vacancy"]', 'div[class*="position"]', 'div[class*="opportunity"]',
      
      // Section patterns
      'section[class*="job"]', 'section[class*="listing"]', 'section[class*="result"]',
      'section[class*="post"]', 'section[class*="item"]', 'section[class*="card"]',
      
      // Link patterns (jobs as links)
      'a[class*="job"]', 'a[class*="listing"]', 'a[class*="result"]',
      'a[class*="post"]', 'a[class*="item"]', 'a[class*="card"]',
      'a[href*="job"]', 'a[href*="career"]', 'a[href*="vacancy"]',
      
      // Specific to graduate job boards
      '.graduate-job', '.graduate-listing', '.graduate-result',
      '.internship', '.placement', '.scheme', '.programme',
      '[class*="graduate"]', '[class*="internship"]', '[class*="placement"]',
      '[class*="scheme"]', '[class*="programme"]'
    ];

    let $jobCards = $();
    let usedSelector = '';
    
    for (const selector of jobSelectors) {
      const found = $(selector);
      if (found.length > 0) {
        $jobCards = found;
        usedSelector = selector;
        console.log(`📦 Found ${found.length} elements with: ${selector}`);
        break;
      }
    }

    if ($jobCards.length === 0) {
      console.warn(`⚠️  No job cards found on ${url} - trying fallback extraction...`);
      
      // Fallback: try to extract any text that looks like job titles
      const allText = $.text();
      const lines = allText.split('\n').map(line => line.trim()).filter(line => line.length > 10);
      
      // Look for lines that might be job titles (contain job-related keywords)
      const jobKeywords = [
        'graduate', 'internship', 'placement', 'scheme', 'programme', 'program', 
        'trainee', 'entry level', 'junior', 'vacancy', 'position', 'role',
        'career', 'employment', 'opportunity', 'job', 'work', 'experience',
        'summer', 'winter', 'year in industry', 'industrial placement',
        'work placement', 'student placement', 'sandwich', 'co-op'
      ];
      const potentialJobs = lines.filter(line => 
        jobKeywords.some(keyword => line.toLowerCase().includes(keyword)) &&
        line.length > 15 && line.length < 300 &&
        !line.includes('cookie') && !line.includes('privacy') && 
        !line.includes('terms') && !line.includes('contact') &&
        !line.includes('about') && !line.includes('help')
      );
      
      console.log(`📋 Fallback: Found ${potentialJobs.length} potential job titles`);
      
      // Additional fallback: try to extract from links and headings
      const links = $('a[href]').map((i, el) => $(el).text().trim()).get();
      const headings = $('h1, h2, h3, h4, h5, h6').map((i, el) => $(el).text().trim()).get();
      
      const linkJobs = links.filter(link => 
        jobKeywords.some(keyword => link.toLowerCase().includes(keyword)) &&
        link.length > 15 && link.length < 200
      );
      
      const headingJobs = headings.filter(heading => 
        jobKeywords.some(keyword => heading.toLowerCase().includes(keyword)) &&
        heading.length > 15 && heading.length < 200
      );
      
      console.log(`📋 Additional fallback: Found ${linkJobs.length} link jobs, ${headingJobs.length} heading jobs`);
      
      // Combine all potential jobs
      const allPotentialJobs = [...potentialJobs, ...linkJobs, ...headingJobs];
      const uniqueJobs = [...new Set(allPotentialJobs)]; // Remove duplicates
      
      console.log(`📋 Total unique potential jobs: ${uniqueJobs.length}`);
      
      // Create basic job entries from potential titles
      for (let i = 0; i < Math.min(uniqueJobs.length, 30); i++) {
        const title = uniqueJobs[i];
        if (title && title.length > 5) {
          const job: CanonicalJob = {
            source: boardKey,
            sourceUrl: url,
            title,
            company: { name: 'Unknown' },
            location: 'UK',
            descriptionHtml: '',
            descriptionText: '',
            applyUrl: url,
            applyDeadline: undefined,
            jobType: classifyJobType(title),
            salary: undefined,
            hash: sha256([title, 'Unknown', url].join('|')),
            slug: makeUniqueSlug(title, 'Unknown', sha256([title, 'Unknown', url, Date.now().toString()].join('|')), 'UK')
          };
          
          // Only add if it's a relevant job type
          if (isRelevantJobType(title) && isUKJob(title)) {
            jobs.push(job);
          }
        }
      }
      
      if (jobs.length === 0) {
        console.warn(`⚠️  Fallback extraction also failed - trying ultra-aggressive extraction...`);
        
        // Ultra-aggressive fallback: extract any text that looks like a job
        const allText = $.text();
        const words = allText.split(/\s+/);
        const jobPhrases: string[] = [];
        
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
        
        const uniquePhrases = [...new Set(jobPhrases)];
        console.log(`📋 Ultra-aggressive: Found ${uniquePhrases.length} job phrases`);
        
        // Create jobs from phrases
        for (let i = 0; i < Math.min(uniquePhrases.length, 20); i++) {
          const title = uniquePhrases[i];
          if (title && title.length > 10) {
            const job: CanonicalJob = {
              source: boardKey,
              sourceUrl: url,
              title,
              company: { name: 'Unknown' },
              location: 'UK',
              descriptionHtml: '',
              descriptionText: '',
              applyUrl: url,
              applyDeadline: undefined,
              jobType: classifyJobType(title),
              salary: undefined,
              hash: sha256([title, 'Unknown', url].join('|')),
              slug: makeUniqueSlug(title, 'Unknown', sha256([title, 'Unknown', url, Date.now().toString()].join('|')), 'UK')
            };
            
            if (isRelevantJobType(title) && isUKJob(title)) {
              jobs.push(job);
            }
          }
        }
        
        if (jobs.length === 0) {
          console.warn(`⚠️  All extraction methods failed - page might be JS-rendered or wrong URL`);
        }
      }
      
      return jobs;
    }

    // Extract job data from each card (limit to 30)
    for (let i = 0; i < Math.min($jobCards.length, 30); i++) {
      try {
        const $card = $jobCards.eq(i);
        
        // Extract title with comprehensive fallbacks
        const title = (
          $card.find('h1, h2, h3, h4').first().text().trim() ||
          $card.find('[class*="title"], [class*="Title"], [class*="job-title"], [class*="jobTitle"]').first().text().trim() ||
          $card.find('[class*="heading"], [class*="Heading"]').first().text().trim() ||
          $card.find('a').first().text().trim() ||
          $card.find('strong, b').first().text().trim() ||
          $card.text().split('\n')[0].trim()
        );
        
        // Extract company with comprehensive fallbacks
        const company = (
          $card.find('[class*="company"], [class*="Company"], [class*="employer"], [class*="Employer"]').first().text().trim() ||
          $card.find('[class*="organisation"], [class*="Organization"], [class*="org"]').first().text().trim() ||
          $card.find('[class*="firm"], [class*="Firm"]').first().text().trim() ||
          $card.find('[class*="business"], [class*="Business"]').first().text().trim() ||
          $card.find('span[class*="company"], span[class*="employer"]').first().text().trim()
        );
        
        // Extract location with comprehensive fallbacks
        const location = (
          $card.find('[class*="location"], [class*="Location"], [class*="place"], [class*="Place"]').first().text().trim() ||
          $card.find('[class*="address"], [class*="Address"]').first().text().trim() ||
          $card.find('[class*="city"], [class*="City"]').first().text().trim() ||
          $card.find('[class*="area"], [class*="Area"]').first().text().trim() ||
          $card.find('span[class*="location"], span[class*="place"]').first().text().trim()
        );
        
        // Get link with comprehensive fallbacks
        const link = (
          $card.find('a[href]').first().attr('href') ||
          $card.find('[href]').first().attr('href') ||
          $card.attr('href')
        );
        
        if (!title || title.length < 5) {
          continue;
        }
        
        // Build apply URL
        const applyUrl = link ? new URL(link, url).toString() : url;
        
        // Filter for relevance and UK
        const fullText = `${title} ${company} ${location}`;
        if (!isRelevantJobType(fullText) || !isUKJob(fullText)) {
          continue;
        }
        
        const hash = sha256([title, company || boardName, applyUrl].join('|'));
        const slug = makeUniqueSlug(title, company || boardName, hash, location);

    const job: CanonicalJob = {
          source: boardKey,
      sourceUrl: url,
      title,
          company: { name: company || boardName },
      location,
          descriptionHtml: $card.find('[class*="description"], [class*="summary"]').first().text().substring(0, 500),
      descriptionText: undefined,
      applyUrl,
          applyDeadline: extractDeadlineFromJobCard($card),
          jobType: classifyJobType(title),
          salary: undefined,
      startDate: undefined,
      endDate: undefined,
      duration: undefined,
      experience: undefined,
          companyPageUrl: undefined,
      relatedDegree: undefined,
          degreeLevel: ['UG'],
          postedAt: new Date().toISOString(),
      slug,
      hash
    };

          jobs.push(job);
        console.log(`  ✅ #${i+1}: "${title}" at ${company || 'Unknown'} (${location || 'N/A'})`);
      } catch (error) {
        console.warn(`  ⚠️  Error extracting job #${i}:`, error);
      }
    }

    console.log(`📊 Successfully extracted ${jobs.length} jobs from search page`);
    return jobs;

  } catch (error) {
    console.warn(`Failed to fetch search page ${url}:`, error instanceof Error ? error.message : String(error));
    return [];
  }
}

// Export individual board scrapers
export const scrapeTargetJobs = () => scrapeJobBoard('targetjobs');
export const scrapeMilkround = () => scrapeJobBoard('milkround');
export const scrapeProspects = () => scrapeJobBoard('prospects');
export const scrapeRateMyPlacement = () => scrapeJobBoard('ratemyplacement');
export const scrapeBrightNetwork = () => scrapeJobBoard('brightnetwork');
export const scrapeStudentJobUK = () => scrapeJobBoard('studentjob');
export const scrapeE4S = () => scrapeJobBoard('e4s');
export const scrapeRateMyApprenticeship = () => scrapeJobBoard('ratemyapprenticeship');
export const scrapeWorkInStartups = () => scrapeJobBoard('workinstartups');
export const scrapeTotalJobs = () => scrapeJobBoard('totaljobs');
export const scrapeReed = () => scrapeJobBoard('reed');
export const scrapeEscapeTheCity = () => scrapeJobBoard('escapethecity');
