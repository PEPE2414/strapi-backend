import { get } from '../lib/fetcher';
import * as cheerio from 'cheerio';
import { extractJobPostingJSONLD } from '../lib/jsonld';
import { pickLogo } from '../lib/logo';
import { resolveApplyUrl } from '../lib/applyUrl';
import { CanonicalJob } from '../types';
import { makeUniqueSlug } from '../lib/slug';
import { sha256 } from '../lib/hash';
import { classifyJobType, parseSalary, toISO, isRelevantJobType } from '../lib/normalize';

export async function scrapeFromUrls(urls: string[], sourceTag: string): Promise<CanonicalJob[]> {
  const out: CanonicalJob[] = [];
  const BATCH_SIZE = 10; // Process in batches for better memory management
  
  for (let i = 0; i < urls.length; i += BATCH_SIZE) {
    const batch = urls.slice(i, i + BATCH_SIZE);
    console.log(`Processing batch ${Math.floor(i/BATCH_SIZE) + 1}/${Math.ceil(urls.length/BATCH_SIZE)} (${batch.length} URLs)`);
    
    const batchPromises = batch.map(async (url) => {
      try {
      const { html } = await get(url);
      const jsonld = extractJobPostingJSONLD(html);
      const $ = cheerio.load(html);

      // Prefer JSON-LD fields
      const title = (jsonld?.title || $('h1').first().text() || '').trim();
      const companyName =
        jsonld?.hiringOrganization?.name ||
        $('meta[property="og:site_name"]').attr('content') ||
        $('meta[name="author"]').attr('content') ||
        new URL(url).hostname.replace(/^www\./,'');
      const location = jsonld?.jobLocation?.address?.addressLocality ||
        jsonld?.jobLocation?.address?.addressRegion ||
        $('.location,.job-location').first().text().trim() || undefined;

      const descHtml = jsonld?.description || $('#job, .job-description, article').first().html() || $('main').html() || '';
      const applyUrlRaw =
        jsonld?.hiringOrganization?.sameAs ||
        jsonld?.applicationContact?.url ||
        $('a[href*="apply"], a:contains("Apply")').first().attr('href') ||
        url;
      const applyUrl = await resolveApplyUrl(new URL(applyUrlRaw, url).toString());

      const deadline = toISO(jsonld?.validThrough);
      const salaryNorm = parseSalary(String(jsonld?.baseSalary?.value?.value || jsonld?.baseSalary?.value || ''));

      const postedAt = toISO(jsonld?.datePosted);

      const degreeLevel = (() => {
        const t = (title + ' ' + String(descHtml)).toLowerCase();
        const arr: string[] = [];
        if (/\b(beng|meng|bsc|msc|msci|phd|2:1|2:2)\b/.test(t)) {
          if (/\bbeng\b/.test(t)) arr.push('BEng');
          if (/\bmeng\b/.test(t)) arr.push('MEng');
          if (/\bbsc\b/.test(t)) arr.push('BSc');
          if (/\bmsc\b/.test(t)) arr.push('MSc');
          if (/\bmsci\b/.test(t)) arr.push('MSci');
          if (/\bphd\b/.test(t)) arr.push('PhD');
          if (/\b2:1\b/.test(t)) arr.push('2:1');
          if (/\b2:2\b/.test(t)) arr.push('2:2');
        }
        return arr.length ? arr : undefined;
      })();

      const relatedDegree = (() => {
        const t = (title + ' ' + String(descHtml)).toLowerCase();
        const keys = ['civil','structural','mechanical','aerospace','electrical','computer','software','chemical','materials','maths','physics','construction','architecture','geotechnical','environmental','mechatronics','industrial','biomedical'];
        const found = keys.filter(k => t.includes(k));
        return found.length ? found.map(x => x[0].toUpperCase()+x.slice(1)) : undefined;
      })();

      const experience = (() => {
        const t = String(descHtml).toLowerCase();
        const m = t.match(/\b(\d+)\+?\s*(years?|months?)\s*(experience)?/);
        return m ? m[0] : undefined;
      })();

      const companyPage = jsonld?.hiringOrganization?.sameAs || undefined;
      const companyLogo = pickLogo(html, jsonld);

      // Check if this job is relevant for university students
      const fullText = title + ' ' + String(descHtml) + ' ' + (location || '');
      if (!isRelevantJobType(fullText)) {
        console.log(`⏭️  Skipping irrelevant job: ${title}`);
        return null;
      }

      const jobType = classifyJobType(title + ' ' + $('#job, main, body').text());
      const company = { name: companyName };

      const hash = sha256([title, companyName, applyUrl].join('|'));
      const slug = makeUniqueSlug(title, companyName, hash, location);

      out.push({
        source: sourceTag,
        sourceUrl: url,
        title,
        company,
        companyLogo,
        location,
        descriptionHtml: descHtml || undefined,
        descriptionText: undefined, // LLM/text cleanup step later
        applyUrl,
        deadline,
        jobType,
        salary: salaryNorm,
        startDate: toISO(jsonld?.employmentStartDate),
        endDate: toISO(jsonld?.employmentEndDate),
        duration: jsonld?.employmentUnit || undefined,
        experience,
        companyPage,
        relatedDegree,
        degreeLevel,
        postedAt,
        slug,
        hash
      });
    } catch (error) { 
      console.warn(`Failed to scrape ${url}:`, error.message);
      return null;
    }
    });
    
    const batchResults = await Promise.all(batchPromises);
    const validJobs = batchResults.filter(job => job !== null) as CanonicalJob[];
    out.push(...validJobs);
    
    // Small delay between batches to be respectful
    if (i + BATCH_SIZE < urls.length) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
  return out;
}
