/**
 * Realistic URL patterns for graduate job boards
 * These are simple, working URLs that are more likely to contain job listings
 */
export const REALISTIC_URL_PATTERNS = {
  gradcracker: [
    // Main working URLs
    'https://www.gradcracker.com/search/graduate-jobs',
    'https://www.gradcracker.com/search/internships',
    'https://www.gradcracker.com/search/placements',
    'https://www.gradcracker.com/jobs',
    'https://www.gradcracker.com/',
    
    // Simple category pages
    'https://www.gradcracker.com/graduate-jobs',
    'https://www.gradcracker.com/internships',
    'https://www.gradcracker.com/placements'
  ],
  
  targetjobs: [
    // Main working URLs
    'https://targetjobs.co.uk/uk/en/search/offers',
    'https://targetjobs.co.uk/graduate-jobs',
    'https://targetjobs.co.uk/search',
    'https://targetjobs.co.uk/',
    
    // Simple category pages
    'https://targetjobs.co.uk/internships',
    'https://targetjobs.co.uk/placements'
  ],
  
  prospects: [
    // Main working URLs
    'https://www.prospects.ac.uk/graduate-jobs',
    'https://www.prospects.ac.uk/jobs',
    'https://www.prospects.ac.uk/',
    
    // Simple category pages
    'https://www.prospects.ac.uk/internships',
    'https://www.prospects.ac.uk/placements',
    'https://www.prospects.ac.uk/work-experience'
  ],
  
  milkround: [
    // Main working URLs
    'https://www.milkround.com/jobs',
    'https://www.milkround.com/',
    
    // Simple category pages
    'https://www.milkround.com/graduate-jobs',
    'https://www.milkround.com/internships',
    'https://www.milkround.com/placements'
  ],
  
  brightnetwork: [
    // Main working URLs
    'https://www.brightnetwork.co.uk/graduate-jobs',
    'https://www.brightnetwork.co.uk/jobs',
    'https://www.brightnetwork.co.uk/',
    
    // Simple category pages
    'https://www.brightnetwork.co.uk/internships',
    'https://www.brightnetwork.co.uk/placements'
  ],
  
  ratemyplacement: [
    // Main working URLs
    'https://www.ratemyplacement.co.uk/placements',
    'https://www.ratemyplacement.co.uk/',
    
    // Simple category pages
    'https://www.ratemyplacement.co.uk/internships',
    'https://www.ratemyplacement.co.uk/graduate-jobs'
  ]
};

/**
 * Get realistic URL patterns for a specific board
 */
export function getRealisticUrlPatterns(boardKey: string): string[] {
  return REALISTIC_URL_PATTERNS[boardKey as keyof typeof REALISTIC_URL_PATTERNS] || [];
}
