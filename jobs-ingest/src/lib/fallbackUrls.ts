/**
 * Hardcoded fallback URLs for graduate job boards
 * These are known working URLs that we can use as a last resort
 */
export const FALLBACK_URLS = {
  gradcracker: [
    'https://www.gradcracker.com/search/graduate-jobs',
    'https://www.gradcracker.com/',
    'https://www.gradcracker.com/jobs',
    'https://www.gradcracker.com/graduate-jobs'
  ],
  targetjobs: [
    'https://targetjobs.co.uk/uk/en/search/offers',
    'https://targetjobs.co.uk/',
    'https://targetjobs.co.uk/jobs',
    'https://targetjobs.co.uk/graduate-jobs'
  ],
  prospects: [
    'https://www.prospects.ac.uk/job-search',
    'https://www.prospects.ac.uk/',
    'https://www.prospects.ac.uk/jobs',
    'https://www.prospects.ac.uk/graduate-jobs'
  ],
  milkround: [
    'https://www.milkround.com/jobs',
    'https://www.milkround.com/',
    'https://www.milkround.com/graduate-jobs',
    'https://www.milkround.com/search'
  ],
  brightnetwork: [
    'https://www.brightnetwork.co.uk/jobs',
    'https://www.brightnetwork.co.uk/',
    'https://www.brightnetwork.co.uk/graduate-jobs',
    'https://www.brightnetwork.co.uk/search'
  ],
  ratemyplacement: [
    'https://www.ratemyplacement.co.uk/placements',
    'https://www.ratemyplacement.co.uk/',
    'https://www.ratemyplacement.co.uk/jobs',
    'https://www.ratemyplacement.co.uk/search-jobs'
  ]
};

/**
 * Get fallback URLs for a board
 */
export function getFallbackUrls(boardName: string): string[] {
  return FALLBACK_URLS[boardName as keyof typeof FALLBACK_URLS] || [];
}
