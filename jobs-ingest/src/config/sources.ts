// Configuration for job sources
// Realistic sources for 25k+ pages

export const GREENHOUSE_BOARDS = [
  // Companies with confirmed public Greenhouse boards
  'stripe', 'airbnb', 'bcg', 'tcs'
];

export const LEVER_COMPANIES = [
  // Companies with confirmed Lever boards
  'netflix', 'spotify'
];

export const MANUAL_URLS = [
  // Specific high-volume job pages
  'https://www.gradcracker.com/sitemap.xml',
  'https://targetjobs.co.uk/sitemap.xml',
  'https://www.prospects.ac.uk/sitemap.xml',
  'https://uk.indeed.com/sitemap.xml',
  'https://www.reed.co.uk/sitemap.xml',
  'https://www.totaljobs.com/sitemap.xml',
  'https://www.cv-library.co.uk/sitemap.xml',
  'https://www.monster.co.uk/sitemap.xml'
];

export const SITEMAP_SOURCES = [
  // Working job board sitemaps - let's try some different approaches
  'https://www.reed.co.uk/sitemap.xml',
  'https://www.totaljobs.com/sitemap.xml',
  'https://www.monster.co.uk/sitemap.xml',
  'https://www.jobsite.co.uk/sitemap.xml'
];

// High-volume company career pages
export const COMPANY_CAREER_SITEMAPS = [
  'https://careers.atkinsglobal.com/sitemap.xml',
  'https://careers.jacobs.com/sitemap.xml'
];
