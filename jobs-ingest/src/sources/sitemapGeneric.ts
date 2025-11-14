import { get } from '../lib/fetcher';
import { fetchWithCloudflareBypass } from '../lib/cloudflareBypass';
import * as cheerio from 'cheerio';
import { extractJobPostingJSONLD } from '../lib/jsonld';
import { pickLogo } from '../lib/logo';
import { resolveApplyUrl } from '../lib/applyUrl';
import { CanonicalJob } from '../types';
import { makeUniqueSlug } from '../lib/slug';
import { sha256 } from '../lib/hash';
import { classifyJobType, parseSalary, toISO, isRelevantJobType, isUKJob } from '../lib/normalize';

/**
 * Domains that are known to block scrapers and should use SmartProxy first
 */
const PROBLEMATIC_DOMAINS = [
  'reed.co.uk',
  'www.reed.co.uk',
  'totaljobs.com',
  'www.totaljobs.com',
  'cv-library.co.uk',
  'www.cv-library.co.uk',
  'jobsite.co.uk',
  'www.jobsite.co.uk',
  'fish4jobs.co.uk',
  'www.fish4jobs.co.uk',
  'targetjobs.co.uk',
  'www.targetjobs.co.uk',
  'gradcracker.com',
  'www.gradcracker.com',
  'milkround.com',
  'www.milkround.com',
  'prospects.ac.uk',
  'www.prospects.ac.uk',
  'brightnetwork.co.uk',
  'www.brightnetwork.co.uk',
  'ratemyplacement.co.uk',
  'www.ratemyplacement.co.uk',
  'monster.co.uk',
  'www.monster.co.uk',
  'indeed.co.uk',
  'www.indeed.co.uk',
  'adzuna.co.uk',
  'www.adzuna.co.uk',
  'careerjet.co.uk',
  'www.careerjet.co.uk'
];

/**
 * Check if a URL is from a domain that commonly blocks scrapers
 */
function isProblematicDomain(url: string): boolean {
  try {
    const urlObj = new URL(url);
    const hostname = urlObj.hostname.toLowerCase();
    return PROBLEMATIC_DOMAINS.some(domain => hostname === domain || hostname.endsWith('.' + domain));
  } catch {
    return false;
  }
}

