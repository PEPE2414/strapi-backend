import { CloudflareScraper } from './cloudflareScraper';
import * as cheerio from 'cheerio';
import { CanonicalJob } from '../types';
import { makeUniqueSlug } from './slug';
import { generateJobHash } from './jobHash';

/**
 * Scraper specifically for gradcracker.com
 * Handles the Livewire-based architecture and extracts job listings
 */
export class GradcrackerScraper {
  private scraper: CloudflareScraper;

  constructor() {
    this.scraper = new CloudflareScraper();
  }

  /**
   * Initialize the scraper
   */
  async init(headless: boolean = true): Promise<void> {
    await this.scraper.init({
      headless,
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    });
  }

  /**
   * Scrape job listings from a search page
   * Example: /search/all-disciplines/engineering-graduate-jobs
   */
  async scrapeJobListings(
    path: string = '/search/all-disciplines/engineering-graduate-jobs',
    options: {
      maxPages?: number;
      waitTime?: number;
    } = {}
  ): Promise<CanonicalJob[]> {
    const { maxPages = 1, waitTime = 3000 } = options;
    const jobs: CanonicalJob[] = [];
    const baseUrl = 'https://www.gradcracker.com';

    for (let page = 1; page <= maxPages; page++) {
      const url = page === 1 
        ? `${baseUrl}${path}`
        : `${baseUrl}${path}?page=${page}`;

      console.log(`Scraping page ${page}: ${url}`);

      try {
        const { $, page: browserPage } = await this.scraper.scrapeAndParse(url, {
          waitTime,
          waitForSelector: '[wire\\:id]', // Wait for Livewire components
        });

        // Extract job listings from the page
        const pageJobs = this.extractJobsFromPage($, baseUrl);
        jobs.push(...pageJobs);

        console.log(`Found ${pageJobs.length} jobs on page ${page}`);

        // Check if there are more pages
        const hasNextPage = $('a[href*="page="]').length > 0;
        if (!hasNextPage && page < maxPages) {
          console.log('No more pages available');
          break;
        }

        // Close the page
        await browserPage.close();

        // Rate limiting - be respectful
        if (page < maxPages) {
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
      } catch (error) {
        console.error(`Error scraping page ${page}:`, error);
        break;
      }
    }

    return jobs;
  }

  /**
   * Extract job listings from a parsed HTML page
   */
  private extractJobsFromPage($: cheerio.CheerioAPI, baseUrl: string): CanonicalJob[] {
    const jobs: CanonicalJob[] = [];

    // Gradcracker uses Livewire components, so we need to find job cards
    // The exact selectors may need adjustment based on the actual HTML structure
    // Common patterns for job listings:
    
    // Try multiple possible selectors
    const jobSelectors = [
      'article[class*="job"]',
      'div[class*="job-card"]',
      'div[class*="job-listing"]',
      'div[class*="opportunity"]',
      '[data-job-id]',
      '[data-opportunity-id]',
    ];

    let jobElements: cheerio.Cheerio<any> | null = null;

    for (const selector of jobSelectors) {
      const elements = $(selector);
      if (elements.length > 0) {
        jobElements = elements;
        console.log(`Found jobs using selector: ${selector}`);
        break;
      }
    }

    // If no specific job selector works, try to find links that look like job listings
    if (!jobElements || jobElements.length === 0) {
      // Look for links that might be job listings
      const allLinks = $('a[href*="/jobs/"], a[href*="/job/"], a[href*="/opportunities/"]');
      if (allLinks.length > 0) {
        console.log(`Found ${allLinks.length} potential job links`);
        // Use parent elements of these links as job cards
        jobElements = allLinks.parent().parent();
      }
    }

    if (!jobElements || jobElements.length === 0) {
      console.warn('No job listings found on page. The HTML structure may have changed.');
      // Log the page structure for debugging
      console.log('Page title:', $('title').text());
      console.log('Sample HTML structure:', $('body').html()?.substring(0, 500));
      return [];
    }

    jobElements.each((index, element) => {
      try {
        const $job = $(element);
        const job = this.parseJobElement($job, baseUrl);
        if (job) {
          jobs.push(job);
        }
      } catch (error) {
        console.error(`Error parsing job element ${index}:`, error);
      }
    });

    return jobs;
  }

  /**
   * Parse a single job element into a CanonicalJob
   */
  private parseJobElement($job: cheerio.Cheerio<any>, baseUrl: string): CanonicalJob | null {
    try {
      // Find the job title and link
      const titleLink = $job.find('a[href*="/jobs/"], a[href*="/job/"], a[href*="/opportunities/"]').first();
      const title = titleLink.text().trim() || $job.find('h2, h3, [class*="title"]').first().text().trim();
      const relativeUrl = titleLink.attr('href') || '';
      const jobUrl = relativeUrl.startsWith('http') ? relativeUrl : `${baseUrl}${relativeUrl}`;

      if (!title || !jobUrl) {
        return null;
      }

      // Extract company name
      const company = $job.find('[class*="company"], [class*="employer"]').first().text().trim() ||
                     $job.find('a[href*="/companies/"], a[href*="/employers/"]').first().text().trim() ||
                     'Unknown Company';

      // Extract location
      const location = $job.find('[class*="location"], [class*="city"]').first().text().trim() ||
                      $job.find('[data-location]').attr('data-location') ||
                      '';

      // Extract job type/opportunity type
      const jobType = $job.find('[class*="type"], [class*="opportunity-type"]').first().text().trim() ||
                     $job.find('[data-type]').attr('data-type') ||
                     '';

      // Extract description/summary
      const description = $job.find('[class*="description"], [class*="summary"]').first().text().trim() ||
                         $job.find('p').first().text().trim() ||
                         '';

      // Extract salary if available
      const salary = $job.find('[class*="salary"], [class*="compensation"]').first().text().trim() || '';

      // Extract posted date if available
      const postedDate = $job.find('[class*="date"], [class*="posted"], time').first().text().trim() ||
                        $job.find('time').attr('datetime') ||
                        '';

      // Create canonical job object with required fields
      const jobData: Partial<CanonicalJob> = {
        title: title,
        company: {
          name: company,
        },
        location: location,
        source: 'gradcracker',
        sourceUrl: jobUrl,
        applyUrl: jobUrl,
        companyPageUrl: jobUrl,
        descriptionText: description || '',
        jobType: this.inferJobType(jobType, title),
        postedAt: postedDate ? new Date(postedDate).toISOString() : new Date().toISOString(),
      };

      // Generate required hash first (needed for slug)
      const hash = generateJobHash({
        title,
        company: company,
        applyUrl: jobUrl,
        id: this.extractJobId(jobUrl),
      });

      // Generate required slug (requires hash)
      const slug = makeUniqueSlug(title, company, hash, location);

      const job: CanonicalJob = {
        ...jobData,
        slug,
        hash,
        title,
        company: { name: company },
        applyUrl: jobUrl,
        sourceUrl: jobUrl,
        descriptionText: description || title, // Fallback to title if no description
        jobType: this.inferJobType(jobType, title),
      } as CanonicalJob;

      return job;
    } catch (error) {
      console.error('Error parsing job element:', error);
      return null;
    }
  }

  /**
   * Extract job ID from URL
   */
  private extractJobId(url: string): string {
    // Try to extract ID from URL patterns like /jobs/123 or /job/123
    const match = url.match(/\/(?:jobs?|opportunities)\/(\d+)/);
    return match ? match[1] : url.split('/').pop() || url;
  }

  /**
   * Infer job type from job type string and title
   */
  private inferJobType(jobTypeStr: string, title: string): 'internship' | 'placement' | 'graduate' | 'other' {
    const lowerType = jobTypeStr.toLowerCase();
    const lowerTitle = title.toLowerCase();

    if (lowerType.includes('internship') || lowerTitle.includes('internship')) {
      return 'internship';
    }
    if (lowerType.includes('placement') || lowerTitle.includes('placement')) {
      return 'placement';
    }
    if (lowerType.includes('graduate') || lowerTitle.includes('graduate')) {
      return 'graduate';
    }
    return 'other';
  }

  /**
   * Scrape a single job detail page
   */
  async scrapeJobDetail(jobUrl: string): Promise<Partial<CanonicalJob> | null> {
    try {
      const { $ } = await this.scraper.scrapeAndParse(jobUrl, {
        waitTime: 2000,
      });

      // Extract detailed information
      const description = $('[class*="description"], [class*="job-description"], article').first().text().trim() ||
                         $('main').text().trim() ||
                         '';

      return {
        descriptionText: description || undefined,
      };
    } catch (error) {
      console.error(`Error scraping job detail ${jobUrl}:`, error);
      return null;
    }
  }

  /**
   * Close the scraper
   */
  async close(): Promise<void> {
    await this.scraper.close();
  }
}

/**
 * Convenience function to scrape gradcracker job listings
 */
export async function scrapeGradcrackerJobs(
  path: string = '/search/all-disciplines/engineering-graduate-jobs',
  options: {
    maxPages?: number;
    headless?: boolean;
  } = {}
): Promise<CanonicalJob[]> {
  const scraper = new GradcrackerScraper();
  try {
    await scraper.init(options.headless);
    return await scraper.scrapeJobListings(path, { maxPages: options.maxPages });
  } finally {
    await scraper.close();
  }
}

