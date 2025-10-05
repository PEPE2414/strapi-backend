import { get } from '../lib/fetcher';
import * as cheerio from 'cheerio';
import { CanonicalJob } from '../types';
import { makeUniqueSlug } from '../lib/slug';
import { sha256 } from '../lib/hash';
import { classifyJobType, parseSalary, toISO, isRelevantJobType, isUKJob } from '../lib/normalize';
import { resolveApplyUrl } from '../lib/applyUrl';

export async function scrapeStudentCircus(): Promise<CanonicalJob[]> {
  const jobs: CanonicalJob[] = [];
  let page = 1;
  const maxPages = 3; // Reduced from 20 to avoid 403 errors
  let consecutive403Errors = 0;
  const maxConsecutive403Errors = 3; // Stop after 3 consecutive 403 errors
  
  try {
    while (page <= maxPages) {
      // Try only the most important job search URLs to avoid 403 errors
      const urls = [
        `https://studentcircus.com/internships?page=${page}`,
        `https://studentcircus.com/graduate-jobs?page=${page}`
      ];
      
      for (const url of urls) {
        console.log(`🔄 Scraping Student Circus page ${page}: ${url}...`);
        
        try {
          const { html } = await get(url);
          const $ = cheerio.load(html);
          
          // Find job listings - Student Circus uses various selectors
          const jobElements = $('.job-item, .job-card, .search-result, .job-listing, .student-job, .circus-job');
          
          if (jobElements.length === 0) {
            console.log(`📄 No jobs found on ${url}`);
            continue;
          }
          
          console.log(`📄 Found ${jobElements.length} job listings on ${url}`);
          
          for (let i = 0; i < jobElements.length; i++) {
            try {
              const jobEl = jobElements.eq(i);
              
              // Extract job details with multiple fallback selectors
              const title = jobEl.find('h2, h3, .job-title, .title, .student-job-title').first().text().trim();
              const company = jobEl.find('.company, .employer, .job-company, .student-employer').first().text().trim();
              const location = jobEl.find('.location, .job-location, .student-location').first().text().trim();
              const description = jobEl.find('.description, .job-description, .summary, .job-summary, .student-description').first().text().trim();
              const applyLink = jobEl.find('a[href*="apply"], a[href*="job"], .apply-btn, .student-apply').first().attr('href');
              const salaryText = jobEl.find('.salary, .wage, .pay, .student-salary').first().text().trim();
              const postedDate = jobEl.find('.date, .posted, .published, .student-posted').first().text().trim();
              
              if (!title || !company) continue;
              
              const fullText = `${title} ${description} ${location}`;
              
              // Apply filtering
              if (!isRelevantJobType(fullText) || !isUKJob(fullText)) {
                continue;
              }
              
              const applyUrl = applyLink ? await resolveApplyUrl(new URL(applyLink, url).toString()) : url;
              const hash = sha256([title, company, applyUrl].join('|'));
              const slug = makeUniqueSlug(title, company, hash, location);
              
              const job: CanonicalJob = {
                source: 'studentcircus',
                sourceUrl: url,
                title,
                company: { name: company },
                companyLogo: undefined,
                location,
                descriptionHtml: description,
                descriptionText: undefined,
                applyUrl,
                applyDeadline: undefined,
                jobType: classifyJobType(fullText),
                salary: parseSalary(salaryText || description),
                startDate: undefined,
                endDate: undefined,
                duration: undefined,
                experience: undefined,
                companyPageUrl: undefined,
                relatedDegree: undefined,
                degreeLevel: undefined,
                postedAt: postedDate ? parsePostedDate(postedDate) : new Date().toISOString(),
                slug,
                hash
              };
              
              jobs.push(job);
            } catch (error) {
              console.warn(`Error processing job ${i} on ${url}:`, error);
            }
          }
          
          // Add delay between requests to be respectful
          await new Promise(resolve => setTimeout(resolve, 2000));
          
        } catch (error) {
          console.warn(`Error scraping ${url}:`, error);
          
          // Track consecutive 403 errors
          if (error instanceof Error && error.message.includes('403')) {
            consecutive403Errors++;
            if (consecutive403Errors >= maxConsecutive403Errors) {
              console.warn(`🛑 Too many consecutive 403 errors (${consecutive403Errors}), stopping Student Circus scraping`);
              return jobs;
            }
          } else {
            consecutive403Errors = 0; // Reset counter on non-403 errors
          }
        }
      }
      
      page++;
      
      // Add delay between pages
      await new Promise(resolve => setTimeout(resolve, 3000));
    }
    
    console.log(`📊 Student Circus: Found ${jobs.length} total jobs across ${page - 1} pages`);
    return jobs;
    
  } catch (error) {
    console.warn(`Failed to scrape Student Circus:`, error instanceof Error ? error.message : String(error));
    return jobs;
  }
}

// Helper function to parse posted date from various formats
function parsePostedDate(dateStr: string): string {
  const now = new Date();
  const lower = dateStr.toLowerCase();
  
  if (lower.includes('today')) {
    return now.toISOString();
  } else if (lower.includes('yesterday')) {
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    return yesterday.toISOString();
  } else if (lower.includes('day ago')) {
    const days = parseInt(lower.match(/(\d+) day/)?.[1] || '1');
    const past = new Date(now);
    past.setDate(past.getDate() - days);
    return past.toISOString();
  } else if (lower.includes('week ago')) {
    const weeks = parseInt(lower.match(/(\d+) week/)?.[1] || '1');
    const past = new Date(now);
    past.setDate(past.getDate() - (weeks * 7));
    return past.toISOString();
  } else if (lower.includes('month ago')) {
    const months = parseInt(lower.match(/(\d+) month/)?.[1] || '1');
    const past = new Date(now);
    past.setMonth(past.getMonth() - months);
    return past.toISOString();
  }
  
  // Try to parse as a date
  const parsed = new Date(dateStr);
  if (!isNaN(parsed.getTime())) {
    return parsed.toISOString();
  }
  
  return now.toISOString();
}
