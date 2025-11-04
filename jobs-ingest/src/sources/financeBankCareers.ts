import { CanonicalJob } from '../types';
import { scrapeUrlsWithHybrid } from '../lib/hybridScraper';

/**
 * Finance and Bank Career Sites Scraper
 * Scrapes major finance and bank career sites for placements, graduate jobs, and internships
 * Runs once per week
 */

interface FinanceBankSite {
  key: string;
  name: string;
  urls: string[];
}

// Major finance and bank career sites with their job pages
const FINANCE_BANK_SITES: FinanceBankSite[] = [
  {
    key: 'goldman-sachs',
    name: 'Goldman Sachs',
    urls: [
      'https://www.goldmansachs.com/careers/students-and-graduates/index.html',
      'https://www.goldmansachs.com/careers/students-and-graduates/graduate-opportunities.html',
      'https://www.goldmansachs.com/careers/students-and-graduates/internships.html',
      'https://www.goldmansachs.com/careers/students-and-graduates/insight-programs.html',
      'https://www.goldmansachs.com/careers/students-and-graduates/industrial-placements.html'
    ]
  },
  {
    key: 'jpmorgan',
    name: 'JPMorgan Chase',
    urls: [
      'https://careers.jpmorgan.com/us/en/students/programs',
      'https://careers.jpmorgan.com/us/en/students/programs/graduate',
      'https://careers.jpmorgan.com/us/en/students/programs/internship',
      'https://careers.jpmorgan.com/us/en/students/programs/spring-week',
      'https://careers.jpmorgan.com/uk/en/students/programs'
    ]
  },
  {
    key: 'morgan-stanley',
    name: 'Morgan Stanley',
    urls: [
      'https://www.morganstanley.com/people-opportunities/students-graduates',
      'https://www.morganstanley.com/people-opportunities/students-graduates/graduate-program',
      'https://www.morganstanley.com/people-opportunities/students-graduates/internships',
      'https://www.morganstanley.com/people-opportunities/students-graduates/industrial-placements'
    ]
  },
  {
    key: 'barclays',
    name: 'Barclays',
    urls: [
      'https://www.barclays.co.uk/about-barclays/careers/students-and-graduates/',
      'https://www.barclays.co.uk/about-barclays/careers/students-and-graduates/graduate-programmes/',
      'https://www.barclays.co.uk/about-barclays/careers/students-and-graduates/internships/',
      'https://www.barclays.co.uk/about-barclays/careers/students-and-graduates/industrial-placements/'
    ]
  },
  {
    key: 'hsbc',
    name: 'HSBC',
    urls: [
      'https://www.hsbc.com/careers/students-and-graduates',
      'https://www.hsbc.com/careers/students-and-graduates/graduate-programmes',
      'https://www.hsbc.com/careers/students-and-graduates/internships',
      'https://www.hsbc.com/careers/students-and-graduates/industrial-placements'
    ]
  },
  {
    key: 'lloyds',
    name: 'Lloyds Banking Group',
    urls: [
      'https://www.lloydsbankinggroup.com/careers/students-and-graduates.html',
      'https://www.lloydsbankinggroup.com/careers/students-and-graduates/graduate-programmes.html',
      'https://www.lloydsbankinggroup.com/careers/students-and-graduates/internships.html',
      'https://www.lloydsbankinggroup.com/careers/students-and-graduates/industrial-placements.html'
    ]
  },
  {
    key: 'natwest',
    name: 'NatWest Group',
    urls: [
      'https://www.natwestgroup.com/careers/students-and-graduates.html',
      'https://www.natwestgroup.com/careers/students-and-graduates/graduate-programmes.html',
      'https://www.natwestgroup.com/careers/students-and-graduates/internships.html',
      'https://www.natwestgroup.com/careers/students-and-graduates/industrial-placements.html'
    ]
  },
  {
    key: 'standard-chartered',
    name: 'Standard Chartered',
    urls: [
      'https://www.sc.com/careers/students-and-graduates/',
      'https://www.sc.com/careers/students-and-graduates/graduate-programmes/',
      'https://www.sc.com/careers/students-and-graduates/internships/',
      'https://www.sc.com/careers/students-and-graduates/industrial-placements/'
    ]
  },
  {
    key: 'rbs',
    name: 'Royal Bank of Scotland',
    urls: [
      'https://www.rbs.com/careers/students-and-graduates.html',
      'https://www.rbs.com/careers/students-and-graduates/graduate-programmes.html',
      'https://www.rbs.com/careers/students-and-graduates/internships.html'
    ]
  },
  {
    key: 'santander',
    name: 'Santander UK',
    urls: [
      'https://www.santander.co.uk/about-santander/careers/students-and-graduates',
      'https://www.santander.co.uk/about-santander/careers/students-and-graduates/graduate-programmes',
      'https://www.santander.co.uk/about-santander/careers/students-and-graduates/internships'
    ]
  },
  {
    key: 'deutsche-bank',
    name: 'Deutsche Bank',
    urls: [
      'https://careers.db.com/uk/en/students-and-graduates',
      'https://careers.db.com/uk/en/students-and-graduates/graduate-programmes',
      'https://careers.db.com/uk/en/students-and-graduates/internships',
      'https://careers.db.com/uk/en/students-and-graduates/industrial-placements'
    ]
  },
  {
    key: 'ubs',
    name: 'UBS',
    urls: [
      'https://www.ubs.com/global/en/careers/students-and-graduates.html',
      'https://www.ubs.com/global/en/careers/students-and-graduates/graduate-programmes.html',
      'https://www.ubs.com/global/en/careers/students-and-graduates/internships.html',
      'https://www.ubs.com/global/en/careers/students-and-graduates/industrial-placements.html'
    ]
  },
  {
    key: 'credit-suisse',
    name: 'Credit Suisse',
    urls: [
      'https://www.credit-suisse.com/careers/en/students-and-graduates.html',
      'https://www.credit-suisse.com/careers/en/students-and-graduates/graduate-programmes.html',
      'https://www.credit-suisse.com/careers/en/students-and-graduates/internships.html'
    ]
  },
  {
    key: 'schroders',
    name: 'Schroders',
    urls: [
      'https://www.schroders.com/en/careers/students-and-graduates/',
      'https://www.schroders.com/en/careers/students-and-graduates/graduate-programmes/',
      'https://www.schroders.com/en/careers/students-and-graduates/internships/',
      'https://www.schroders.com/en/careers/students-and-graduates/industrial-placements/'
    ]
  },
  {
    key: 'man-group',
    name: 'Man Group',
    urls: [
      'https://www.man.com/careers/students-and-graduates',
      'https://www.man.com/careers/students-and-graduates/graduate-programmes',
      'https://www.man.com/careers/students-and-graduates/internships'
    ]
  },
  {
    key: 'brevan-howard',
    name: 'Brevan Howard',
    urls: [
      'https://www.brevanhoward.com/careers/students-and-graduates',
      'https://www.brevanhoward.com/careers/students-and-graduates/graduate-programmes',
      'https://www.brevanhoward.com/careers/students-and-graduates/internships'
    ]
  },
  {
    key: 'marshall-wace',
    name: 'Marshall Wace',
    urls: [
      'https://www.marshallwace.com/careers/students-and-graduates',
      'https://www.marshallwace.com/careers/students-and-graduates/graduate-programmes',
      'https://www.marshallwace.com/careers/students-and-graduates/internships'
    ]
  },
  {
    key: 'citadel',
    name: 'Citadel',
    urls: [
      'https://www.citadel.com/careers/students-and-graduates',
      'https://www.citadel.com/careers/students-and-graduates/graduate-programmes',
      'https://www.citadel.com/careers/students-and-graduates/internships'
    ]
  },
  {
    key: 'point72',
    name: 'Point72',
    urls: [
      'https://www.point72.com/careers/students-and-graduates',
      'https://www.point72.com/careers/students-and-graduates/graduate-programmes',
      'https://www.point72.com/careers/students-and-graduates/internships'
    ]
  },
  {
    key: 'millennium',
    name: 'Millennium Management',
    urls: [
      'https://www.mlp.com/careers/students-and-graduates',
      'https://www.mlp.com/careers/students-and-graduates/graduate-programmes',
      'https://www.mlp.com/careers/students-and-graduates/internships'
    ]
  },
  {
    key: 'balyasny',
    name: 'Balyasny Asset Management',
    urls: [
      'https://www.balyasny.com/careers/students-and-graduates',
      'https://www.balyasny.com/careers/students-and-graduates/graduate-programmes',
      'https://www.balyasny.com/careers/students-and-graduates/internships'
    ]
  },
  {
    key: 'exodus-point',
    name: 'Exodus Point',
    urls: [
      'https://www.exoduspoint.com/careers/students-and-graduates',
      'https://www.exoduspoint.com/careers/students-and-graduates/graduate-programmes',
      'https://www.exoduspoint.com/careers/students-and-graduates/internships'
    ]
  },
  {
    key: 'bank-of-america',
    name: 'Bank of America',
    urls: [
      'https://careers.bankofamerica.com/en-us/campus-students',
      'https://careers.bankofamerica.com/en-us/campus-students/graduate-programmes',
      'https://careers.bankofamerica.com/en-us/campus-students/internships',
      'https://careers.bankofamerica.com/en-us/campus-students/industrial-placements'
    ]
  },
  {
    key: 'citi',
    name: 'Citigroup',
    urls: [
      'https://jobs.citi.com/students-and-graduates',
      'https://jobs.citi.com/students-and-graduates/graduate-programmes',
      'https://jobs.citi.com/students-and-graduates/internships',
      'https://jobs.citi.com/students-and-graduates/industrial-placements'
    ]
  },
  {
    key: 'bnp-paribas',
    name: 'BNP Paribas',
    urls: [
      'https://group.bnpparibas/en/careers/students-and-graduates',
      'https://group.bnpparibas/en/careers/students-and-graduates/graduate-programmes',
      'https://group.bnpparibas/en/careers/students-and-graduates/internships'
    ]
  },
  {
    key: 'societe-generale',
    name: 'Société Générale',
    urls: [
      'https://careers.societegenerale.com/students-and-graduates',
      'https://careers.societegenerale.com/students-and-graduates/graduate-programmes',
      'https://careers.societegenerale.com/students-and-graduates/internships'
    ]
  },
  {
    key: 'credit-agricole',
    name: 'Crédit Agricole',
    urls: [
      'https://www.credit-agricole.com/en/careers/students-and-graduates',
      'https://www.credit-agricole.com/en/careers/students-and-graduates/graduate-programmes',
      'https://www.credit-agricole.com/en/careers/students-and-graduates/internships'
    ]
  }
];

