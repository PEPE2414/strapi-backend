import { get } from '../lib/fetcher';
import * as cheerio from 'cheerio';
import { extractJobPostingJSONLD } from '../lib/jsonld';
import { pickLogo } from '../lib/logo';
import { resolveApplyUrl } from '../lib/applyUrl';
import { CanonicalJob } from '../types';
import { makeUniqueSlug } from '../lib/slug';
import { sha256 } from '../lib/hash';
import { classifyJobType, parseSalary, toISO, isRelevantJobType, isUKJob, validateJobRequirements, cleanJobDescription } from '../lib/normalize';

// UK Company career page configurations
export const UK_COMPANIES = {
  // Engineering & Construction
  'arup': {
    name: 'Arup',
    careerUrl: 'https://www.arup.com/careers',
    sitemapUrl: 'https://www.arup.com/careers/sitemap.xml',
    ats: 'workday'
  },
  'atkins': {
    name: 'AtkinsRéalis',
    careerUrl: 'https://careers.atkinsglobal.com',
    sitemapUrl: 'https://careers.atkinsglobal.com/sitemap.xml',
    ats: 'workday'
  },
  'wsp': {
    name: 'WSP',
    careerUrl: 'https://www.wsp.com/en-gb/careers',
    sitemapUrl: 'https://www.wsp.com/sitemap.xml',
    ats: 'workday'
  },
  'aecom': {
    name: 'AECOM',
    careerUrl: 'https://aecom.com/careers',
    sitemapUrl: 'https://aecom.com/sitemap.xml',
    ats: 'workday'
  },
  'mott-macdonald': {
    name: 'Mott MacDonald',
    careerUrl: 'https://www.mottmac.com/careers',
    sitemapUrl: 'https://www.mottmac.com/sitemap.xml',
    ats: 'workday'
  },
  'jacobs': {
    name: 'Jacobs',
    careerUrl: 'https://careers.jacobs.com',
    sitemapUrl: 'https://careers.jacobs.com/sitemap.xml',
    ats: 'workday'
  },
  'balfour-beatty': {
    name: 'Balfour Beatty',
    careerUrl: 'https://www.balfourbeatty.com/careers',
    sitemapUrl: 'https://www.balfourbeatty.com/sitemap.xml',
    ats: 'workday'
  },
  'costain': {
    name: 'Costain',
    careerUrl: 'https://www.costain.com/careers',
    sitemapUrl: 'https://www.costain.com/sitemap.xml',
    ats: 'workday'
  },
  'skanska-uk': {
    name: 'Skanska UK',
    careerUrl: 'https://www.skanska.co.uk/careers',
    sitemapUrl: 'https://www.skanska.co.uk/sitemap.xml',
    ats: 'workday'
  },
  'laing-orourke': {
    name: 'Laing O\'Rourke',
    careerUrl: 'https://www.laingorourke.com/careers',
    sitemapUrl: 'https://www.laingorourke.com/sitemap.xml',
    ats: 'workday'
  },
  'ramboll': {
    name: 'Ramboll',
    careerUrl: 'https://ramboll.com/careers',
    sitemapUrl: 'https://ramboll.com/sitemap.xml',
    ats: 'workday'
  },
  'stantec-uk': {
    name: 'Stantec UK',
    careerUrl: 'https://www.stantec.com/en/careers',
    sitemapUrl: 'https://www.stantec.com/sitemap.xml',
    ats: 'workday'
  },
  'buro-happold': {
    name: 'Buro Happold',
    careerUrl: 'https://www.burohappold.com/careers',
    sitemapUrl: 'https://www.burohappold.com/sitemap.xml',
    ats: 'workday'
  },
  'hoare-lea': {
    name: 'Hoare Lea',
    careerUrl: 'https://www.hoarelea.com/careers',
    sitemapUrl: 'https://www.hoarelea.com/sitemap.xml',
    ats: 'workday'
  },
  'sweco': {
    name: 'Sweco',
    careerUrl: 'https://www.sweco.co.uk/careers',
    sitemapUrl: 'https://www.sweco.co.uk/sitemap.xml',
    ats: 'workday'
  },
  'ayesa-uk': {
    name: 'Ayesa UK',
    careerUrl: 'https://www.ayesa.com/en/careers',
    sitemapUrl: 'https://www.ayesa.com/sitemap.xml',
    ats: 'workday'
  },

  // Manufacturing & Aerospace
  'rolls-royce': {
    name: 'Rolls-Royce',
    careerUrl: 'https://www.rolls-royce.com/careers',
    sitemapUrl: 'https://www.rolls-royce.com/sitemap.xml',
    ats: 'workday'
  },
  'bae-systems': {
    name: 'BAE Systems',
    careerUrl: 'https://www.baesystems.com/careers',
    sitemapUrl: 'https://www.baesystems.com/sitemap.xml',
    ats: 'workday'
  },
  'dyson': {
    name: 'Dyson',
    careerUrl: 'https://careers.dyson.com',
    sitemapUrl: 'https://careers.dyson.com/sitemap.xml',
    ats: 'workday'
  },
  'jaguar-land-rover': {
    name: 'Jaguar Land Rover',
    careerUrl: 'https://www.jaguarlandrovercareers.com',
    sitemapUrl: 'https://www.jaguarlandrovercareers.com/sitemap.xml',
    ats: 'workday'
  },
  'airbus-uk': {
    name: 'Airbus UK',
    careerUrl: 'https://www.airbus.com/careers',
    sitemapUrl: 'https://www.airbus.com/sitemap.xml',
    ats: 'workday'
  },
  'gkn': {
    name: 'GKN',
    careerUrl: 'https://www.gkn.com/careers',
    sitemapUrl: 'https://www.gkn.com/sitemap.xml',
    ats: 'workday'
  },
  'mbda': {
    name: 'MBDA',
    careerUrl: 'https://www.mbda-systems.com/careers',
    sitemapUrl: 'https://www.mbda-systems.com/sitemap.xml',
    ats: 'workday'
  },
  'siemens-uk': {
    name: 'Siemens UK',
    careerUrl: 'https://www.siemens.co.uk/careers',
    sitemapUrl: 'https://www.siemens.co.uk/sitemap.xml',
    ats: 'workday'
  },
  'schneider-electric-uk': {
    name: 'Schneider Electric UK',
    careerUrl: 'https://www.se.com/uk/en/careers',
    sitemapUrl: 'https://www.se.com/sitemap.xml',
    ats: 'workday'
  },

  // Energy & Utilities
  'national-grid': {
    name: 'National Grid',
    careerUrl: 'https://careers.nationalgrid.com',
    sitemapUrl: 'https://careers.nationalgrid.com/sitemap.xml',
    ats: 'workday'
  },
  'sse': {
    name: 'SSE',
    careerUrl: 'https://careers.sse.com',
    sitemapUrl: 'https://careers.sse.com/sitemap.xml',
    ats: 'workday'
  },
  'edf-uk': {
    name: 'EDF UK',
    careerUrl: 'https://www.edfenergy.com/careers',
    sitemapUrl: 'https://www.edfenergy.com/sitemap.xml',
    ats: 'workday'
  },
  'octopus-energy': {
    name: 'Octopus Energy',
    careerUrl: 'https://octopus.energy/careers',
    sitemapUrl: 'https://octopus.energy/sitemap.xml',
    ats: 'workday'
  },
  'shell-uk': {
    name: 'Shell UK',
    careerUrl: 'https://www.shell.co.uk/careers',
    sitemapUrl: 'https://www.shell.co.uk/sitemap.xml',
    ats: 'workday'
  },
  'bp-uk': {
    name: 'BP UK',
    careerUrl: 'https://www.bp.com/en_gb/careers',
    sitemapUrl: 'https://www.bp.com/sitemap.xml',
    ats: 'workday'
  },

  // Technology
  'google-london': {
    name: 'Google London',
    careerUrl: 'https://careers.google.com',
    sitemapUrl: 'https://careers.google.com/sitemap.xml',
    ats: 'workday'
  },
  'microsoft-uk': {
    name: 'Microsoft UK',
    careerUrl: 'https://careers.microsoft.com',
    sitemapUrl: 'https://careers.microsoft.com/sitemap.xml',
    ats: 'workday'
  },
  'amazon-uk': {
    name: 'Amazon UK',
    careerUrl: 'https://www.amazon.jobs',
    sitemapUrl: 'https://www.amazon.jobs/sitemap.xml',
    ats: 'workday'
  },
  'bloomberg-london': {
    name: 'Bloomberg London',
    careerUrl: 'https://careers.bloomberg.com',
    sitemapUrl: 'https://careers.bloomberg.com/sitemap.xml',
    ats: 'workday'
  },
  'deepmind': {
    name: 'DeepMind',
    careerUrl: 'https://deepmind.com/careers',
    sitemapUrl: 'https://deepmind.com/sitemap.xml',
    ats: 'workday'
  },

  // Finance
  'goldman-sachs-london': {
    name: 'Goldman Sachs London',
    careerUrl: 'https://www.goldmansachs.com/careers',
    sitemapUrl: 'https://www.goldmansachs.com/sitemap.xml',
    ats: 'workday'
  },
  'jpmorgan-london': {
    name: 'JPMorgan London',
    careerUrl: 'https://careers.jpmorgan.com',
    sitemapUrl: 'https://careers.jpmorgan.com/sitemap.xml',
    ats: 'workday'
  },
  'barclays': {
    name: 'Barclays',
    careerUrl: 'https://home.barclays/careers',
    sitemapUrl: 'https://home.barclays/sitemap.xml',
    ats: 'workday'
  },
  'hsbc': {
    name: 'HSBC',
    careerUrl: 'https://www.hsbc.com/careers',
    sitemapUrl: 'https://www.hsbc.com/sitemap.xml',
    ats: 'workday'
  },
  'lloyds': {
    name: 'Lloyds Banking Group',
    careerUrl: 'https://www.lloydsbankinggroup.com/careers',
    sitemapUrl: 'https://www.lloydsbankinggroup.com/sitemap.xml',
    ats: 'workday'
  },
  'natwest': {
    name: 'NatWest Group',
    careerUrl: 'https://www.natwestgroup.com/careers',
    sitemapUrl: 'https://www.natwestgroup.com/sitemap.xml',
    ats: 'workday'
  },

  // Consulting
  'deloitte-uk': {
    name: 'Deloitte UK',
    careerUrl: 'https://www2.deloitte.com/uk/en/careers',
    sitemapUrl: 'https://www2.deloitte.com/sitemap.xml',
    ats: 'workday'
  },
  'pwc-uk': {
    name: 'PwC UK',
    careerUrl: 'https://www.pwc.co.uk/careers',
    sitemapUrl: 'https://www.pwc.co.uk/sitemap.xml',
    ats: 'workday'
  },
  'kpmg-uk': {
    name: 'KPMG UK',
    careerUrl: 'https://www.kpmgcareers.co.uk',
    sitemapUrl: 'https://www.kpmgcareers.co.uk/sitemap.xml',
    ats: 'workday'
  },
  'ey-uk': {
    name: 'EY UK',
    careerUrl: 'https://www.ey.com/en_uk/careers',
    sitemapUrl: 'https://www.ey.com/sitemap.xml',
    ats: 'workday'
  },

  // Public Sector
  'civil-service': {
    name: 'Civil Service Fast Stream',
    careerUrl: 'https://www.faststream.gov.uk',
    sitemapUrl: 'https://www.faststream.gov.uk/sitemap.xml',
    ats: 'workday'
  },
  'network-rail': {
    name: 'Network Rail',
    careerUrl: 'https://www.networkrail.co.uk/careers',
    sitemapUrl: 'https://www.networkrail.co.uk/sitemap.xml',
    ats: 'workday'
  },
  'tfl': {
    name: 'Transport for London',
    careerUrl: 'https://tfl.gov.uk/careers',
    sitemapUrl: 'https://tfl.gov.uk/sitemap.xml',
    ats: 'workday'
  },
  'hs2': {
    name: 'HS2',
    careerUrl: 'https://www.hs2.org.uk/careers',
    sitemapUrl: 'https://www.hs2.org.uk/sitemap.xml',
    ats: 'workday'
  }
};

