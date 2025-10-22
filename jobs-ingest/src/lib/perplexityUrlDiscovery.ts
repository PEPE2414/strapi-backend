import { fetchWithCloudflareBypass } from './cloudflareBypass';
import { smartFetch } from './smartFetcher';

/**
 * Perplexity-based URL discovery for graduate job boards
 * Uses AI to find current working URLs for each site
 */
export async function discoverUrlsWithPerplexity(boardKey: string): Promise<string[]> {
  const queries = getPerplexityQueries(boardKey);
  const discoveredUrls: string[] = [];
  
  for (const query of queries) {
    try {
      console.log(`🤖 Perplexity discovery for ${boardKey}: ${query}`);
      const urls = await queryPerplexityForUrls(query);
      discoveredUrls.push(...urls);
      
      // Add delay between queries
      await new Promise(resolve => setTimeout(resolve, 2000));
    } catch (error) {
      console.warn(`⚠️  Perplexity query failed for ${boardKey}:`, error instanceof Error ? error.message : String(error));
    }
  }
  
  // Test discovered URLs and return working ones
  const workingUrls = await testDiscoveredUrls(discoveredUrls);
  console.log(`✅ Perplexity discovery found ${workingUrls.length} working URLs for ${boardKey}`);
  
  return workingUrls;
}

/**
 * Get Perplexity queries for each board
 */
function getPerplexityQueries(boardKey: string): string[] {
  const queries: { [key: string]: string[] } = {
    gradcracker: [
      'What is the current URL for searching graduate jobs on Gradcracker?',
      'What is the current URL for searching internships on Gradcracker?',
      'What is the current URL for searching placements on Gradcracker?',
      'What is the current URL for searching graduate schemes on Gradcracker?'
    ],
    targetjobs: [
      'What is the current URL for searching graduate jobs on Targetjobs?',
      'What is the current URL for searching internships on Targetjobs?',
      'What is the current URL for searching placements on Targetjobs?',
      'What is the current URL for searching graduate schemes on Targetjobs?'
    ],
    prospects: [
      'What is the current URL for searching graduate jobs on Prospects?',
      'What is the current URL for searching internships on Prospects?',
      'What is the current URL for searching placements on Prospects?',
      'What is the current URL for searching graduate schemes on Prospects?'
    ],
    milkround: [
      'What is the current URL for searching graduate jobs on Milkround?',
      'What is the current URL for searching internships on Milkround?',
      'What is the current URL for searching placements on Milkround?',
      'What is the current URL for searching graduate schemes on Milkround?'
    ],
    brightnetwork: [
      'What is the current URL for searching graduate jobs on Bright Network?',
      'What is the current URL for searching internships on Bright Network?',
      'What is the current URL for searching placements on Bright Network?',
      'What is the current URL for searching graduate schemes on Bright Network?'
    ],
    ratemyplacement: [
      'What is the current URL for searching placements on Rate My Placement?',
      'What is the current URL for searching internships on Rate My Placement?',
      'What is the current URL for searching graduate jobs on Rate My Placement?',
      'What is the current URL for searching graduate schemes on Rate My Placement?'
    ]
  };
  
  return queries[boardKey] || [];
}

/**
 * Query Perplexity for URLs
 */
async function queryPerplexityForUrls(query: string): Promise<string[]> {
  const PERPLEXITY_API_KEY = process.env.PERPLEXITY_API_KEY;
  
  if (!PERPLEXITY_API_KEY) {
    console.warn('⚠️  PERPLEXITY_API_KEY not found, skipping Perplexity discovery');
    return [];
  }
  
  try {
    const response = await fetch('https://api.perplexity.ai/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${PERPLEXITY_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'llama-3.1-sonar-small-128k-online',
        messages: [
          {
            role: 'user',
            content: `${query} Please provide the exact URLs that are currently working.`
          }
        ],
        max_tokens: 500,
        temperature: 0.1,
      }),
    });
    
    if (!response.ok) {
      throw new Error(`Perplexity API error: ${response.status}`);
    }
    
    const data = await response.json() as any;
    const content = data.choices?.[0]?.message?.content || '';
    
    // Extract URLs from the response
    const urls = extractUrlsFromText(content);
    console.log(`🔍 Perplexity found ${urls.length} URLs: ${urls.join(', ')}`);
    
    return urls;
  } catch (error) {
    console.warn(`⚠️  Perplexity API error:`, error instanceof Error ? error.message : String(error));
    return [];
  }
}

/**
 * Extract URLs from text
 */
function extractUrlsFromText(text: string): string[] {
  const urlRegex = /https?:\/\/[^\s<>"{}|\\^`\[\]]+/g;
  const urls = text.match(urlRegex) || [];
  
  // Filter for relevant domains
  const relevantDomains = [
    'gradcracker.com',
    'targetjobs.co.uk',
    'prospects.ac.uk',
    'milkround.com',
    'brightnetwork.co.uk',
    'ratemyplacement.co.uk'
  ];
  
  return urls.filter((url: string) => 
    relevantDomains.some(domain => url.includes(domain))
  );
}

/**
 * Test discovered URLs to see which ones work
 */
async function testDiscoveredUrls(urls: string[]): Promise<string[]> {
  const workingUrls: string[] = [];
  
  for (const url of urls) {
    try {
      console.log(`🧪 Testing discovered URL: ${url}`);
      const { html } = await smartFetch(url);
      
      // Check if the page contains job-related content
      if (isJobPage(html)) {
        workingUrls.push(url);
        console.log(`✅ Working URL found: ${url}`);
      } else {
        console.log(`❌ URL not a job page: ${url}`);
      }
    } catch (error) {
      console.log(`❌ URL failed: ${url} - ${error instanceof Error ? error.message : String(error)}`);
    }
    
    // Add delay between tests
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  return workingUrls;
}

/**
 * Check if a page contains job-related content
 */
function isJobPage(html: string): boolean {
  const jobKeywords = [
    'job', 'jobs', 'career', 'careers', 'position', 'positions',
    'graduate', 'internship', 'internships', 'placement', 'placements',
    'vacancy', 'vacancies', 'opportunity', 'opportunities',
    'apply', 'application', 'applications'
  ];
  
  const lowerHtml = html.toLowerCase();
  const keywordCount = jobKeywords.filter(keyword => lowerHtml.includes(keyword)).length;
  
  // Consider it a job page if it has multiple job keywords and substantial content
  return keywordCount >= 3 && html.length > 5000;
}