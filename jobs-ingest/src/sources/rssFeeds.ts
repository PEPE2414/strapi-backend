import { CanonicalJob } from '../types';
import { discoverRSSFeeds, parseRSSFeed, convertRSSItemToJob, RSSFeed } from '../lib/rssFeedParser';
import { MAJOR_JOB_BOARDS, ENGINEERING_JOB_BOARDS, TECH_JOB_BOARDS, FINANCE_JOB_BOARDS, CONSULTING_JOB_BOARDS, UNIVERSITY_BOARDS } from '../config/sources';
import { isTestMode } from '../lib/rotation';

/**
 * Known RSS feed URLs for major job boards
 */
const KNOWN_RSS_FEEDS: RSSFeed[] = [
  // Major job boards
  { url: 'https://www.reed.co.uk/jobs/rss', title: 'Reed Jobs RSS' },
  { url: 'https://www.totaljobs.com/jobs/rss', title: 'TotalJobs RSS' },
  { url: 'https://www.cv-library.co.uk/jobs/rss', title: 'CV-Library RSS' },
  { url: 'https://www.jobsite.co.uk/jobs/rss', title: 'Jobsite RSS' },
  { url: 'https://www.fish4jobs.co.uk/jobs/rss', title: 'Fish4Jobs RSS' },
  { url: 'https://www.careerjet.co.uk/jobs/rss', title: 'CareerJet RSS' },
  { url: 'https://www.adzuna.co.uk/jobs/rss', title: 'Adzuna RSS' },
  
  // Graduate/University boards
  { url: 'https://www.gradcracker.com/feed', title: 'Gradcracker RSS' },
  { url: 'https://www.prospects.ac.uk/jobs/rss', title: 'Prospects RSS' },
  { url: 'https://targetjobs.co.uk/jobs/rss', title: 'TARGETjobs RSS' },
  { url: 'https://www.milkround.com/jobs/rss', title: 'Milkround RSS' },
  
  // Industry-specific
  { url: 'https://www.efinancialcareers.co.uk/jobs/rss', title: 'eFinancialCareers RSS' },
  { url: 'https://www.cwjobs.co.uk/jobs/rss', title: 'CWJobs RSS' },
  { url: 'https://www.jobserve.com/jobs/rss', title: 'Jobserve RSS' },
  
  // Government
  { url: 'https://www.civilservicejobs.service.gov.uk/rss', title: 'Civil Service Jobs RSS' },
  { url: 'https://www.jobs.nhs.uk/rss', title: 'NHS Jobs RSS' },
  { url: 'https://www.findajob.dwp.gov.uk/rss', title: 'Find a Job RSS' },
];

/**
 * Scrape jobs from RSS feeds
 */