export async function scrapeUKCompany(companyKey: string): Promise<CanonicalJob[]> {
  const company = UK_COMPANIES[companyKey as keyof typeof UK_COMPANIES];
  if (!company) {
    console.warn(`Unknown UK company: ${companyKey}`);
    return [];
  }

  try {
    // Try to get job URLs from sitemap first
    const { html: sitemapHtml } = await get(company.sitemapUrl);
    const $ = cheerio.load(sitemapHtml, { xmlMode: true });
    
    const jobUrls: string[] = [];
    $('loc').each((_i, el) => {
      const url = $(el).text();
      if (url && isJobUrl(url)) {
        jobUrls.push(url);
      }
    });

    console.log(`📊 Found ${jobUrls.length} job URLs from ${company.name} sitemap`);

    // Scrape each job URL
    const jobs: CanonicalJob[] = [];
    for (const url of jobUrls.slice(0, 50)) { // Limit to 50 jobs per company
      try {
        const { html } = await get(url);
        const job = await parseJobPage(html, url, company);
        if (job) {
          jobs.push(job);
        }
      } catch (error) {
        console.warn(`Failed to scrape job ${url}:`, error);
      }
    }

    console.log(`✅ Scraped ${jobs.length} jobs from ${company.name}`);
    return jobs;

  } catch (error) {
    console.warn(`Failed to scrape ${company.name}:`, error instanceof Error ? error.message : String(error));
    return [];
  }
}

