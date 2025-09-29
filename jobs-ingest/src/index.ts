import { scrapeGreenhouse } from './sources/greenhouse';
import { scrapeLever } from './sources/lever';
import { scrapeFromUrls } from './sources/sitemapGeneric';
import { discoverJobUrls, discoverCompanyJobPages } from './sources/sitemapDiscovery';
import { upsertJobs, testAuth } from './lib/strapi';
import { llmAssist } from './lib/llm';
import { GREENHOUSE_BOARDS, LEVER_COMPANIES, MANUAL_URLS, SITEMAP_SOURCES, COMPANY_CAREER_SITEMAPS } from './config/sources';
import { SCALE_CONFIG } from './config/scale';
import Bottleneck from 'bottleneck';

// Rate limiter for respectful scraping
const limiter = new Bottleneck({
  maxConcurrent: SCALE_CONFIG.MAX_CONCURRENT,
  minTime: SCALE_CONFIG.MIN_TIME_BETWEEN,
  reservoir: SCALE_CONFIG.RESERVOIR_SIZE,
  reservoirRefreshAmount: SCALE_CONFIG.RESERVOIR_SIZE,
  reservoirRefreshInterval: SCALE_CONFIG.RESERVOIR_REFILL * 1000,
});

async function runAll() {
  const startTime = Date.now();
  const batches = [];

  console.log(`🚀 Starting job ingestion at ${new Date().toISOString()}`);
  console.log(`📊 Target sources: ${GREENHOUSE_BOARDS.length} Greenhouse, ${LEVER_COMPANIES.length} Lever, ${MANUAL_URLS.length} Manual URLs`);

  // Test authentication first
  console.log('🔐 Testing authentication...');
  const authOk = await testAuth();
  if (!authOk) {
    console.error('❌ Authentication failed! Check your STRAPI_INGEST_SECRET environment variable.');
    process.exit(1);
  }
  console.log('✅ Authentication successful!');

  // 1) ATS sources (configure in config/sources.ts) - These are fast API calls
  console.log('📡 Scraping ATS sources...');
  for (const board of GREENHOUSE_BOARDS) {
    batches.push(limiter.schedule(() => scrapeGreenhouse(board)));
  }
  
  for (const company of LEVER_COMPANIES) {
    batches.push(limiter.schedule(() => scrapeLever(company)));
  }

  // 2) Major job board sitemaps (high volume)
  if (SITEMAP_SOURCES.length > 0) {
    console.log(`📋 Scraping ${SITEMAP_SOURCES.length} job board sitemaps...`);
    batches.push(limiter.schedule(() => scrapeFromUrls(SITEMAP_SOURCES, 'sitemap:jobboards')));
  }

  // 3) Company career page sitemaps
  if (COMPANY_CAREER_SITEMAPS.length > 0) {
    console.log(`🏢 Scraping ${COMPANY_CAREER_SITEMAPS.length} company career sitemaps...`);
    batches.push(limiter.schedule(() => scrapeFromUrls(COMPANY_CAREER_SITEMAPS, 'sitemap:companies')));
  }

  // 4) Manual URLs (specific job pages)
  if (MANUAL_URLS.length > 0) {
    console.log(`🌐 Scraping ${MANUAL_URLS.length} manual URLs...`);
    batches.push(limiter.schedule(() => scrapeFromUrls(MANUAL_URLS, 'site:manual')));
  }

  // 5) Large-scale discovery mode (if enabled)
  if (process.env.ENABLE_DISCOVERY === 'true') {
    console.log('🔍 Large-scale job discovery enabled...');
    const discoveryDomains = process.env.DISCOVERY_DOMAINS?.split(',') || [];
    
    for (const domain of discoveryDomains) {
      console.log(`🔍 Discovering jobs from ${domain}...`);
      try {
        const discoveredUrls = await discoverJobUrls(domain, 5000);
        if (discoveredUrls.length > 0) {
          console.log(`✅ Found ${discoveredUrls.length} job URLs from ${domain}`);
          batches.push(limiter.schedule(() => scrapeFromUrls(discoveredUrls, `site:${domain}`)));
        }
      } catch (error) {
        console.warn(`❌ Failed to discover jobs from ${domain}:`, error instanceof Error ? error.message : String(error));
      }
    }
  }

  console.log(`⏳ Processing ${batches.length} source batches...`);
  
  const results = (await Promise.all(batches)).flat();
  console.log(`✅ Scraped ${results.length} jobs from all sources`);

  // Optional LLM cleanup: descriptionText + fallback jobType/salary if unknown
  console.log('🤖 Processing job descriptions with LLM...');
  let llmProcessed = 0;
  const llmPromises = results.map(async (j) => {
    if (!j.descriptionText && j.descriptionHtml) {
      try {
        const plain = await llmAssist({
          instruction: 'Convert HTML job description to clean plain text. Keep lists as bullets and limit to ~1200 characters.',
          text: j.descriptionHtml,
          maxOut: 300
        });
        if (plain) {
          j.descriptionText = plain;
          llmProcessed++;
        }
      } catch (error) {
        console.warn(`LLM processing failed for job ${j.slug}:`, error);
      }
    }
  });
  
  await Promise.all(llmPromises);
  
  if (llmProcessed > 0) {
    console.log(`✅ LLM processed ${llmProcessed} job descriptions`);
  }

  // Push to Strapi in batches to avoid memory issues
  console.log('💾 Ingesting jobs to Strapi...');
  const BATCH_SIZE = SCALE_CONFIG.INGEST_BATCH_SIZE;
  let totalIngested = 0;
  
  for (let i = 0; i < results.length; i += BATCH_SIZE) {
    const batch = results.slice(i, i + BATCH_SIZE);
    try {
      const r = await upsertJobs(batch);
      const count = (r as any)?.count ?? batch.length;
      totalIngested += count;
      console.log(`📦 Ingested batch ${Math.floor(i/BATCH_SIZE) + 1}/${Math.ceil(results.length/BATCH_SIZE)}: ${count} jobs`);
    } catch (error) {
      console.error(`❌ Failed to ingest batch ${Math.floor(i/BATCH_SIZE) + 1}:`, error);
    }
  }
  
  const duration = Math.round((Date.now() - startTime) / 1000);
  console.log(`🎉 Job ingestion completed!`);
  console.log(`📊 Total jobs ingested: ${totalIngested}`);
  console.log(`⏱️  Duration: ${duration}s`);
  console.log(`🚀 Rate: ${Math.round(totalIngested / duration)} jobs/second`);
}

runAll().catch(e => {
  console.error(e);
  process.exit(1);
});
