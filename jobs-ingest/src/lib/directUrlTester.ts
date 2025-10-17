import { fetchWithCloudflareBypass } from './cloudflareBypass';
import * as cheerio from 'cheerio';

/**
 * Test a URL directly and return detailed results
 */
export async function testUrlDirect(url: string): Promise<{
  success: boolean;
  hasContent: boolean;
  hasJobs: boolean;
  jobElements: number;
  contentLength: number;
  error?: string;
}> {
  try {
    console.log(`🧪 Testing URL directly: ${url}`);
    
    const { html } = await fetchWithCloudflareBypass(url);
    const contentLength = html.length;
    const hasContent = contentLength > 1000;
    
    // Parse with cheerio
    const $ = cheerio.load(html);
    
    // Check for job-related content
    const text = $.text().toLowerCase();
    const hasJobs = text.includes('graduate') || 
                   text.includes('internship') || 
                   text.includes('placement') || 
                   text.includes('job') ||
                   text.includes('career') ||
                   text.includes('vacancy');
    
    // Count job elements
    const jobSelectors = [
      '.job-card', '.job-listing', '.job-item', '.job-result',
      '[class*="job"]', '[class*="Job"]', 'article', '.result',
      '.vacancy', '.position', '.opportunity', '.role'
    ];
    
    let jobElements = 0;
    for (const selector of jobSelectors) {
      jobElements += $(selector).length;
    }
    
    const result = {
      success: true,
      hasContent,
      hasJobs,
      jobElements,
      contentLength
    };
    
    console.log(`✅ URL test result:`, result);
    return result;
    
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.log(`❌ URL test failed: ${errorMsg}`);
    
    return {
      success: false,
      hasContent: false,
      hasJobs: false,
      jobElements: 0,
      contentLength: 0,
      error: errorMsg
    };
  }
}

/**
 * Test multiple URLs and return the best working ones
 */
export async function findBestUrls(urls: string[]): Promise<string[]> {
  console.log(`\n🔍 Testing ${urls.length} URLs to find the best ones...`);
  
  const results = await Promise.all(
    urls.map(async (url) => {
      const result = await testUrlDirect(url);
      return { url, ...result };
    })
  );
  
  // Filter for successful URLs with content
  const workingUrls = results
    .filter(r => r.success && r.hasContent)
    .sort((a, b) => {
      // Sort by job elements first, then content length
      if (b.jobElements !== a.jobElements) {
        return b.jobElements - a.jobElements;
      }
      return b.contentLength - a.contentLength;
    })
    .map(r => r.url);
  
  console.log(`✅ Found ${workingUrls.length} working URLs out of ${urls.length} tested`);
  return workingUrls;
}