function isJobUrl(url: string): boolean {
  const urlLower = url.toLowerCase();
  const jobKeywords = [
    'job', 'jobs', 'career', 'careers', 'position', 'positions',
    'opportunity', 'opportunities', 'opening', 'openings',
    'vacancy', 'vacancies', 'role', 'roles', 'employment',
    'intern', 'internship', 'graduate', 'placement', 'trainee'
  ];
  
  return jobKeywords.some(keyword => urlLower.includes(keyword));
}

async function parseJobPage(html: string, url: string, company: any): Promise<CanonicalJob | null> {
  const $ = cheerio.load(html);
  const jsonld = extractJobPostingJSONLD(html);

  // Extract job details
  const title = (jsonld?.title || $('h1').first().text() || '').trim();
  const description = jsonld?.description || $('.job-description, .job-content, .description').first().html() || '';
  const location = jsonld?.jobLocation?.address?.addressLocality || 
                  jsonld?.jobLocation?.address?.addressRegion ||
                  $('.location, .job-location').first().text().trim() || '';

  // Check if job is relevant and UK-based
  const fullText = `${title} ${description} ${location}`;
  if (!isRelevantJobType(fullText) || !isUKJob(fullText)) {
    return null;
  }

  // Extract other details
  const applyUrl = await resolveApplyUrl(
    jsonld?.applicationContact?.url || 
    $('a[href*="apply"], a:contains("Apply")').first().attr('href') || 
    url
  );

  const companyName = company.name;
  const hash = sha256([title, companyName, applyUrl].join('|'));
  const slug = makeUniqueSlug(title, companyName, hash, location);

  // Clean description
  const descriptionText = cleanJobDescription(description);

  const job: CanonicalJob = {
    source: `uk-company:${companyKey}`,
    sourceUrl: url,
    title,
    company: { 
      name: companyName,
      website: company.careerUrl
    },
    companyLogo: pickLogo(html, jsonld),
    companyPageUrl: company.careerUrl,
    location,
    descriptionHtml: description || undefined,
    descriptionText: descriptionText || undefined,
    applyUrl,
    applyDeadline: toISO(jsonld?.validThrough),
    jobType: classifyJobType(title + ' ' + description),
    salary: parseSalary(jsonld?.baseSalary?.value?.value || jsonld?.baseSalary?.value || ''),
    startDate: toISO(jsonld?.employmentStartDate),
    endDate: toISO(jsonld?.employmentEndDate),
    duration: jsonld?.employmentUnit || undefined,
    experience: extractExperience(description),
    relatedDegree: extractRelatedDegrees(description),
    degreeLevel: extractDegreeLevels(description),
    postedAt: toISO(jsonld?.datePosted),
    slug,
    hash,
    qualityScore: calculateQualityScore({ title, description, applyUrl, companyName }),
    lastValidated: new Date().toISOString()
  };

  // Validate job requirements
  const validation = validateJobRequirements(job);
  if (!validation.valid) {
    console.log(`⏭️  Skipping invalid job: ${title} - ${validation.reason}`);
    return null;
  }

  return job;
}

