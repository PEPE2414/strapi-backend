import { scrapeGreenhouse } from './sources/greenhouse';
import { scrapeLever } from './sources/lever';
import { scrapeWorkable } from './sources/workable';
import { scrapeAshby } from './sources/ashby';
import { scrapeTeamtailor } from './sources/teamtailor';
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
  scrapeTrackr, scrapeBrightNetwork, scrapeStudentJobUK, scrapeE4S, scrapeRateMyApprenticeship,
  scrapeWorkInStartups, scrapeTotalJobs, scrapeReed, scrapeEscapeTheCity
} from './sources/jobBoards';
import { 
  scrapeWorkingJobBoards, scrapeIndeedUK, scrapeReedWorking 
} from './sources/workingJobBoards';
import { scrapeOptimizedJobBoards } from './sources/optimizedJobBoards';
import { scrapeAllAPIJobBoards, scrapeUniversityFeedsOnly } from './sources/apiJobBoards';
import { scrapeRapidAPILinkedInJobs } from './sources/rapidapiLinkedInJobs';
import { scrapeGraduateBoardsDirect } from './lib/directGraduateScraper';
import { scrapeGraduateBoardsHybrid } from './lib/hybridGraduateScraper';
import { scrapeFinanceBankCareers } from './sources/financeBankCareers';
import { upsertJobs, testAuth } from './lib/strapi';
import { llmAssist } from './lib/llm';
import { validateJobRequirements, cleanJobDescription, isUKJob, isRelevantJobType } from './lib/normalize';
import { getBucketsForToday, getRateLimitForDomain } from './lib/rotation';
import { getCurrentRunSlot, isBacklogSlot } from './lib/runSlots';
import { enhanceJobDescriptions } from './lib/descriptionEnhancer';
import { loadSeenTodayCache, saveSeenTodayCache, isJobNewToday, wasSeenRecently } from './lib/seenTodayCache';
import { CanonicalJob } from './types';
import { summarizeRapidApiUsage, getRapidApiUsage } from './lib/rapidapiUsage';
import { 
  GREENHOUSE_BOARDS, 
  LEVER_COMPANIES, 
  WORKABLE_COMPANIES,
  ASHBY_COMPANIES,
  TEAMTAILOR_COMPANIES,
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
  // Support MAX_RUNTIME_MINUTES env var, default to 5 hours (300 minutes)
  const maxRuntimeMinutes = process.env.MAX_RUNTIME_MINUTES 
    ? parseInt(process.env.MAX_RUNTIME_MINUTES, 10) 
    : 300; // 5 hours default
  const MAX_RUNTIME_MS = maxRuntimeMinutes * 60 * 1000;
  const batches: CanonicalJob[][] = [];
  const seenTodayCache = await loadSeenTodayCache();
  let seenTodaySkippedTotal = 0;
  const backlogRun = isBacklogSlot(getCurrentRunSlot().slotIndex);
  let totalJobsFound = 0;
  let totalRecentRejected = 0;
  const sourceStats: Record<string, { total: number; valid: number; invalid: number }> = {};

  // Support both INGEST_MODE and CRAWL_TYPE (for GitHub Actions compatibility)
  const ingestMode = process.env.INGEST_MODE || (process.env.CRAWL_TYPE === 'focused' ? 'focused' : 'full');
  console.log(`🚀 Starting enhanced job ingestion at ${startTime.toISOString()}`);
  console.log(`⏱️  Maximum runtime: ${maxRuntimeMinutes} minutes (${(maxRuntimeMinutes / 60).toFixed(1)} hours)`);
  console.log(`🎯 Mode: ${ingestMode.toUpperCase()} ${ingestMode === 'focused' ? '(ATS, RSS, Sitemaps, Graduate Boards, University Feeds only)' : '(all sources)'}`);
  console.log(`🎯 Target: 1000+ useful jobs per run (new API-based strategy)`);
  
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
  let timeLimitReached = false;
  for (const bucket of todaysBuckets) {
    if (timeLimitReached) break;
    
    console.log(`\n📦 Processing bucket: ${bucket.name}`);

    for (const source of bucket.sources) {
      // Check if we've exceeded the time limit
      const elapsed = Date.now() - startTime.getTime();
      // Check time limit with 5-minute buffer to allow graceful shutdown
      const timeBuffer = 5 * 60 * 1000; // 5 minutes
      if (elapsed >= (MAX_RUNTIME_MS - timeBuffer)) {
        const elapsedMinutes = Math.floor(elapsed / (60 * 1000));
        const elapsedHours = (elapsed / (60 * 60 * 1000)).toFixed(2);
        console.log(`\n⏱️  Time limit approaching (${maxRuntimeMinutes} minutes). Elapsed: ${elapsedMinutes} minutes (${elapsedHours} hours)`);
        console.log(`🛑 Stopping scraping and proceeding to upload collected results...`);
        timeLimitReached = true;
        break;
      }
      
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
        } else if (source.startsWith('workable:')) {
          const company = source.replace('workable:', '');
          console.log(`🔄 Scraping Workable: ${company}`);
          sourceJobs = await limiter.schedule(() => scrapeWorkable(company));
        } else if (source.startsWith('ashby:')) {
          const company = source.replace('ashby:', '');
          console.log(`🔄 Scraping AshbyHQ: ${company}`);
          sourceJobs = await limiter.schedule(() => scrapeAshby(company));
        } else if (source.startsWith('teamtailor:')) {
          const company = source.replace('teamtailor:', '');
          console.log(`🔄 Scraping Teamtailor: ${company}`);
          sourceJobs = await limiter.schedule(() => scrapeTeamtailor(company));
        } else if (GREENHOUSE_BOARDS.includes(source)) {
          console.log(`🔄 Scraping Greenhouse: ${source}`);
          sourceJobs = await limiter.schedule(() => scrapeGreenhouse(source));
        } else if (LEVER_COMPANIES.includes(source)) {
          console.log(`🔄 Scraping Lever: ${source}`);
          sourceJobs = await limiter.schedule(() => scrapeLever(source));
        } else if (WORKABLE_COMPANIES.includes(source)) {
          console.log(`🔄 Scraping Workable: ${source}`);
          sourceJobs = await limiter.schedule(() => scrapeWorkable(source));
        } else if (ASHBY_COMPANIES.includes(source)) {
          console.log(`🔄 Scraping AshbyHQ: ${source}`);
          sourceJobs = await limiter.schedule(() => scrapeAshby(source));
        } else if (TEAMTAILOR_COMPANIES.includes(source)) {
          console.log(`🔄 Scraping Teamtailor: ${source}`);
          sourceJobs = await limiter.schedule(() => scrapeTeamtailor(source));
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
        } else if (source === 'trackr') {
          console.log(`🔄 Scraping Trackr`);
          sourceJobs = await limiter.schedule(() => scrapeTrackr());
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
        } else if (source === 'api-job-boards') {
          console.log(`🔄 Scraping API Job Boards (Highest Priority)`);
          sourceJobs = await limiter.schedule(() => scrapeAllAPIJobBoards());
        } else if (source === 'university-feeds-only') {
          console.log(`🔄 Scraping University Feeds Only (TargetConnect + JobTeaser)`);
          sourceJobs = await limiter.schedule(() => scrapeUniversityFeedsOnly());
        } else if (source === 'rss-feeds') {
          console.log(`🔄 Scraping RSS Feeds`);
          const { scrapeRSSFeeds } = await import('./sources/rssFeeds');
          sourceJobs = await limiter.schedule(() => scrapeRSSFeeds());
        } else if (source === 'bulk-sitemaps') {
          console.log(`🔄 Scraping Bulk Sitemaps`);
          const { scrapeAllSitemaps } = await import('./sources/bulkSitemapScraper');
          sourceJobs = await limiter.schedule(() => scrapeAllSitemaps());
        } else if (source === 'rapidapi-linkedin-jobs') {
          console.log(`🔄 Scraping RapidAPI + LinkedIn Jobs APIs (High Priority)`);
          sourceJobs = await limiter.schedule(() => scrapeRapidAPILinkedInJobs());
        } else if (source === 'direct-graduate-boards') {
          console.log(`🔄 Direct Scraping Graduate Job Boards (Aggressive)`);
          sourceJobs = await limiter.schedule(() => scrapeGraduateBoardsDirect());
        } else if (source === 'hybrid-graduate-boards') {
          console.log(`🔄 Hybrid Scraping Graduate Job Boards (Multi-Strategy)`);
          sourceJobs = await limiter.schedule(() => scrapeGraduateBoardsHybrid());
        } else if (source === 'finance-bank-careers') {
          console.log(`🔄 Scraping Finance & Bank Career Sites (Weekly)`);
          sourceJobs = await limiter.schedule(() => scrapeFinanceBankCareers());
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
        // API sources (rapidapi-linkedin-jobs) already filter by location and job type
        const isAPISource = source === 'rapidapi-linkedin-jobs';
        
        let freshnessRejected = 0;
        let missingFieldsRejected = 0;
        let locationRejected = 0;
        let jobTypeRejected = 0;
        let recentRejected = 0;
        
        const validJobs = sourceJobs.filter(job => {
          // Basic validation only
          if (!job.title || !job.company?.name || !job.applyUrl) {
            missingFieldsRejected++;
            sourceStats[source].invalid++;
            return false;
          }

          const recentlySeenWindow = backlogRun ? 30 : 7;
          if (wasSeenRecently(job, seenTodayCache, recentlySeenWindow)) {
            recentRejected++;
            sourceStats[source].invalid++;
            return false;
          }

          // For API sources, skip redundant location/job type checks (already filtered by API)
          if (!isAPISource) {
            // Check UK location
            const fullText = `${job.title} ${job.descriptionText || job.descriptionHtml || ''} ${job.location || ''}`;
            if (!isUKJob(fullText)) {
              locationRejected++;
              sourceStats[source].invalid++;
              return false;
            }

            // Check job type
            if (!isRelevantJobType(fullText)) {
              jobTypeRejected++;
              sourceStats[source].invalid++;
              return false;
            }
          } else {
            // For API sources, only verify job type is one of the three valid types
            if (job.jobType && job.jobType !== 'graduate' && job.jobType !== 'placement' && job.jobType !== 'internship') {
              jobTypeRejected++;
              sourceStats[source].invalid++;
              return false;
            }
          }

          sourceStats[source].valid++;
          return true;
        });
        
        // Log rejection reasons for API sources
        if (isAPISource && sourceJobs.length > 0) {
          const totalRejected = freshnessRejected + missingFieldsRejected + locationRejected + jobTypeRejected + recentRejected;
          if (totalRejected > 0) {
            console.log(`  📊 Rejection breakdown: ${freshnessRejected} stale, ${missingFieldsRejected} missing fields, ${locationRejected} location, ${jobTypeRejected} job type, ${recentRejected} recently seen`);
          }
        }

        totalJobsFound += validJobs.length;
        
        if (sourceJobs.length > 0) {
          console.log(`  ✅ ${source}: ${sourceJobs.length} scraped → ${validJobs.length} valid (${Math.round(validJobs.length / sourceJobs.length * 100)}% pass rate)`);
        } else {
          console.log(`  ⚠️  ${source}: 0 jobs found`);
        }

        // Add to batches for processing
        if (validJobs.length > 0) {
          if (backlogRun) {
            batches.push(validJobs);
          } else {
            const freshJobs = validJobs.filter(job => {
              if (isJobNewToday(job, seenTodayCache)) {
                return true;
              }
              return false;
            });

            const skippedToday = validJobs.length - freshJobs.length;
            if (skippedToday > 0) {
              seenTodaySkippedTotal += skippedToday;
              console.log(`  🚫 Already ingested today: ${skippedToday} jobs (keeping ${freshJobs.length})`);
            }

            if (freshJobs.length > 0) {
              batches.push(freshJobs);
            }
          }
        }

        totalRecentRejected += recentRejected;

      } catch (error) {
        console.error(`  ❌ Failed to scrape ${source}:`, error instanceof Error ? error.message : String(error));
      }
    }
  }

  if (timeLimitReached) {
    const elapsed = Date.now() - startTime.getTime();
    const elapsedMinutes = Math.floor(elapsed / (60 * 1000));
    const elapsedHours = (elapsed / (60 * 60 * 1000)).toFixed(2);
    console.log(`\n⏱️  Scraping stopped due to time limit (${maxRuntimeMinutes} minutes, elapsed: ${elapsedMinutes} minutes / ${elapsedHours} hours)`);
    console.log(`📦 Proceeding to process and upload ${batches.flat().length} collected jobs...`);
  }

  // Flatten all results
  const results = batches.flat();
  console.log(`\n📊 Total valid jobs found: ${results.length}`);
  console.log(`📊 Breakdown by source:`);
  Object.entries(sourceStats).forEach(([source, stats]) => {
    if (stats.valid > 0) {
      console.log(`  ${source}: ${stats.valid} valid jobs (${stats.total} total, ${stats.invalid} invalid)`);
    }
  });

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

  // Enhance jobs with NO descriptions by scraping apply URLs
  console.log('\n🔍 Checking for jobs without descriptions...');
  const jobsWithoutDesc = results.filter(j => !j.descriptionText && !j.descriptionHtml).length;
  console.log(`📊 Found ${jobsWithoutDesc} jobs without descriptions`);
  
  if (jobsWithoutDesc > 0) {
    const enhancedCount = await enhanceJobDescriptions(results, 100); // Enhanced all jobs without descriptions (up to 100)
    if (enhancedCount > 0) {
      console.log(`✅ Enhanced ${enhancedCount} job descriptions from apply URLs`);
    }
  } else {
    console.log(`✅ All jobs have descriptions, no enhancement needed`);
  }

  // Enhanced upsert with better error handling
  console.log('💾 Ingesting jobs to Strapi...');
  const BATCH_SIZE = SCALE_CONFIG.INGEST_BATCH_SIZE;
  let totalCreated = 0;
  let totalUpdated = 0;
  let totalSkipped = 0;
  let totalProcessed = 0;

  for (let i = 0; i < results.length; i += BATCH_SIZE) {
    const batch = results.slice(i, i + BATCH_SIZE);
    try {
      const r = await upsertJobs(batch);
      const created = (r as any)?.created ?? 0;
      const updated = (r as any)?.updated ?? 0;
      const skipped = (r as any)?.skipped ?? 0;
      const count = (r as any)?.count ?? (created + updated);
      
      totalCreated += created;
      totalUpdated += updated;
      totalSkipped += skipped;
      totalProcessed += count;
      
      console.log(`📦 Batch ${Math.floor(i/BATCH_SIZE) + 1}/${Math.ceil(results.length/BATCH_SIZE)}: ${created} created, ${updated} updated, ${skipped} skipped`);
    } catch (error) {
      console.error(`❌ Failed to ingest batch ${Math.floor(i/BATCH_SIZE) + 1}:`, error);
    }
  }

  if (seenTodaySkippedTotal > 0) {
    console.log(`🚫 Seen-today cache skipped ${seenTodaySkippedTotal} jobs in this run`);
  }

  const duration = Math.round((Date.now() - startTime.getTime()) / 1000);
  console.log(`\n🎉 Enhanced job ingestion completed!`);
  console.log(`\n📊 Pipeline Summary:`);
  console.log(`  Step 1 - Scraped: ${totalJobsFound} jobs (validated)`);
  console.log(`  Step 2 - After LLM/Enhancement: ${results.length} jobs`);
  console.log(`  Step 3 - Sent to Strapi: ${totalProcessed} jobs (created + updated)`);
  console.log(`  Step 4 - Final Results:`);
  console.log(`    ✅ Created (NEW): ${totalCreated} jobs`);
  console.log(`    🔄 Updated (duplicates): ${totalUpdated} jobs`);
  console.log(`    ⏭️  Skipped: ${totalSkipped} jobs`);
  const jobTypeBreakdown = results.reduce<Record<string, number>>((acc, job) => {
    const type = job.jobType || 'unknown';
    acc[type] = (acc[type] || 0) + 1;
    return acc;
  }, {});
  console.log(`    📚 Job type distribution:`, jobTypeBreakdown);
  console.log(`\n📈 Job Loss Analysis:`);
  const jobsLostInPipeline = results.length - totalProcessed;
  if (jobsLostInPipeline > 0) {
    const lostPercent = Math.round((jobsLostInPipeline / results.length) * 100);
    console.log(`  ⚠️  ${jobsLostInPipeline} jobs lost during Strapi ingestion (${lostPercent}% of ${results.length} jobs)`);
    console.log(`     → This includes jobs deduplicated within batches and jobs rejected by Strapi validation`);
  }
  const jobsLostInValidation = totalJobsFound - results.length;
  if (jobsLostInValidation > 0) {
    console.log(`  ⚠️  ${jobsLostInValidation} jobs lost during LLM/enhancement phase`);
  }
  if (totalRecentRejected > 0) {
    console.log(`  🧭 Recently seen guard skipped ${totalRecentRejected} jobs from prior runs`);
  }
  
  // Calculate creation rate
  const creationRate = totalJobsFound > 0 ? Math.round((totalCreated / totalJobsFound) * 100) : 0;
  console.log(`\n📊 Creation Rate: ${creationRate}% (${totalCreated}/${totalJobsFound} jobs created)`);
  if (creationRate < 10) {
    console.warn(`  ⚠️  Very low creation rate (${creationRate}%) - most jobs are being marked as duplicates`);
    console.warn(`     This suggests:`);
    console.warn(`     1. Many jobs already exist in the database from previous runs`);
    console.warn(`     2. Same jobs are appearing multiple times from different search queries`);
    console.warn(`     3. Hash generation might be creating collisions (same hash for different jobs)`);
  }
  console.log(`\n⏱️  Duration: ${duration}s`);
  if (timeLimitReached) {
    console.log(`   ⚠️  Run stopped at ${maxRuntimeMinutes}-minute time limit`);
  }
  console.log(`🚀 Rate: ${Math.round(totalProcessed / duration)} jobs/second`);
  
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
  
  // Weekly coverage report (runs on Sundays)
  if (new Date().getDay() === 0) {
    logWeeklyCoverageGaps(results);
  }

  console.log(`${'='.repeat(80)}`);
  
  // Check if we met the target (based on NEW jobs created)
  if (totalCreated >= 1000) {
    console.log(`\n✅ SUCCESS: Target of 1000+ NEW jobs met! (${totalCreated} jobs created)`);
  } else if (totalCreated >= 500) {
    console.log(`\n⚠️  PARTIAL SUCCESS: ${totalCreated} NEW jobs created (target: 1000+)`);
    console.log(`   Note: ${totalUpdated} jobs were duplicates (updated), ${totalSkipped} were skipped`);
    console.log(`   Consider setting API keys for more job boards (see documentation).`);
  } else {
    console.log(`\n⚠️  WARNING: Target of 1000+ NEW jobs not met. Only ${totalCreated} jobs created.`);
    console.log(`   Note: ${totalUpdated} jobs were duplicates (updated), ${totalSkipped} were skipped`);
    console.log(`   Make sure to set API keys: ADZUNA_APP_ID, ADZUNA_APP_KEY, REED_API_KEY`);
    console.log(`   See: https://developer.adzuna.com/ and https://www.reed.co.uk/developers`);
  }

  summarizeRapidApiUsage();

  const rapidSummary: Record<string, { requests: number; quota: number }> = {};
  const rapidSources = [
    'jsearch',
    'linkedin-jobs',
    'jobs-api14',
    'glassdoor-real-time',
    'active-jobs-db',
    'indeed-company',
    'echojobs'
  ];
  rapidSources.forEach(sourceName => {
    try {
      const usage = getRapidApiUsage(sourceName as any);
      rapidSummary[sourceName] = { requests: usage.requests, quota: usage.quota };
    } catch {
      // ignore unknown sources
    }
  });

  const sourceReport = sortedSources.map(([source, stats]) => ({
    source,
    total: stats.total,
    valid: stats.valid,
    invalid: stats.invalid
  }));

  await sendRunReport({
    startedAt: startTime.toISOString(),
    durationSeconds: duration,
    backlogRun,
    totalScraped: totalJobsFound,
    afterEnhancement: results.length,
    sentToStrapi: totalProcessed,
    created: totalCreated,
    updated: totalUpdated,
    skipped: totalSkipped,
    creationRate,
    recentlySkipped: totalRecentRejected,
    jobTypeBreakdown,
    sourceReport,
    rapidApi: rapidSummary
  });

  await saveSeenTodayCache(seenTodayCache);
}