export async function scrapeRSSFeeds(): Promise<CanonicalJob[]> {
  console.log('🚀 Starting RSS feed scraping...');
  const allJobs: CanonicalJob[] = [];
  const seenHashes = new Set<string>();

  // Use Perplexity to discover additional RSS feed URLs
  let allFeeds = [...KNOWN_RSS_FEEDS];
  try {
    const { discoverUrlsWithPerplexity } = await import('../lib/perplexityUrlDiscovery');
    const discoveredFeeds = await discoverUrlsWithPerplexity('rss', 'rss-feeds', 'RSS Feeds');
    discoveredFeeds.forEach(url => {
      if (!allFeeds.some(f => f.url === url)) {
        allFeeds.push({ url, title: `Discovered RSS Feed` });
      }
    });
    if (discoveredFeeds.length > 0) {
      console.log(`🤖 Perplexity discovered ${discoveredFeeds.length} additional RSS feed URLs`);
    }
  } catch (error) {
    console.log(`⚠️  Perplexity RSS discovery failed, using known feeds only`);
  }

  // In test mode, limit to 1 feed
  const feedsToProcess = isTestMode() ? allFeeds.slice(0, 1) : allFeeds;
  console.log(`\n📡 Processing ${feedsToProcess.length} RSS feeds (${isTestMode() ? 'TEST MODE: 1 feed only' : `${KNOWN_RSS_FEEDS.length} known + ${allFeeds.length - KNOWN_RSS_FEEDS.length} discovered`})...`);
  for (const feed of feedsToProcess) {
    try {
      console.log(`  🔄 Fetching ${feed.title || feed.url}...`);
      const items = await parseRSSFeed(feed.url);
      
      if (items.length === 0) {
        console.log(`    ⚠️  No items found in feed`);
        continue;
      }

      console.log(`    📦 Found ${items.length} items`);

      const sourceName = feed.title?.toLowerCase().replace(/\s+/g, '-') || new URL(feed.url).hostname.replace(/^www\./, '');
      
      for (const item of items) {
        try {
          const job = await convertRSSItemToJob(item, feed.url, sourceName);
          if (!job) continue;

          // Deduplicate
          if (seenHashes.has(job.hash)) continue;
          seenHashes.add(job.hash);

          allJobs.push(job);
        } catch (error) {
          console.warn(`    ⚠️  Failed to convert RSS item:`, error instanceof Error ? error.message : String(error));
        }
      }

      // Small delay between feeds
      await new Promise(resolve => setTimeout(resolve, 1000));
    } catch (error) {
      console.warn(`  ❌ Failed to process RSS feed ${feed.url}:`, error instanceof Error ? error.message : String(error));
    }
  }

  // Discover and process RSS feeds from job board domains
  console.log(`\n🔍 Discovering RSS feeds from job board domains...`);
  const domainsToCheck = new Set<string>();

  // Extract domains from sitemap URLs
  [...MAJOR_JOB_BOARDS, ...ENGINEERING_JOB_BOARDS, ...TECH_JOB_BOARDS, ...FINANCE_JOB_BOARDS, ...CONSULTING_JOB_BOARDS, ...UNIVERSITY_BOARDS].forEach(sitemapUrl => {
    try {
      const url = new URL(sitemapUrl);
      domainsToCheck.add(`${url.protocol}//${url.hostname}`);
    } catch {
      // Ignore invalid URLs
    }
  });

  // In test mode, skip domain discovery
  let discoveredFeeds = 0;
  if (!isTestMode()) {
    for (const domain of Array.from(domainsToCheck).slice(0, 50)) { // Limit to 50 domains to avoid timeout
      try {
        const feeds = await discoverRSSFeeds(domain);
        if (feeds.length === 0) continue;

        discoveredFeeds += feeds.length;
        console.log(`  ✅ Discovered ${feeds.length} RSS feed(s) from ${domain}`);

        for (const feed of feeds) {
          try {
            const items = await parseRSSFeed(feed.url);
            if (items.length === 0) continue;

            const sourceName = new URL(feed.url).hostname.replace(/^www\./, '');
            
            for (const item of items) {
              try {
                const job = await convertRSSItemToJob(item, feed.url, sourceName);
                if (!job) continue;

                // Deduplicate
                if (seenHashes.has(job.hash)) continue;
                seenHashes.add(job.hash);

                allJobs.push(job);
              } catch {
                // Ignore conversion errors
              }
            }

            // Small delay between feeds
            await new Promise(resolve => setTimeout(resolve, 1000));
          } catch (error) {
            console.warn(`    ⚠️  Failed to process discovered feed ${feed.url}:`, error instanceof Error ? error.message : String(error));
          }
        }
      } catch (error) {
        console.warn(`  ⚠️  Failed to discover feeds from ${domain}:`, error instanceof Error ? error.message : String(error));
      }
    }
  } else {
    console.log(`  ⏭️  Skipping domain discovery in test mode`);
  }

  console.log(`\n✅ RSS feed scraping completed:`);
  console.log(`   📊 Processed ${feedsToProcess.length} feed(s)${isTestMode() ? ' (TEST MODE)' : ''}`);
  if (!isTestMode()) {
    console.log(`   🔍 Discovered ${discoveredFeeds} additional feeds`);
  }
  console.log(`   📦 Total jobs collected: ${allJobs.length}`);

  return allJobs;
}

