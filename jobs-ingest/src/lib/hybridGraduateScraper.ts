import { scrapeUrlsWithHybrid } from './hybridScraper';
import { CanonicalJob } from '../types';

/**
 * Hybrid scraper for graduate job boards
 * Uses multiple strategies to ensure maximum job discovery
 */
export async function scrapeGraduateBoardsHybrid(): Promise<CanonicalJob[]> {
  const allJobs: CanonicalJob[] = [];
  
  // Graduate job board configurations with multiple URLs per board
  const boardConfigs = {
    gradcracker: {
      name: 'Gradcracker',
      urls: [
        'https://www.gradcracker.com/search/graduate-jobs',
        'https://www.gradcracker.com/search/internships',
        'https://www.gradcracker.com/search/placements',
        'https://www.gradcracker.com/jobs',
        'https://www.gradcracker.com/',
        'https://www.gradcracker.com/graduate-jobs',
        'https://www.gradcracker.com/internships',
        'https://www.gradcracker.com/placements'
      ]
    },
    targetjobs: {
      name: 'TARGETjobs',
      urls: [
        'https://targetjobs.co.uk/uk/en/search/offers',
        'https://targetjobs.co.uk/graduate-jobs',
        'https://targetjobs.co.uk/search',
        'https://targetjobs.co.uk/',
        'https://targetjobs.co.uk/internships',
        'https://targetjobs.co.uk/placements',
        'https://targetjobs.co.uk/graduate-schemes'
      ]
    },
    prospects: {
      name: 'Prospects',
      urls: [
        'https://www.prospects.ac.uk/graduate-jobs',
        'https://www.prospects.ac.uk/jobs',
        'https://www.prospects.ac.uk/',
        'https://www.prospects.ac.uk/internships',
        'https://www.prospects.ac.uk/placements',
        'https://www.prospects.ac.uk/work-experience',
        'https://www.prospects.ac.uk/graduate-schemes'
      ]
    },
    brightnetwork: {
      name: 'Bright Network',
      urls: [
        'https://www.brightnetwork.co.uk/graduate-jobs',
        'https://www.brightnetwork.co.uk/jobs',
        'https://www.brightnetwork.co.uk/',
        'https://www.brightnetwork.co.uk/internships',
        'https://www.brightnetwork.co.uk/placements',
        'https://www.brightnetwork.co.uk/graduate-schemes'
      ]
    },
    ratemyplacement: {
      name: 'Higherin (formerly Rate My Placement)',
      urls: [
        'https://higherin.com/search-jobs',
        'https://higherin.com/placements',
        'https://higherin.com/internships',
        'https://higherin.com/graduate-jobs',
        'https://higherin.com/graduate-schemes',
        'https://www.ratemyplacement.co.uk/placements',
        'https://www.ratemyplacement.co.uk/internships',
        'https://www.ratemyplacement.co.uk/'
      ]
    },
    trackr: {
      name: 'Trackr (formerly Bristol Tracker)',
      urls: [
        'https://the-trackr.com',
        'https://the-trackr.com/uk-finance',
        'https://the-trackr.com/uk-technology',
        'https://the-trackr.com/uk-law',
        'https://the-trackr.com/north-america-finance',
        'https://the-trackr.com/eu-finance',
        'https://the-trackr.com/jobs',
        'https://the-trackr.com/graduate-jobs',
        'https://the-trackr.com/internships',
        'https://the-trackr.com/placements',
        'https://the-trackr.com/programs',
        'https://the-trackr.com/schemes'
      ]
    }
  };
  
  // Scrape each board with hybrid approach
  for (const [boardKey, config] of Object.entries(boardConfigs)) {
    console.log(`\n🎯 Hybrid scraping ${config.name}...`);
    
    try {
      const jobs = await scrapeUrlsWithHybrid(config.urls, config.name, boardKey);
      
      if (jobs.length > 0) {
        console.log(`✅ ${config.name}: Found ${jobs.length} jobs`);
        allJobs.push(...jobs);
      } else {
        console.log(`⚠️  ${config.name}: No jobs found`);
      }
    } catch (error) {
      console.warn(`❌ ${config.name} failed:`, error instanceof Error ? error.message : String(error));
    }
  }
  
  console.log(`\n📊 Hybrid scraping completed: ${allJobs.length} total jobs`);
  return allJobs;
}