/**
 * Scrape all finance and bank career sites for placements, graduate jobs, and internships
 */
export async function scrapeFinanceBankCareers(): Promise<CanonicalJob[]> {
  const allJobs: CanonicalJob[] = [];
  
  console.log(`🏦 Scraping ${FINANCE_BANK_SITES.length} finance and bank career sites...`);
  
  for (const site of FINANCE_BANK_SITES) {
    try {
      console.log(`\n🏛️  Scraping ${site.name}...`);
      
      // Use hybrid scraper (Playwright + ScraperAPI) for these enterprise sites
      // These sites often have Cloudflare protection and dynamic content
      const siteJobs = await scrapeUrlsWithHybrid(
        site.urls.slice(0, 5), // Limit to first 5 URLs per site to avoid timeouts
        site.name,
        site.key
      );
      
      if (siteJobs.length > 0) {
        console.log(`  ✅ ${site.name}: Found ${siteJobs.length} jobs`);
        allJobs.push(...siteJobs);
      } else {
        console.log(`  ⚠️  ${site.name}: No jobs found`);
      }
      
      // Rate limiting between sites
      await new Promise(resolve => setTimeout(resolve, 3000)); // 3 second delay between sites
      
    } catch (error) {
      console.warn(`  ❌ Failed to scrape ${site.name}:`, error instanceof Error ? error.message : String(error));
    }
  }
  
  console.log(`\n📊 Finance & Bank Career Sites: Found ${allJobs.length} total jobs`);
  return allJobs;
}