function extractExperience(description: string): string | undefined {
  const expMatch = description.match(/\b(\d+)\+?\s*(years?|months?)\s*(experience)?/i);
  return expMatch ? expMatch[0] : undefined;
}

function extractRelatedDegrees(description: string): string[] | undefined {
  const degreeKeywords = [
    'civil', 'structural', 'mechanical', 'electrical', 'aerospace', 'automotive',
    'chemical', 'materials', 'computer', 'software', 'biomedical', 'environmental',
    'geotechnical', 'transportation', 'water', 'waste', 'energy', 'nuclear',
    'renewable', 'sustainability', 'architecture', 'planning', 'surveying'
  ];
  
  const found = degreeKeywords.filter(keyword => 
    description.toLowerCase().includes(keyword)
  );
  
  return found.length > 0 ? found.map(k => k[0].toUpperCase() + k.slice(1)) : undefined;
}

function extractDegreeLevels(description: string): string[] | undefined {
  const levels: string[] = [];
  
  if (/\b(beng|bachelor of engineering)\b/i.test(description)) levels.push('BEng');
  if (/\b(meng|master of engineering)\b/i.test(description)) levels.push('MEng');
  if (/\b(bsc|bachelor of science)\b/i.test(description)) levels.push('BSc');
  if (/\b(msc|master of science)\b/i.test(description)) levels.push('MSc');
  if (/\b(msci|master of science integrated)\b/i.test(description)) levels.push('MSci');
  if (/\b(phd|doctorate)\b/i.test(description)) levels.push('PhD');
  if (/\b(2:1|2:2|first class|second class)\b/i.test(description)) levels.push('2:1');
  if (/\b(undergraduate|ug)\b/i.test(description)) levels.push('UG');
  if (/\b(postgraduate|pg|pg-taught)\b/i.test(description)) levels.push('PG-taught');
  
  return levels.length > 0 ? levels : undefined;
}

function calculateQualityScore(job: any): number {
  let score = 0;
  
  // Basic required fields (40 points)
  if (job.title) score += 10;
  if (job.companyName) score += 10;
  if (job.applyUrl) score += 10;
  if (job.description) score += 10;
  
  // Additional quality indicators (60 points)
  if (job.salary) score += 15;
  if (job.companyLogo) score += 10;
  if (job.startDate) score += 10;
  if (job.duration) score += 10;
  if (job.experience) score += 10;
  if (job.postedAt) score += 5;
  
  return Math.min(100, score);
}
