import { request } from 'undici';
import * as cheerio from 'cheerio';
import { CanonicalJob } from '../types';
import { makeUniqueSlug } from './slug';
import { generateJobHash } from './jobHash';
import { classifyJobType, toISO, isRelevantJobType, isUKJob, cleanJobDescription } from './normalize';
import { resolveApplyUrl } from './applyUrl';

export interface RSSFeed {
  url: string;
  title?: string;
  description?: string;
}

export interface RSSItem {
  title: string;
  link: string;
  description?: string;
  pubDate?: string;
  guid?: string;
  author?: string;
  category?: string | string[];
  content?: string;
}

/**
 * Discover RSS feeds from a website
 */
export async function discoverRSSFeeds(baseUrl: string): Promise<RSSFeed[]> {
  const feeds: RSSFeed[] = [];
  const visited = new Set<string>();

  try {
    const url = new URL(baseUrl);
    const domain = `${url.protocol}//${url.hostname}`;

    // Common RSS feed locations
    const commonFeedPaths = [
      '/feed',
      '/rss',
      '/rss.xml',
      '/feed.xml',
      '/atom.xml',
      '/feeds/all.xml',
      '/jobs/feed',
      '/jobs/rss',
      '/careers/feed',
      '/careers/rss',
      '/graduate-jobs/feed',
      '/graduate-jobs/rss',
      '/internships/feed',
      '/internships/rss',
      '/placements/feed',
      '/placements/rss'
    ];

    // Try common feed paths
    for (const path of commonFeedPaths) {
      const feedUrl = new URL(path, domain).toString();
      if (visited.has(feedUrl)) continue;
      visited.add(feedUrl);

      try {
        const isValid = await validateFeed(feedUrl);
        if (isValid) {
          feeds.push({ url: feedUrl });
        }
      } catch {
        // Ignore invalid feeds
      }
    }

    // Discover feeds from HTML pages
    try {
      const htmlFeeds = await discoverFeedsFromHTML(domain);
      for (const feed of htmlFeeds) {
        if (!visited.has(feed.url)) {
          visited.add(feed.url);
          feeds.push(feed);
        }
      }
    } catch {
      // Ignore errors
    }

    // Discover feeds from robots.txt
    try {
      const robotsFeeds = await discoverFeedsFromRobots(domain);
      for (const feed of robotsFeeds) {
        if (!visited.has(feed.url)) {
          visited.add(feed.url);
          feeds.push(feed);
        }
      }
    } catch {
      // Ignore errors
    }
  } catch (error) {
    console.warn(`Failed to discover RSS feeds from ${baseUrl}:`, error instanceof Error ? error.message : String(error));
  }

  return feeds;
}

/**
 * Validate if a URL is a valid RSS/Atom feed
 */
async function validateFeed(feedUrl: string): Promise<boolean> {
  try {
    const res = await request(feedUrl, {
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'application/rss+xml,application/atom+xml,application/xml,text/xml,*/*;q=0.9'
      },
      maxRedirections: 3
    });

    if (res.statusCode !== 200) return false;

    const text = await res.body.text();
    if (!text || text.length < 100) return false;

    // Check if it's RSS or Atom
    return /<rss|<feed|<rdf:rdf/i.test(text);
  } catch {
    return false;
  }
}

/**
 * Discover RSS feeds from HTML pages (look for <link rel="alternate">)
 */
async function discoverFeedsFromHTML(baseUrl: string): Promise<RSSFeed[]> {
  const feeds: RSSFeed[] = [];

  try {
    const res = await request(baseUrl, {
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'text/html,application/xhtml+xml'
      },
      maxRedirections: 3
    });

    if (res.statusCode !== 200) return feeds;

    const html = await res.body.text();
    const $ = cheerio.load(html);

    $('link[rel="alternate"]').each((_, el) => {
      const type = $(el).attr('type');
      const href = $(el).attr('href');
      const title = $(el).attr('title');

      if (href && (type?.includes('rss') || type?.includes('atom') || type?.includes('xml'))) {
        try {
          const feedUrl = new URL(href, baseUrl).toString();
          feeds.push({
            url: feedUrl,
            title: title || undefined
          });
        } catch {
          // Ignore invalid URLs
        }
      }
    });
  } catch {
    // Ignore errors
  }

  return feeds;
}

/**
 * Discover RSS feeds from robots.txt
 */
async function discoverFeedsFromRobots(baseUrl: string): Promise<RSSFeed[]> {
  const feeds: RSSFeed[] = [];

  try {
    const robotsUrl = new URL('/robots.txt', baseUrl).toString();
    const res = await request(robotsUrl, {
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      },
      maxRedirections: 2
    });

    if (res.statusCode !== 200) return feeds;

    const text = await res.body.text();
    const lines = text.split('\n');

    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.toLowerCase().startsWith('sitemap:')) {
        const sitemapUrl = trimmed.split(':', 2)[1]?.trim();
        if (sitemapUrl && /feed|rss|atom/i.test(sitemapUrl)) {
          try {
            const feedUrl = new URL(sitemapUrl, baseUrl).toString();
            feeds.push({ url: feedUrl });
          } catch {
            // Ignore invalid URLs
          }
        }
      }
    }
  } catch {
    // Ignore errors
  }

  return feeds;
}

