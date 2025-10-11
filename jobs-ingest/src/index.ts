import { scrapeGreenhouse } from './sources/greenhouse';
import { scrapeLever } from './sources/lever';
import { scrapeWorkday } from './sources/workday';
import { scrapeSuccessFactors } from './sources/successfactors';
import { scrapeICIMS } from './sources/icims';
import { scrapeUKCompany } from './sources/ukCompanies';
import { scrapeFromUrls } from './sources/sitemapGeneric';
import { discoverJobUrls, discoverCompanyJobPages } from './sources/sitemapDiscovery';
import { scrapeGradcracker } from './sources/gradcracker';
import { scrapeHighVolumeBoard } from './sources/highVolumeBoards';
import { scrapeJoblift } from './sources/joblift';
import { scrapeSaveTheStudent } from './sources/savethestudent';
import { scrapeJobsAcUk } from './sources/jobsacuk';
import { scrapeStudentCircus } from './sources/studentcircus';
import { scrapeGradsmart } from './sources/gradsmart';
import { 
  scrapeTargetJobs, scrapeMilkround, scrapeProspects, scrapeRateMyPlacement,
  scrapeBrightNetwork, scrapeStudentJobUK, scrapeE4S, scrapeRateMyApprenticeship,
  scrapeWorkInStartups, scrapeTotalJobs, scrapeReed, scrapeEscapeTheCity
} from './sources/jobBoards';
import { 
  scrapeWorkingJobBoards, scrapeIndeedUK, scrapeReedWorking 
} from './sources/workingJobBoards';
import { scrapeOptimizedJobBoards } from './sources/optimizedJobBoards';
import { upsertJobs, testAuth } from './lib/strapi';
import { llmAssist } from './lib/llm';
import { validateJobRequirements, cleanJobDescription, isJobFresh, isUKJob, isRelevantJobType } from './lib/normalize';
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
  const sourceStats: Record<string, { total: number; valid: number; invalid: number }> = {};

  console.log(`🚀 Starting enhanced job ingestion at ${startTime.toISOString()}`);
  console.log(`🎯 Target: 100+ useful jobs per run`);
  
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
      // Initialize source stats
      if (!sourceStats[source]) {
        sourceStats[source] = { total: 0, valid: 0, invalid: 0 };
      }
      
      try {
        let sourceJobs: any[] = [];
        console.log(`  🔄 Scraping source: ${source}...`);
        
        // Route to appropriate scraper based on source type
        if (source.startsWith('greenhouse:')) {
          const board = source.replace('greenhouse:', '');
          console.log(`🔄 Scraping Greenhouse: ${board}`);
          sourceJobs = await limiter.schedule(() => scrapeGreenhouse(board));
        } else if (source.startsWith('lever:')) {
          const company = source.replace('lever:', '');
          console.log(`🔄 Scraping Lever: ${company}`);
          sourceJobs = await limiter.schedule(() => scrapeLever(company));
        } else if (GREENHOUSE_BOARDS.includes(source)) {
          console.log(`🔄 Scraping Greenhouse: ${source}`);
          sourceJobs = await limiter.schedule(() => scrapeGreenhouse(source));
        } else if (LEVER_COMPANIES.includes(source)) {
          console.log(`🔄 Scraping Lever: ${source}`);
          sourceJobs = await limiter.schedule(() => scrapeLever(source));
        } else if (source.startsWith('workday:')) {
          const company = source.replace('workday:', '');
          console.log(`🔄 Scraping Workday: ${company}`);
          sourceJobs = await limiter.schedule(() => scrapeWorkday(company));
        } else if (source.startsWith('successfactors:')) {
          const company = source.replace('successfactors:', '');
          console.log(`🔄 Scraping SuccessFactors: ${company}`);
          sourceJobs = await limiter.schedule(() => scrapeSuccessFactors(company));
        } else if (source.startsWith('icims:')) {
          const company = source.replace('icims:', '');
          console.log(`🔄 Scraping iCIMS: ${company}`);
          sourceJobs = await limiter.schedule(() => scrapeICIMS(company));
        } else if (source.startsWith('uk-company:')) {
          const company = source.replace('uk-company:', '');
          console.log(`🔄 Scraping UK Company: ${company}`);
          sourceJobs = await limiter.schedule(() => scrapeUKCompany(company));
        } else if (ALL_JOB_BOARDS.some(board => source.includes(board))) {
          console.log(`🔄 Scraping Job Board: ${source}`);
          // First discover job URLs from sitemap, then scrape them
          const jobUrls = await discoverJobUrls(source, 100);
          console.log(`📊 Found ${jobUrls.length} job URLs from ${source}`);
          if (jobUrls.length > 0) {
            sourceJobs = await limiter.schedule(() => scrapeFromUrls(jobUrls.slice(0, 50), 'sitemap:jobboards'));
          } else {
            sourceJobs = [];
          }
        } else if (ENGINEERING_COMPANIES.includes(source) || TECH_COMPANIES.includes(source) || 
                   FINANCE_COMPANIES.includes(source) || CONSULTING_COMPANIES.includes(source) ||
                   MANUFACTURING_COMPANIES.includes(source) || ENERGY_COMPANIES.includes(source)) {
          console.log(`🔄 Scraping Company Career Page: ${source}`);
          sourceJobs = await limiter.schedule(() => scrapeUKCompany(source));
        } else if (source === 'gradcracker') {
          console.log(`🔄 Scraping Gradcracker (High Volume)`);
          sourceJobs = await limiter.schedule(() => scrapeGradcracker());
        } else if (source === 'joblift') {
          console.log(`🔄 Scraping Joblift (High Volume)`);
          sourceJobs = await limiter.schedule(() => scrapeJoblift());
        } else if (source === 'savethestudent') {
          console.log(`🔄 Scraping Save the Student (High Volume)`);
          sourceJobs = await limiter.schedule(() => scrapeSaveTheStudent());
        } else if (source === 'jobsacuk') {
          console.log(`🔄 Scraping jobs.ac.uk (High Volume)`);
          sourceJobs = await limiter.schedule(() => scrapeJobsAcUk());
        } else if (source === 'studentcircus') {
          console.log(`🔄 Scraping Student Circus (High Volume)`);
          sourceJobs = await limiter.schedule(() => scrapeStudentCircus());
        } else if (source === 'gradsmart') {
          console.log(`🔄 Scraping Gradsmart (High Volume)`);
          sourceJobs = await limiter.schedule(() => scrapeGradsmart());
        } else if (source === 'targetjobs') {
          console.log(`🔄 Scraping TARGETjobs`);
          sourceJobs = await limiter.schedule(() => scrapeTargetJobs());
        } else if (source === 'milkround') {
          console.log(`🔄 Scraping Milkround`);
          sourceJobs = await limiter.schedule(() => scrapeMilkround());
        } else if (source === 'prospects') {
          console.log(`🔄 Scraping Prospects`);
          sourceJobs = await limiter.schedule(() => scrapeProspects());
        } else if (source === 'ratemyplacement') {
          console.log(`🔄 Scraping RateMyPlacement`);
          sourceJobs = await limiter.schedule(() => scrapeRateMyPlacement());
        } else if (source === 'brightnetwork') {
          console.log(`🔄 Scraping BrightNetwork`);
          sourceJobs = await limiter.schedule(() => scrapeBrightNetwork());
        } else if (source === 'studentjob') {
          console.log(`🔄 Scraping StudentJob UK`);
          sourceJobs = await limiter.schedule(() => scrapeStudentJobUK());
        } else if (source === 'e4s') {
          console.log(`🔄 Scraping Employment 4 Students`);
          sourceJobs = await limiter.schedule(() => scrapeE4S());
        } else if (source === 'ratemyapprenticeship') {
          console.log(`🔄 Scraping RateMyApprenticeship`);
          sourceJobs = await limiter.schedule(() => scrapeRateMyApprenticeship());
        } else if (source === 'workinstartups') {
          console.log(`🔄 Scraping WorkInStartups`);
          sourceJobs = await limiter.schedule(() => scrapeWorkInStartups());
        } else if (source === 'totaljobs') {
          console.log(`🔄 Scraping Totaljobs`);
          sourceJobs = await limiter.schedule(() => scrapeTotalJobs());
        } else if (source === 'reed') {
          console.log(`🔄 Scraping Reed`);
          sourceJobs = await limiter.schedule(() => scrapeReed());
        } else if (source === 'escapethecity') {
          console.log(`🔄 Scraping Escape the City`);
          sourceJobs = await limiter.schedule(() => scrapeEscapeTheCity());
        } else if (source === 'indeed-uk') {
          console.log(`🔄 Scraping Indeed UK`);
          sourceJobs = await limiter.schedule(() => scrapeIndeedUK());
        } else if (source === 'reed-working') {
          console.log(`🔄 Scraping Reed Working`);
          sourceJobs = await limiter.schedule(() => scrapeReedWorking());
        } else if (source === 'working-boards') {
          console.log(`🔄 Scraping Working Job Boards`);
          sourceJobs = await limiter.schedule(() => scrapeWorkingJobBoards());
        } else if (source === 'optimized-boards') {
          console.log(`🔄 Scraping Optimized Job Boards`);
          sourceJobs = await limiter.schedule(() => scrapeOptimizedJobBoards());
        } else if (source.startsWith('high-volume:')) {
          const boardName = source.replace('high-volume:', '');
          console.log(`🔄 Scraping High Volume Board: ${boardName}`);
          sourceJobs = await limiter.schedule(() => scrapeHighVolumeBoard(boardName));
        } else if (ALL_JOB_BOARDS.some(board => source.includes(board))) {
          console.log(`🔄 Scraping Job Board Sitemap: ${source}`);
          // First discover job URLs from sitemap, then scrape them
          const jobUrls = await discoverJobUrls(source, 100);
          console.log(`📊 Found ${jobUrls.length} job URLs from ${source}`);
          if (jobUrls.length > 0) {
            sourceJobs = await limiter.schedule(() => scrapeFromUrls(jobUrls.slice(0, 50), 'sitemap:jobboards'));
          } else {
            sourceJobs = [];
          }
        } else {
          console.log(`⚠️  Unknown source type: ${source}`);
          continue;
        }

        // Update source stats
        sourceStats[source].total = sourceJobs.length;

        // Validate and filter jobs with detailed logging
        const validJobs = sourceJobs.filter(job => {
          // Check if job is fresh (relaxed to 90 days)
          if (!isJobFresh(job, 90)) {
            sourceStats[source].invalid++;
            return false;
          }

          // Basic validation only
          if (!job.title || !job.company?.name || !job.applyUrl) {
            sourceStats[source].invalid++;
            return false;
          }

          // Check UK location
          const fullText = `${job.title} ${job.descriptionText || job.descriptionHtml || ''} ${job.location || ''}`;
          if (!isUKJob(fullText)) {
            sourceStats[source].invalid++;
            return false;
          }

          // Check job type
          if (!isRelevantJobType(fullText)) {
            sourceStats[source].invalid++;
            return false;
          }

          sourceStats[source].valid++;
          return true;
        });

        totalJobsFound += validJobs.length;
        
        if (sourceJobs.length > 0) {
          console.log(`  ✅ ${source}: ${sourceJobs.length} scraped → ${validJobs.length} valid (${Math.round(validJobs.length / sourceJobs.length * 100)}% pass rate)`);
        } else {
          console.log(`  ⚠️  ${source}: 0 jobs found`);
        }

        // Add to batches for processing
        if (validJobs.length > 0) {
          batches.push(validJobs);
        }

      } catch (error) {
        console.error(`  ❌ Failed to scrape ${source}:`, error instanceof Error ? error.message : String(error));
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
  
  // Print source performance report
  console.log(`\n📈 Source Performance Report:`);
  console.log(`${'='.repeat(80)}`);
  
  // Sort sources by valid jobs count (descending)
  const sortedSources = Object.entries(sourceStats)
    .filter(([_, stats]) => stats.total > 0)
    .sort((a, b) => b[1].valid - a[1].valid);
  
  if (sortedSources.length > 0) {
    console.log(`${'Source'.padEnd(40)} ${'Total'.padEnd(8)} ${'Valid'.padEnd(8)} ${'Pass Rate'}`);
    console.log(`${'-'.repeat(80)}`);
    
    for (const [source, stats] of sortedSources) {
      const passRate = stats.total > 0 ? Math.round((stats.valid / stats.total) * 100) : 0;
      const sourceName = source.length > 38 ? source.substring(0, 35) + '...' : source;
      console.log(`${sourceName.padEnd(40)} ${String(stats.total).padEnd(8)} ${String(stats.valid).padEnd(8)} ${passRate}%`);
    }
    
    console.log(`${'-'.repeat(80)}`);
    console.log(`Top 3 sources:`);
    sortedSources.slice(0, 3).forEach(([source, stats], idx) => {
      console.log(`  ${idx + 1}. ${source}: ${stats.valid} valid jobs`);
    });
    
    // Identify sources with 0 results
    const zeroResultSources = Object.entries(sourceStats)
      .filter(([_, stats]) => stats.total === 0)
      .map(([source, _]) => source);
    
    if (zeroResultSources.length > 0) {
      console.log(`\n⚠️  Sources with 0 results (${zeroResultSources.length}):`);
      zeroResultSources.forEach(source => console.log(`  - ${source}`));
    }
  }
  
  console.log(`${'='.repeat(80)}`);
  
  // Check if we met the target
  if (totalIngested >= 100) {
    console.log(`\n✅ SUCCESS: Target of 100+ jobs met! (${totalIngested} jobs ingested)`);
  } else {
    console.log(`\n⚠️  WARNING: Target of 100+ jobs not met. Only ${totalIngested} jobs ingested.`);
    console.log(`   Consider enabling more high-yield sources or adjusting filters.`);
  }
}

runAll().catch(e => {
  console.error(e);
  process.exit(1);
});
