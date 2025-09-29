import { scrapeGreenhouse } from './sources/greenhouse';
import { scrapeLever } from './sources/lever';
import { scrapeWorkday } from './sources/workday';
import { scrapeSuccessFactors } from './sources/successfactors';
import { scrapeICIMS } from './sources/icims';
import { scrapeUKCompany } from './sources/ukCompanies';
import { scrapeFromUrls } from './sources/sitemapGeneric';
import { discoverJobUrls, discoverCompanyJobPages } from './sources/sitemapDiscovery';
import { upsertJobs, testAuth } from './lib/strapi';
import { llmAssist } from './lib/llm';
import { validateJobRequirements, cleanJobDescription, isJobFresh } from './lib/normalize';
import { getBucketsForToday, shouldExitEarly, getRateLimitForDomain } from './lib/rotation';
import { 
  GREENHOUSE_BOARDS, 
  LEVER_COMPANIES, 
  ALL_JOB_BOARDS, 
  ALL_COMPANIES,
  ENGINEERING_COMPANIES,
  TECH_COMPANIES,
  FINANCE_COMPANIES,
  CONSULTING_COMPANIES,
  MANUFACTURING_COMPANIES,
  ENERGY_COMPANIES
} from './config/sources';
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
  const startTime = new Date();
  const batches = [];
  let totalJobsFound = 0;

  console.log(`🚀 Starting enhanced job ingestion at ${startTime.toISOString()}`);
  
  // Get today's crawl buckets
  const todaysBuckets = getBucketsForToday();
  console.log(`📅 Today's crawl buckets: ${todaysBuckets.map(b => b.name).join(', ')}`);

  // Test authentication first
  console.log('🔐 Testing authentication...');
  const authOk = await testAuth();
  if (!authOk) {
    console.error('❌ Authentication failed! Check your STRAPI_INGEST_SECRET environment variable.');
    process.exit(1);
  }
  console.log('✅ Authentication successful!');

  // Process each bucket
  for (const bucket of todaysBuckets) {
    console.log(`\n📦 Processing bucket: ${bucket.name}`);
    
    // Check for early exit
    if (shouldExitEarly(totalJobsFound, startTime)) {
      console.log('⏰ Early exit triggered, stopping crawl');
      break;
    }

    for (const source of bucket.sources) {
      try {
        let sourceJobs: any[] = [];
        
        // Route to appropriate scraper
        if (GREENHOUSE_BOARDS.includes(source)) {
          sourceJobs = await limiter.schedule(() => scrapeGreenhouse(source));
        } else if (LEVER_COMPANIES.includes(source)) {
          sourceJobs = await limiter.schedule(() => scrapeLever(source));
        } else if (source.startsWith('workday:')) {
          const company = source.replace('workday:', '');
          sourceJobs = await limiter.schedule(() => scrapeWorkday(company));
        } else if (source.startsWith('successfactors:')) {
          const company = source.replace('successfactors:', '');
          sourceJobs = await limiter.schedule(() => scrapeSuccessFactors(company));
        } else if (source.startsWith('icims:')) {
          const company = source.replace('icims:', '');
          sourceJobs = await limiter.schedule(() => scrapeICIMS(company));
        } else if (source.startsWith('uk-company:')) {
          const company = source.replace('uk-company:', '');
          sourceJobs = await limiter.schedule(() => scrapeUKCompany(company));
        } else if (SITEMAP_SOURCES.includes(source)) {
          sourceJobs = await limiter.schedule(() => scrapeFromUrls([source], 'sitemap:jobboards'));
        } else if (COMPANY_CAREER_SITEMAPS.includes(source)) {
          sourceJobs = await limiter.schedule(() => scrapeFromUrls([source], 'sitemap:companies'));
        } else if (MANUAL_URLS.includes(source)) {
          sourceJobs = await limiter.schedule(() => scrapeFromUrls([source], 'site:manual'));
        }

        // Validate and filter jobs
        const validJobs = sourceJobs.filter(job => {
          // Check if job is fresh
          if (!isJobFresh(job, 30)) {
            console.log(`⏭️  Skipping stale job: ${job.title}`);
            return false;
          }

          // Validate job requirements
          const validation = validateJobRequirements(job);
          if (!validation.valid) {
            console.log(`⏭️  Skipping invalid job: ${job.title} - ${validation.reason}`);
            return false;
          }

          return true;
        });

        totalJobsFound += validJobs.length;
        console.log(`✅ ${source}: ${sourceJobs.length} total, ${validJobs.length} valid jobs`);

        // Add to batches for processing
        if (validJobs.length > 0) {
          batches.push(validJobs);
        }

      } catch (error) {
        console.warn(`❌ Failed to scrape ${source}:`, error instanceof Error ? error.message : String(error));
      }
    }
  }

  // Flatten all results
  const results = batches.flat();
  console.log(`\n📊 Total valid jobs found: ${results.length}`);

  // Enhanced LLM processing with better validation
  console.log('🤖 Processing job descriptions with LLM...');
  let llmProcessed = 0;
  const llmPromises = results.map(async (j) => {
    if (!j.descriptionText && j.descriptionHtml) {
      try {
        const plain = await llmAssist({
          instruction: 'Convert HTML job description to clean plain text. Remove boilerplate, keep essential information, and limit to ~1200 characters.',
          text: j.descriptionHtml,
          maxOut: 300
        });
        if (plain) {
          j.descriptionText = cleanJobDescription(plain);
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

  // Enhanced upsert with better error handling
  console.log('💾 Ingesting jobs to Strapi...');
  const BATCH_SIZE = SCALE_CONFIG.INGEST_BATCH_SIZE;
  let totalIngested = 0;
  let totalSkipped = 0;

  for (let i = 0; i < results.length; i += BATCH_SIZE) {
    const batch = results.slice(i, i + BATCH_SIZE);
    try {
      const r = await upsertJobs(batch);
      const count = (r as any)?.count ?? batch.length;
      const skipped = batch.length - count;
      totalIngested += count;
      totalSkipped += skipped;
      console.log(`📦 Ingested batch ${Math.floor(i/BATCH_SIZE) + 1}/${Math.ceil(results.length/BATCH_SIZE)}: ${count} jobs (${skipped} skipped)`);
    } catch (error) {
      console.error(`❌ Failed to ingest batch ${Math.floor(i/BATCH_SIZE) + 1}:`, error);
    }
  }

  const duration = Math.round((Date.now() - startTime.getTime()) / 1000);
  console.log(`\n🎉 Enhanced job ingestion completed!`);
  console.log(`📊 Total jobs found: ${results.length}`);
  console.log(`📊 Total jobs ingested: ${totalIngested}`);
  console.log(`📊 Total jobs skipped: ${totalSkipped}`);
  console.log(`⏱️  Duration: ${duration}s`);
  console.log(`🚀 Rate: ${Math.round(totalIngested / duration)} jobs/second`);
}

runAll().catch(e => {
  console.error(e);
  process.exit(1);
});