/**
 * Parse RSS/Atom feed and extract job items
 */
export async function parseRSSFeed(feedUrl: string): Promise<RSSItem[]> {
  try {
    // Try direct fetch first
    let xml: string;
    try {
      const res = await request(feedUrl, {
        method: 'GET',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Accept': 'application/rss+xml,application/atom+xml,application/xml,text/xml,*/*;q=0.9'
        },
        maxRedirections: 3
      });

      if (res.statusCode !== 200) {
        console.warn(`RSS feed returned ${res.statusCode}: ${feedUrl}`);
        // Try with Cloudflare bypass as fallback
        try {
          const { fetchWithCloudflareBypass } = await import('./cloudflareBypass');
          const result = await fetchWithCloudflareBypass(feedUrl);
          xml = result.html;
        } catch (bypassError) {
          console.warn(`RSS feed fetch failed (direct: ${res.statusCode}, bypass failed): ${feedUrl}`);
          return [];
        }
      } else {
        xml = await res.body.text();
      }
    } catch (directError) {
      // If direct fetch fails, try Cloudflare bypass
      try {
        const { fetchWithCloudflareBypass } = await import('./cloudflareBypass');
        const result = await fetchWithCloudflareBypass(feedUrl);
        xml = result.html;
      } catch (bypassError) {
        console.warn(`Failed to fetch RSS feed ${feedUrl}:`, bypassError instanceof Error ? bypassError.message : String(bypassError));
        return [];
      }
    }

    if (!xml || xml.length < 100) {
      console.warn(`RSS feed content too short (${xml?.length || 0} chars): ${feedUrl}`);
      return [];
    }

    // Check if response is gzipped/binary - try to detect and handle
    const hasBinaryData = /[\x00-\x08\x0E-\x1F]/.test(xml.substring(0, 100));
    const hasValidXML = /<rss|<feed|<rdf:rdf|<?xml/i.test(xml);
    
    // If it looks like binary but we requested gzip, it might be compressed
    // undici should auto-decompress, but if not, try to handle it
    if (hasBinaryData && !hasValidXML) {
      console.warn(`RSS feed appears to be binary/compressed: ${feedUrl}, attempting to parse anyway...`);
      // Try to find XML structure deeper in the content
      const hasXMLDeeper = /<rss|<feed|<rdf:rdf|<?xml/i.test(xml.substring(100, 1000));
      if (!hasXMLDeeper) {
        console.warn(`RSS feed doesn't appear to be valid XML/RSS: ${feedUrl} (first 200 chars: ${xml.substring(0, 200)})`);
        // Try HTML extraction as fallback
        if (/<html|<body|<head|<!DOCTYPE/i.test(xml)) {
          // It's HTML, try to extract RSS feed URL
          return await parseRSSFeed(feedUrl); // Will trigger HTML handling below
        }
        return [];
      }
    }

    // Check if it's actually XML/RSS
    if (!/<rss|<feed|<rdf:rdf/i.test(xml)) {
      // If it's HTML, try to extract RSS feed URL from the page
      if (/<html|<body|<head|<!DOCTYPE/i.test(xml)) {
        console.warn(`RSS feed returned HTML instead of XML: ${feedUrl}, attempting to find actual RSS URL...`);
        try {
          const cheerio = await import('cheerio');
          const $ = cheerio.load(xml);
          // Look for RSS feed links in the HTML
          const rssLinks = $('a[href*="rss"], a[href*="feed"], link[type*="rss"], link[type*="atom"]').map((_, el) => {
            const href = $(el).attr('href');
            if (href) {
              try {
                return new URL(href, feedUrl).toString();
              } catch {
                return null;
              }
            }
            return null;
          }).get().filter(Boolean);
          
          if (rssLinks.length > 0) {
            console.log(`  🔍 Found ${rssLinks.length} potential RSS feed URLs in HTML, trying first one: ${rssLinks[0]}`);
            // Recursively try the first found RSS URL
            return await parseRSSFeed(rssLinks[0]);
          }
        } catch (parseError) {
          // Ignore parsing errors
        }
      }
      console.warn(`RSS feed doesn't appear to be valid XML/RSS: ${feedUrl} (first 200 chars: ${xml.substring(0, 200)})`);
      return [];
    }

    const items = parseFeedXML(xml);
    if (items.length === 0) {
      console.warn(`RSS feed parsed but no items found: ${feedUrl} (XML length: ${xml.length})`);
    }
    return items;
  } catch (error) {
    console.warn(`Failed to parse RSS feed ${feedUrl}:`, error instanceof Error ? error.message : String(error));
    return [];
  }
}

/**
 * Parse RSS/Atom XML into items
 */
function parseFeedXML(xml: string): RSSItem[] {
  const items: RSSItem[] = [];

  try {
    const $ = cheerio.load(xml, { xmlMode: true });

    // Parse RSS 2.0 format
    $('item').each((_, el) => {
      const title = $(el).find('title').text().trim();
      const link = $(el).find('link').text().trim() || $(el).find('guid').text().trim();
      const description = $(el).find('description').text().trim();
      const pubDate = $(el).find('pubDate').text().trim();
      const guid = $(el).find('guid').text().trim();
      const author = $(el).find('author').text().trim() || $(el).find('dc\\:creator').text().trim();
      const category = $(el).find('category').map((_, cat) => $(cat).text().trim()).get();
      const content = $(el).find('content\\:encoded').text().trim();

      if (title && link) {
        items.push({
          title,
          link,
          description: description || content,
          pubDate,
          guid,
          author,
          category: category.length > 0 ? category : undefined,
          content
        });
      }
    });

    // Parse Atom format
    $('entry').each((_, el) => {
      const title = $(el).find('title').text().trim();
      const link = $(el).find('link').attr('href') || $(el).find('link').text().trim();
      const summary = $(el).find('summary').text().trim();
      const content = $(el).find('content').text().trim();
      const published = $(el).find('published').text().trim() || $(el).find('updated').text().trim();
      const id = $(el).find('id').text().trim();
      const author = $(el).find('author > name').text().trim();
      const category = $(el).find('category').map((_, cat) => $(cat).attr('term') || $(cat).text().trim()).get();

      if (title && link) {
        items.push({
          title,
          link,
          description: content || summary,
          pubDate: published,
          guid: id,
          author,
          category: category.length > 0 ? category : undefined,
          content: content
        });
      }
    });

    // Parse RDF/RSS 1.0 format
    $('item').each((_, el) => {
      const rdfAbout = $(el).attr('rdf:about');
      const title = $(el).find('title').text().trim();
      const link = $(el).find('link').text().trim() || rdfAbout;
      const description = $(el).find('description').text().trim();

      if (title && link) {
        items.push({
          title,
          link,
          description
        });
      }
    });
  } catch (error) {
    console.warn('Failed to parse feed XML:', error instanceof Error ? error.message : String(error));
  }

  return items;
}

/**
 * Convert RSS item to CanonicalJob
 */
export async function convertRSSItemToJob(item: RSSItem, feedUrl: string, sourceName: string): Promise<CanonicalJob | null> {
  const title = item.title.trim();
  const link = item.link.trim();

  if (!title || !link) {
    return null;
  }

  // Extract company name from title or description
  const fullText = `${title} ${item.description || ''} ${item.content || ''}`;
  const companyMatch = fullText.match(/(?:at|@|from)\s+([A-Z][a-zA-Z\s&]+(?:Ltd|Limited|Inc|Corp|LLC|PLC)?)/i);
  const companyName = companyMatch ? companyMatch[1].trim() : 'Unknown Company';

  // Extract location from description or title
  const locationMatch = fullText.match(/(?:in|at|based in|located in)\s+([A-Z][a-zA-Z\s,]+(?:UK|United Kingdom|England|Scotland|Wales)?)/i);
  const location = locationMatch ? locationMatch[1].trim() : undefined;

  // Check if job is relevant
  if (!isRelevantJobType(fullText)) {
    return null;
  }

  // Check if job is in UK
  if (!isUKJob(fullText)) {
    return null;
  }

  const description = cleanJobDescription(item.description || item.content || '');
  const jobType = classifyJobType(fullText);
  if (jobType === 'other') {
    return null;
  }

  const applyUrl = await resolveApplyUrl(link);
  const postedAtDate = item.pubDate ? parseDate(item.pubDate) : null;
  const postedAt = postedAtDate ? postedAtDate.toISOString() : undefined;

  const hash = generateJobHash({
    title,
    company: companyName,
    applyUrl,
    location,
    postedAt
  });

  const slug = makeUniqueSlug(title, companyName, hash, location);

  return {
    source: `rss:${sourceName}`,
    sourceUrl: feedUrl,
    title,
    company: { name: companyName },
    location: location || undefined,
    descriptionText: description || undefined,
    applyUrl,
    jobType,
    postedAt,
    slug,
    hash
  };
}

/**
 * Parse various date formats from RSS feeds
 */
function parseDate(dateString: string): Date | null {
  if (!dateString) return null;

  try {
    // Try ISO 8601 format
    const isoDate = new Date(dateString);
    if (!isNaN(isoDate.getTime())) {
      return isoDate;
    }

    // Try RFC 822/1123 format (common in RSS)
    const rfcDate = new Date(dateString);
    if (!isNaN(rfcDate.getTime())) {
      return rfcDate;
    }

    return null;
  } catch {
    return null;
  }
}