export async function scrapeFromUrls(urls: string[], sourceTag: string): Promise<CanonicalJob[]> {
  const out: CanonicalJob[] = [];
  const BATCH_SIZE = 10; // Process in batches for better memory management
  
  for (let i = 0; i < urls.length; i += BATCH_SIZE) {
    const batch = urls.slice(i, i + BATCH_SIZE);
    console.log(`Processing batch ${Math.floor(i/BATCH_SIZE) + 1}/${Math.ceil(urls.length/BATCH_SIZE)} (${batch.length} URLs)`);
    
    const batchPromises: Promise<CanonicalJob | null>[] = batch.map(async (url): Promise<CanonicalJob | null> => {
      try {
      // Quick check: skip URLs that don't look like job detail pages
      const urlLower = url.toLowerCase();
      const urlPath = new URL(url).pathname.toLowerCase();
      
      // Explicitly exclude salary/average pages
      if (/\/average-|\/salary|average-salary/.test(urlPath)) {
        console.log(`⏭️  Skipping salary/average page: ${urlPath}`);
        return null;
      }
      
      const isLikelyJobPage = 
        /\/job|\/vacancy|\/role|\/position|\/opportunity|\/career|\/opening|\/graduate|\/intern|\/placement|\/scheme|\/programme/.test(urlLower) ||
        !/\/search|\/list|\/index|\/category|\/tag|\/archive|\/sitemap|\/feed|\/rss/.test(urlLower);
      
      if (!isLikelyJobPage) {
        console.log(`⏭️  Skipping URL that doesn't look like a job page: ${urlPath}`);
        return null;
      }
      
      // For problematic domains, use SmartProxy first. For others, try direct fetch first
      let html: string;
      const useProxyFirst = isProblematicDomain(url);
      
      if (useProxyFirst) {
        // Use SmartProxy first for known problematic domains
        try {
          const result = await fetchWithCloudflareBypass(url);
          html = result.html;
        } catch (proxyError) {
          // If proxy fails, try direct fetch as fallback
          try {
            const result = await get(url);
            html = result.html;
          } catch (directError) {
            console.warn(`Failed to fetch ${url} (proxy and direct both failed): ${proxyError instanceof Error ? proxyError.message : String(proxyError)}`);
            return null;
          }
        }
      } else {
        // For other domains, try direct fetch first (faster and cheaper)
        try {
          const result = await get(url);
          html = result.html;
        } catch (directError) {
          // If direct fetch fails, try Cloudflare bypass as fallback
          try {
            const result = await fetchWithCloudflareBypass(url);
            html = result.html;
          } catch (bypassError) {
            console.warn(`Failed to fetch ${url}: ${bypassError instanceof Error ? bypassError.message : String(bypassError)}`);
            return null;
          }
        }
      }
      
      // Check if HTML is too short or looks like an error page
      if (!html || html.length < 500) {
        console.log(`⏭️  Skipping URL with insufficient content: ${new URL(url).pathname} (${html?.length || 0} chars)`);
        return null;
      }
      
      const jsonld = extractJobPostingJSONLD(html);
      const $ = cheerio.load(html);

      // More aggressive title extraction with multiple fallbacks
      const title = (
        jsonld?.title || 
        $('h1').first().text() || 
        $('h2.job-title, .job-title, [class*="job-title"], [class*="jobTitle"]').first().text() ||
        $('title').first().text().split('|')[0].split('-')[0] ||
        $('meta[property="og:title"]').attr('content') ||
        $('meta[name="title"]').attr('content') ||
        ''
      ).trim();
      const companyName =
        jsonld?.hiringOrganization?.name ||
        $('meta[property="og:site_name"]').attr('content') ||
        $('meta[name="author"]').attr('content') ||
        new URL(url).hostname.replace(/^www\./,'');
      const location = jsonld?.jobLocation?.address?.addressLocality ||
        jsonld?.jobLocation?.address?.addressRegion ||
        $('.location,.job-location').first().text().trim() || undefined;

      const descHtml = jsonld?.description || $('#job, .job-description, article').first().html() || $('main').html() || '';
      const applyUrlRaw =
        jsonld?.hiringOrganization?.sameAs ||
        jsonld?.applicationContact?.url ||
        $('a[href*="apply"], a:contains("Apply")').first().attr('href') ||
        url;
      const applyUrl = await resolveApplyUrl(new URL(applyUrlRaw, url).toString());

      const deadline = toISO(jsonld?.validThrough);
      const salaryNorm = parseSalary(String(jsonld?.baseSalary?.value?.value || jsonld?.baseSalary?.value || ''));

      const postedAt = toISO(jsonld?.datePosted);

      const degreeLevel = (() => {
        const t = (title + ' ' + String(descHtml)).toLowerCase();
        const arr: string[] = [];
        if (/\b(beng|meng|bsc|msc|msci|phd|2:1|2:2)\b/.test(t)) {
          if (/\bbeng\b/.test(t)) arr.push('BEng');
          if (/\bmeng\b/.test(t)) arr.push('MEng');
          if (/\bbsc\b/.test(t)) arr.push('BSc');
          if (/\bmsc\b/.test(t)) arr.push('MSc');
          if (/\bmsci\b/.test(t)) arr.push('MSci');
          if (/\bphd\b/.test(t)) arr.push('PhD');
          if (/\b2:1\b/.test(t)) arr.push('2:1');
          if (/\b2:2\b/.test(t)) arr.push('2:2');
        }
        return arr.length ? arr : undefined;
      })();

      const relatedDegree = (() => {
        const t = (title + ' ' + String(descHtml)).toLowerCase();
        const keys = ['civil','structural','mechanical','aerospace','electrical','computer','software','chemical','materials','maths','physics','construction','architecture','geotechnical','environmental','mechatronics','industrial','biomedical'];
        const found = keys.filter(k => t.includes(k));
        return found.length ? found.map(x => x[0].toUpperCase()+x.slice(1)) : undefined;
      })();

      const experience = (() => {
        const t = String(descHtml).toLowerCase();
        const m = t.match(/\b(\d+)\+?\s*(years?|months?)\s*(experience)?/);
        return m ? m[0] : undefined;
      })();

      const companyPage = jsonld?.hiringOrganization?.sameAs || undefined;
      const companyLogo = pickLogo(html, jsonld);

            // Check if this job is relevant for university students AND UK-based
            const fullText = title + ' ' + String(descHtml) + ' ' + (location || '');
            
            // Debug logging with more context
            if (!title || title.trim().length < 3) {
              // Try to extract any text that might be a title from the page
              const pageText = $('body').text().substring(0, 200);
              const urlPath = new URL(url).pathname;
              console.log(`⏭️  Skipping job with invalid title: "${title}" (URL: ${urlPath}, page preview: ${pageText.substring(0, 100)}...)`);
              return null;
            }
            
            if (!isRelevantJobType(fullText)) {
              console.log(`⏭️  Skipping non-relevant job type: "${title}"`);
              return null;
            }
            
            if (!isUKJob(fullText)) {
              console.log(`⏭️  Skipping non-UK job: "${title}" (location: ${location})`);
              return null;
            }

      const jobType = classifyJobType(title + ' ' + $('#job, main, body').text());
      const company = { name: companyName };

      const hash = sha256([title, companyName, applyUrl].join('|'));
      const slug = makeUniqueSlug(title, companyName, hash, location);

      const job: CanonicalJob = {
        source: sourceTag,
        sourceUrl: url,
        title,
        company,
        companyLogo,
        location,
        descriptionHtml: descHtml || undefined,
        descriptionText: undefined, // LLM/text cleanup step later
        applyUrl,
        applyDeadline: deadline,
        jobType,
        salary: salaryNorm,
        startDate: toISO(jsonld?.employmentStartDate),
        endDate: toISO(jsonld?.employmentEndDate),
        duration: jsonld?.employmentUnit || undefined,
        experience,
        companyPageUrl: companyPage,
        relatedDegree,
        degreeLevel,
        postedAt,
        slug,
        hash
      };
      return job;
    } catch (error) {
      console.warn(`Failed to scrape ${url}:`, error instanceof Error ? error.message : String(error));
      return null;
    }
    });
    
          const batchResults = await Promise.all(batchPromises);
          const validJobs = batchResults.filter((job): job is CanonicalJob => job !== null);
          out.push(...validJobs);
    
    // Small delay between batches to be respectful
    if (i + BATCH_SIZE < urls.length) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
  return out;
}
