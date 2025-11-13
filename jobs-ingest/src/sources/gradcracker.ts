import { get } from '../lib/fetcher';
import { fetchWithCloudflareBypass, getBypassStatus } from '../lib/cloudflareBypass';
import { smartFetch } from '../lib/smartFetcher';
import { getWorkingUrls } from '../lib/urlDiscovery';
import { extractDeadlineFromJobCard } from '../lib/deadlineExtractor';
import { extractGraduateJobs } from '../lib/graduateJobExtractor';
import { debugExtractJobs } from '../lib/debugExtractor';
import * as cheerio from 'cheerio';
import { CanonicalJob } from '../types';
import { makeUniqueSlug } from '../lib/slug';
import { sha256 } from '../lib/hash';
import { classifyJobType, parseSalary, toISO, isRelevantJobType, isUKJob } from '../lib/normalize';
import { scrapeUrlsWithHybrid } from '../lib/hybridScraper';
import { isTestMode } from '../lib/rotation';

export async function scrapeGradcracker(): Promise<CanonicalJob[]> {
  const jobs: CanonicalJob[] = [];

  try {
    console.log(`🔍 Auto-discovering working URLs for gradcracker...`);

    const urlPatterns = [
      'https://www.gradcracker.com/search/graduate-jobs',
      'https://www.gradcracker.com/search/internships',
      'https://www.gradcracker.com/search/placements',
      'https://www.gradcracker.com/jobs',
      'https://www.gradcracker.com/',
      'https://www.gradcracker.com/graduate-jobs',
      'https://www.gradcracker.com/internships',
      'https://www.gradcracker.com/placements'
    ];

    const workingUrls = await getWorkingUrls(
      'gradcracker',
      urlPatterns,
      'https://www.gradcracker.com'
    );

    if (workingUrls.length === 0) {
      console.warn(`⚠️  No working URLs found for gradcracker`);
      return jobs;
    }

    console.log(`✅ Found ${workingUrls.length} working URLs for gradcracker`);

    // Use hybrid scraper with more URLs to get 500+ jobs
    // In test mode, limit to 1 URL
    const urlLimit = isTestMode() ? 1 : 20;
    const hybridJobs = await scrapeUrlsWithHybrid(workingUrls.slice(0, urlLimit), 'Gradcracker', 'gradcracker');
    jobs.push(...hybridJobs);

    console.log(`📊 Gradcracker: Found ${jobs.length} total jobs`);
    return jobs;
  } catch (error) {
    console.warn(`Failed to scrape Gradcracker:`, error instanceof Error ? error.message : String(error));
    return jobs;
  }
}