import { get } from '../lib/fetcher';
import * as cheerio from 'cheerio';
import { CanonicalJob } from '../types';
import { makeUniqueSlug } from '../lib/slug';
import { sha256 } from '../lib/hash';
import { classifyJobType, parseSalary, toISO, isRelevantJobType, isUKJob } from '../lib/normalize';
import { resolveApplyUrl } from '../lib/applyUrl';

export async function scrapeGradcracker(): Promise<CanonicalJob[]> {
  const jobs: CanonicalJob[] = [];
  let page = 1;
  const maxPages = 20; // Limit to prevent infinite loops
  
  try {
    while (page <= maxPages) {
      const url = `https://www.gradcracker.com/search/engineering-jobs?page=${page}`;
      console.log(`🔄 Scraping Gradcracker page ${page}...`);
      
      const { html } = await get(url);
      const $ = cheerio.load(html);
      
      // Find job listings on the page
      const jobElements = $('.job-listing, .job-item, .job-card, .search-result');
      
      if (jobElements.length === 0) {
        console.log(`📄 No more jobs found on page ${page}, stopping`);
        break;
      }
      
      console.log(`📄 Found ${jobElements.length} job listings on page ${page}`);
      
      for (let i = 0; i < jobElements.length; i++) {
        try {
          const jobEl = jobElements.eq(i);
          const title = jobEl.find('h2, h3, .job-title, .title').first().text().trim();
          const company = jobEl.find('.company, .employer, .job-company').first().text().trim();
          const location = jobEl.find('.location, .job-location').first().text().trim();
          const description = jobEl.find('.description, .job-description, .summary').first().text().trim();
          const applyLink = jobEl.find('a[href*="apply"], a[href*="job"], .apply-btn').first().attr('href');
          
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
            source: 'gradcracker',
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
            salary: parseSalary(description),
            startDate: undefined,
            endDate: undefined,
            duration: undefined,
            experience: undefined,
            companyPageUrl: undefined,
            relatedDegree: undefined,
            degreeLevel: undefined,
            postedAt: new Date().toISOString(),
            slug,
            hash
          };
          
          jobs.push(job);
        } catch (error) {
          console.warn(`Error processing job ${i} on page ${page}:`, error);
        }
      }
      
      page++;
      
      // Add delay between pages to be respectful
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    console.log(`📊 Gradcracker: Found ${jobs.length} total jobs across ${page - 1} pages`);
    return jobs;
    
  } catch (error) {
    console.warn(`Failed to scrape Gradcracker:`, error instanceof Error ? error.message : String(error));
    return jobs;
  }
}
