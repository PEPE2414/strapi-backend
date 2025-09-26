import { scrapeGreenhouse } from './sources/greenhouse';
import { scrapeLever } from './sources/lever';
import { scrapeFromUrls } from './sources/sitemapGeneric';
import { upsertJobs } from './lib/strapi';
import { llmAssist } from './lib/llm';
import { GREENHOUSE_BOARDS, LEVER_COMPANIES, MANUAL_URLS } from './config/sources';

async function runAll() {
  const batches = [];

  // 1) ATS sources (configure in config/sources.ts)
  for (const board of GREENHOUSE_BOARDS) {
    batches.push(scrapeGreenhouse(board));
  }
  
  for (const company of LEVER_COMPANIES) {
    batches.push(scrapeLever(company));
  }

  // 2) Hand-picked company job URLs (JSON-LD/HTML)
  if (MANUAL_URLS.length > 0) {
    batches.push(scrapeFromUrls(MANUAL_URLS, 'site:manual'));
  }

  console.log(`Starting job ingestion with ${batches.length} source batches...`);
  
  const results = (await Promise.all(batches)).flat();
  console.log(`Scraped ${results.length} jobs from all sources`);

  // Optional LLM cleanup: descriptionText + fallback jobType/salary if unknown
  let llmProcessed = 0;
  for (const j of results) {
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
  }
  
  if (llmProcessed > 0) {
    console.log(`LLM processed ${llmProcessed} job descriptions`);
  }

  // Push to Strapi
  try {
    const r = await upsertJobs(results);
    console.log('Successfully ingested:', r?.count ?? results.length, 'jobs');
  } catch (error) {
    console.error('Failed to ingest jobs to Strapi:', error);
    throw error;
  }
}

runAll().catch(e => {
  console.error(e);
  process.exit(1);
});
