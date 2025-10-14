import { get } from '../lib/fetcher';
import { fetchWithCloudflareBypass, getBypassStatus } from '../lib/cloudflareBypass';
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
  
  console.log(`🛡️  ${getBypassStatus()}`);
  
  try {
    while (page <= maxPages) {
      // Updated URL structure - Gradcracker uses /search/graduate-jobs
      const url = `https://www.gradcracker.com/search/graduate-jobs?page=${page}`;
      console.log(`🔄 Scraping Gradcracker page ${page}...`);
      
      const { html } = await fetchWithCloudflareBypass(url);
      const $ = cheerio.load(html);
      
      console.log(`📊 Parsing page ${page}...`);
      
      // Try multiple selectors for job cards
      const jobSelectors = [
        '.job-card',
        '.job-listing',
        '.job-item',
        '.search-result',
        '[class*="JobCard"]',
        '[class*="job-card"]',
        'article.job',
        '.vacancy'
      ];
      
      let jobElements = $();
      for (const selector of jobSelectors) {
        jobElements = $(selector);
        if (jobElements.length > 0) {
          console.log(`📦 Found ${jobElements.length} jobs using: ${selector}`);
          break;
        }
      }
      
      if (jobElements.length === 0) {
        console.log(`📄 No job cards found on page ${page}, stopping`);
        break;
      }
      
      // Extract jobs from each card
      for (let i = 0; i < jobElements.length; i++) {
        try {
          const $card = jobElements.eq(i);
          
          // Extract title
          const title = (
            $card.find('h1, h2, h3').first().text().trim() ||
            $card.find('[class*="title"], [class*="Title"]').first().text().trim() ||
            $card.find('a').first().text().trim()
          );
          
          // Extract company
          const company = (
            $card.find('[class*="company"], [class*="employer"]').first().text().trim() ||
            $card.find('[class*="organisation"]').first().text().trim()
          );
          
          // Extract location
          const location = $card.find('[class*="location"], [class*="place"]').first().text().trim();
          
          // Get description snippet
          const description = $card.find('[class*="description"], [class*="summary"]').first().text().trim();
          
          // Get apply link
          const applyLink = $card.find('a').first().attr('href');
          
          if (!title || title.length < 5) continue;
          
          const fullText = `${title} ${description} ${location} ${company}`;
          
          // Apply filtering
          if (!isRelevantJobType(fullText) || !isUKJob(fullText)) {
            continue;
          }
          
          const applyUrl = applyLink ? new URL(applyLink, url).toString() : url;
          const hash = sha256([title, company || 'Gradcracker', applyUrl].join('|'));
          const slug = makeUniqueSlug(title, company || 'Gradcracker', hash, location);
          
          const job: CanonicalJob = {
            source: 'gradcracker',
            sourceUrl: url,
            title,
            company: { name: company || 'Gradcracker' },
            companyLogo: undefined,
            location,
            descriptionHtml: description || $card.text().substring(0, 500),
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
            degreeLevel: ['UG'],
            postedAt: new Date().toISOString(),
            slug,
            hash
          };
          
          jobs.push(job);
          console.log(`  ✅ #${i+1}: "${title}" at ${company || 'Unknown'}`);
        } catch (error) {
          console.warn(`  ⚠️  Error processing job ${i}:`, error);
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
