import { CanonicalJob } from '../types';
import { request } from 'undici';
import * as cheerio from 'cheerio';
import { scrapeFromUrls } from './sitemapGeneric';
import { isRelevantJobType, isUKJob } from '../lib/normalize';
import { 
  MAJOR_JOB_BOARDS, 
  ENGINEERING_JOB_BOARDS, 
  TECH_JOB_BOARDS, 
  FINANCE_JOB_BOARDS, 
  CONSULTING_JOB_BOARDS, 
  UNIVERSITY_BOARDS 
} from '../config/sources';
import { isTestMode } from '../lib/rotation';

/**
 * Process a sitemap and extract job URLs
 */
async function processSitemap(sitemapUrl: string, maxUrls: number = 10000): Promise<string[]> {
  const jobUrls = new Set<string>();
  const sitemapQueue: string[] = [sitemapUrl];
  const visitedSitemaps = new Set<string>();
  const MAX_SITEMAP_DEPTH = 5;
  let depth = 0;

  while (sitemapQueue.length > 0 && jobUrls.size < maxUrls && depth < MAX_SITEMAP_DEPTH) {
    const currentSitemap = sitemapQueue.shift();
    if (!currentSitemap || visitedSitemaps.has(currentSitemap)) continue;
    
    visitedSitemaps.add(currentSitemap);
    depth++;

    try {
      const res = await request(currentSitemap, {
        method: 'GET',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Accept': 'application/xml,text/xml,*/*;q=0.9'
        },
        maxRedirections: 3
      });

      if (res.statusCode !== 200) {
        console.warn(`  ⚠️  Sitemap returned ${res.statusCode}: ${currentSitemap}`);
        continue;
      }

      const xml = await res.body.text();
      if (!xml || xml.length < 100) continue;

      const $ = cheerio.load(xml, { xmlMode: true });
      const urls: string[] = [];

      // Extract URLs from sitemap
      $('url > loc').each((_, el) => {
        const url = $(el).text().trim();
        if (url) urls.push(url);
      });

      // Extract child sitemaps (sitemap index)
      $('sitemap > loc').each((_, el) => {
        const childSitemap = $(el).text().trim();
        if (childSitemap && !visitedSitemaps.has(childSitemap) && sitemapQueue.length < 50) {
          sitemapQueue.push(childSitemap);
        }
      });

      // Filter for job detail page URLs (more precise filtering)
      for (const url of urls) {
        if (jobUrls.size >= maxUrls) break;
        
        const urlLower = url.toLowerCase();
        const urlPath = new URL(url).pathname.toLowerCase();
        
        // Skip non-job URLs, salary/average pages, company profiles, and spam
        if (/sitemap|feed|rss|atom|robots|login|register|logout|search|list|index|category|tag|archive|average-salary|salary|average-|company-profile|profile|generator|cash-app|autoclaim|boosted|asphalt|tokens/.test(urlLower)) {
          continue;
        }
        
        // Exclude company profile pages (common in Reed sitemaps)
        if (/\/company-profile\/|\/profile\//.test(urlPath)) {
          continue;
        }
        
        // Exclude spam/junk URLs (dashes, special characters, invalid patterns)
        if (/^\/jobs\/[-\s%&]+/i.test(urlPath) || /^\/jobs\/-{3,}/i.test(urlPath) || /%20/i.test(urlPath)) {
          continue;
        }
        
        // Must contain job-related keywords
        const hasJobKeyword = /job|vacanc|role|position|opportunit|career|opening|graduate|intern|placement|scheme|programme/.test(urlLower);
        if (!hasJobKeyword) continue;
        
        // Explicitly exclude salary/average pages
        if (/\/average-|\/salary|average-salary/.test(urlPath)) {
          continue;
        }
        
        // For Reed specifically, only accept URLs with numeric job IDs (format: /jobs/.../p12345)
        if (urlLower.includes('reed.co.uk')) {
          if (!/\/jobs\/[^\/]+\/p\d+$/i.test(urlPath) && !/\/jobs\/\d+$/i.test(urlPath)) {
            continue;
          }
        }
        
        // Prefer URLs that look like detail pages (not listing/search pages)
        // Good signs: numeric IDs, specific job titles in URL, or common detail page patterns
        const looksLikeDetailPage = 
          /\/(job|vacancy|role|position|opportunity|career|opening|graduate|intern|placement|scheme|programme)\/[^\/]+$/i.test(urlPath) || // Single job path
          /\/(job|vacancy|role|position|opportunity|career|opening|graduate|intern|placement|scheme|programme)\/[^\/]+\/[^\/]+$/i.test(urlPath) || // Nested job path
          /\/\d+$/.test(urlPath) || // Ends with numeric ID
          /\/[a-z0-9-]{20,}$/i.test(urlPath); // Long slug (likely specific job)
        
        // Avoid listing/search pages
        const isListingPage = 
          /\/search|\/list|\/jobs$|\/vacancies$|\/roles$|\/positions$|\/opportunities$/.test(urlPath) ||
          /\?.*(search|query|q=|page=|offset=)/.test(urlLower);
        
        if (looksLikeDetailPage && !isListingPage) {
          jobUrls.add(url);
        } else if (hasJobKeyword && !isListingPage && jobUrls.size < maxUrls * 0.1) {
          // Allow some non-detail pages if we don't have enough detail pages (10% max)
          jobUrls.add(url);
        }
      }

      // Small delay to avoid overwhelming servers
      await new Promise(resolve => setTimeout(resolve, 500));
    } catch (error) {
      console.warn(`  ⚠️  Failed to process sitemap ${currentSitemap}:`, error instanceof Error ? error.message : String(error));
    }
  }

  return Array.from(jobUrls);
}

/**
 * Scrape jobs from all listed sitemaps
 */
export async function scrapeAllSitemaps(): Promise<CanonicalJob[]> {
  console.log('🚀 Starting bulk sitemap scraping...');
  let allSitemaps = [
    ...MAJOR_JOB_BOARDS,
    ...ENGINEERING_JOB_BOARDS,
    ...TECH_JOB_BOARDS,
    ...FINANCE_JOB_BOARDS,
    ...CONSULTING_JOB_BOARDS,
    ...UNIVERSITY_BOARDS
  ];

  // Use Perplexity to discover additional sitemap URLs
  const knownCount = allSitemaps.length;
  try {
    const { discoverUrlsWithPerplexity } = await import('../lib/perplexityUrlDiscovery');
    const discoveredSitemaps = await discoverUrlsWithPerplexity('sitemap', 'bulk-sitemaps', 'Bulk Sitemaps');
    discoveredSitemaps.forEach(url => {
      if (!allSitemaps.includes(url) && url.includes('sitemap')) {
        allSitemaps.push(url);
      }
    });
    if (discoveredSitemaps.length > 0) {
      console.log(`🤖 Perplexity discovered ${discoveredSitemaps.length} additional sitemap URLs`);
    }
  } catch (error) {
    console.log(`⚠️  Perplexity sitemap discovery failed, using known sitemaps only`);
  }

  // In test mode, limit to 1 sitemap
  const sitemapsToProcess = isTestMode() ? allSitemaps.slice(0, 1) : allSitemaps;
  console.log(`📊 Processing ${sitemapsToProcess.length} sitemap(s)${isTestMode() ? ' (TEST MODE: 1 sitemap only)' : ` (${knownCount} known + ${allSitemaps.length - knownCount} discovered)`}...`);
  
  const allJobUrls: string[] = [];
  const processed = new Set<string>();

  // Process sitemaps in batches to avoid overwhelming servers
  const BATCH_SIZE = 10;
  for (let i = 0; i < sitemapsToProcess.length; i += BATCH_SIZE) {
    const batch = sitemapsToProcess.slice(i, i + BATCH_SIZE);
    
    console.log(`\n📦 Processing batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(sitemapsToProcess.length / BATCH_SIZE)} (${batch.length} sitemap(s))...`);

    const batchPromises = batch.map(async (sitemapUrl) => {
      if (processed.has(sitemapUrl)) return [];

      try {
        const domain = new URL(sitemapUrl).hostname;
        console.log(`  🔄 Processing ${domain}...`);
        
        // In test mode, limit to 50 URLs per sitemap for faster testing
        const maxUrlsPerSitemap = isTestMode() ? 50 : 5000;
        const jobUrls = await processSitemap(sitemapUrl, maxUrlsPerSitemap);
        
        if (jobUrls.length > 0) {
          console.log(`    ✅ Found ${jobUrls.length} job URLs from ${domain}${isTestMode() ? ' (TEST MODE: limited to 50)' : ''}`);
          // Log first few URLs in test mode for debugging
          if (isTestMode() && jobUrls.length > 0) {
            console.log(`    📋 Sample URLs: ${jobUrls.slice(0, 3).map(u => new URL(u).pathname).join(', ')}`);
          }
        } else {
          console.log(`    ⚠️  No job URLs found from ${domain}`);
        }

        processed.add(sitemapUrl);
        return jobUrls;
      } catch (error) {
        console.warn(`  ❌ Failed to process ${sitemapUrl}:`, error instanceof Error ? error.message : String(error));
        return [];
      }
    });

    const batchResults = await Promise.all(batchPromises);
    batchResults.forEach(urls => allJobUrls.push(...urls));

    // Delay between batches
    if (i + BATCH_SIZE < sitemapsToProcess.length) {
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }

  // Deduplicate URLs
  const uniqueJobUrls = Array.from(new Set(allJobUrls));
  console.log(`\n✅ Sitemap processing completed:`);
  console.log(`   📊 Processed ${processed.size} sitemaps`);
  console.log(`   🔗 Found ${uniqueJobUrls.length} unique job URLs`);

  // Scrape job detail pages in batches
  if (uniqueJobUrls.length === 0) {
    console.log(`   ⚠️  No job URLs found to scrape`);
    return [];
  }

  console.log(`\n🔍 Scraping job detail pages...`);
  const BATCH_SIZE_SCRAPE = 100;
  const allJobs: CanonicalJob[] = [];
  const seenHashes = new Set<string>();

  for (let i = 0; i < uniqueJobUrls.length; i += BATCH_SIZE_SCRAPE) {
    const batch = uniqueJobUrls.slice(i, i + BATCH_SIZE_SCRAPE);
    console.log(`  📦 Scraping batch ${Math.floor(i / BATCH_SIZE_SCRAPE) + 1}/${Math.ceil(uniqueJobUrls.length / BATCH_SIZE_SCRAPE)} (${batch.length} URLs)...`);

    try {
      const jobs = await scrapeFromUrls(batch, 'sitemap-bulk');
      
      for (const job of jobs) {
        // Filter for relevant UK jobs
        const fullText = `${job.title} ${job.descriptionText || job.descriptionHtml || ''} ${job.location || ''}`;
        if (!isRelevantJobType(fullText) || !isUKJob(fullText)) continue;
        
        // Deduplicate
        if (seenHashes.has(job.hash)) continue;
        seenHashes.add(job.hash);
        
        allJobs.push(job);
      }

      console.log(`    ✅ Batch completed: ${jobs.length} jobs extracted, ${allJobs.length} total unique jobs`);
    } catch (error) {
      console.warn(`    ⚠️  Batch failed:`, error instanceof Error ? error.message : String(error));
    }

    // Delay between batches
    if (i + BATCH_SIZE_SCRAPE < uniqueJobUrls.length) {
      await new Promise(resolve => setTimeout(resolve, 3000));
    }
  }

  console.log(`\n🎉 Bulk sitemap scraping completed: ${allJobs.length} total jobs`);
  return allJobs;
}