function logWeeklyCoverageGaps(jobs: CanonicalJob[]): void {
  if (!jobs.length) {
    console.log(`\n📉 Weekly Coverage Report: No jobs to analyze.`);
    return;
  }

  const trackedCities = [
    'london', 'manchester', 'birmingham', 'leeds', 'glasgow',
    'edinburgh', 'bristol', 'liverpool', 'oxford', 'cambridge',
    'cardiff', 'belfast'
  ];

  const industryCounts: Record<string, number> = {};
  const cityCounts: Record<string, number> = Object.fromEntries(trackedCities.map(c => [c, 0]));
  let industryTagged = 0;

  for (const job of jobs) {
    const text = `${job.title} ${job.descriptionText || ''}`.toLowerCase();
    const location = (job.location || '').toLowerCase();

    if (job.industry) {
      industryCounts[job.industry] = (industryCounts[job.industry] || 0) + 1;
      industryTagged++;
    }

    trackedCities.forEach(city => {
      if (location.includes(city) || text.includes(city)) {
        cityCounts[city] += 1;
      }
    });
  }

  const industryThreshold = Math.max(10, Math.round(jobs.length * 0.01));
  const cityThreshold = Math.max(5, Math.round(jobs.length * 0.005));

  const lowIndustries = Object.entries(industryCounts)
    .map(([industry, count]) => ({ industry, count }))
    .filter(item => item.count < industryThreshold)
    .sort((a, b) => a.count - b.count);

  const lowCities = trackedCities
    .map(city => ({ city, count: cityCounts[city] }))
    .filter(item => item.count < cityThreshold)
    .sort((a, b) => a.count - b.count);

  console.log(`\n📉 Weekly Coverage Report`);
  console.log(`  • Jobs analyzed: ${jobs.length}`);
  console.log(`  • Jobs with industry tag: ${industryTagged}`);
  console.log(`  • Industry threshold: ${industryThreshold} jobs`);
  if (Object.keys(industryCounts).length === 0) {
    console.log(`  ⚠️  No jobs have industry tags yet.`);
  } else if (lowIndustries.length > 0) {
    console.log(`  ⚠️  Under-covered industries:`);
    lowIndustries.forEach(({ industry, count }) => {
      console.log(`    - ${industry}: ${count} jobs`);
    });
  } else {
    console.log(`  ✅ Industry coverage meets the threshold for all tracked categories.`);
  }

  console.log(`  • City threshold: ${cityThreshold} jobs`);
  if (lowCities.length > 0) {
    console.log(`  ⚠️  Under-covered cities:`);
    lowCities.forEach(({ city, count }) => {
      console.log(`    - ${city}: ${count} jobs`);
    });
  } else {
    console.log(`  ✅ City coverage meets the threshold for all tracked locations.`);
  }
}

runAll().catch(e => {
  console.error(e);
  process.exit(1);
});

type RunReportPayload = {
  startedAt: string;
  durationSeconds: number;
  backlogRun: boolean;
  totalScraped: number;
  afterEnhancement: number;
  sentToStrapi: number;
  created: number;
  updated: number;
  skipped: number;
  creationRate: number;
  recentlySkipped: number;
  jobTypeBreakdown: Record<string, number>;
  sourceReport: Array<{ source: string; total: number; valid: number; invalid: number }>;
  rapidApi: Record<string, { requests: number; quota: number }>;
};

async function sendRunReport(payload: RunReportPayload): Promise<void> {
  const webhookUrl = process.env.N8N_WEBHOOK_URL || 'https://effort-free.app.n8n.cloud/webhook/3a30ee14-45e5-4920-b15c-f8d6f043d4d9';
  if (!webhookUrl) return;
  try {
    const res = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (!res.ok) {
      console.warn(`⚠️  Failed to send run report webhook: ${res.status} ${res.statusText}`);
    } else {
      console.log('📬 Sent ingestion report to n8n webhook');
    }
  } catch (error) {
    console.warn('⚠️  Error sending run report webhook:', error instanceof Error ? error.message : String(error));
  }
}
