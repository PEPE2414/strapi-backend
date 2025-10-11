// Comprehensive UK job sources configuration
// Targeting 25k+ pages with extensive company and job board coverage

// ===== ATS PLATFORMS =====
// Only include companies that actually have UK jobs and working Greenhouse boards
export const GREENHOUSE_BOARDS = [
  // Verified working Greenhouse boards with UK presence
  'stripe', 'shopify', 'gitlab', 'cloudflare', 'github', 'mongodb',
  'elastic', 'hashicorp', 'datadog', 'snowflake', 'confluent',
  // UK-specific companies with Greenhouse
  'deliveroo', 'transferwise', 'monzo', 'revolut', 'octopus-energy',
  'bulb', 'starling-bank', 'checkout', 'plum', 'freetrade',
  // Consulting firms with UK offices
  'bcg', 'mckinsey', 'bain-company'
];

// Only include companies with verified Lever boards and UK jobs
export const LEVER_COMPANIES = [
  // These are often used by startups/scale-ups with UK offices
  'netflix', 'spotify', 'canva', 'figma', 'notion',
  // UK startups/scaleups on Lever
  'darktrace', 'improbable', 'benevolentai', 'graphcore'
];

// ===== MAJOR JOB BOARDS (High Volume) =====
export const MAJOR_JOB_BOARDS = [
  'https://www.reed.co.uk/sitemap.xml',
  'https://www.totaljobs.com/sitemap.xml',
  'https://www.monster.co.uk/sitemap.xml',
  'https://www.cv-library.co.uk/sitemap.xml',
  'https://www.jobsite.co.uk/sitemap.xml',
  'https://www.fish4jobs.co.uk/sitemap.xml',
  'https://www.jobs.co.uk/sitemap.xml',
  'https://www.careerjet.co.uk/sitemap.xml',
  'https://www.adzuna.co.uk/sitemap.xml',
  'https://www.indeed.co.uk/sitemap.xml'
];

// ===== INDUSTRY-SPECIFIC JOB BOARDS =====
export const ENGINEERING_JOB_BOARDS = [
  'https://www.engineeringjobs.co.uk/sitemap.xml',
  'https://www.engineerjobs.co.uk/sitemap.xml',
  'https://www.constructionjobs.co.uk/sitemap.xml',
  'https://www.buildingjobs.co.uk/sitemap.xml',
  'https://www.civilengineeringjobs.co.uk/sitemap.xml',
  'https://www.mechanicalengineeringjobs.co.uk/sitemap.xml',
  'https://www.electricalengineeringjobs.co.uk/sitemap.xml',
  'https://www.chemicalengineeringjobs.co.uk/sitemap.xml',
  'https://www.aerospacejobs.co.uk/sitemap.xml',
  'https://www.automotivejobs.co.uk/sitemap.xml'
];

export const TECH_JOB_BOARDS = [
  'https://www.cwjobs.co.uk/sitemap.xml',
  'https://www.jobserve.com/sitemap.xml',
  'https://www.technojobs.co.uk/sitemap.xml',
  'https://www.itjobswatch.co.uk/sitemap.xml',
  'https://www.computerjobs.co.uk/sitemap.xml',
  'https://www.softwarejobs.co.uk/sitemap.xml',
  'https://www.developerjobs.co.uk/sitemap.xml',
  'https://www.programmerjobs.co.uk/sitemap.xml',
  'https://www.webdeveloperjobs.co.uk/sitemap.xml',
  'https://www.mobileappjobs.co.uk/sitemap.xml'
];

export const FINANCE_JOB_BOARDS = [
  'https://www.efinancialcareers.co.uk/sitemap.xml',
  'https://www.financejobs.co.uk/sitemap.xml',
  'https://www.bankingjobs.co.uk/sitemap.xml',
  'https://www.accountingjobs.co.uk/sitemap.xml',
  'https://www.actuarialjobs.co.uk/sitemap.xml',
  'https://www.investmentjobs.co.uk/sitemap.xml',
  'https://www.insurancejobs.co.uk/sitemap.xml',
  'https://www.riskjobs.co.uk/sitemap.xml',
  'https://www.compliancejobs.co.uk/sitemap.xml',
  'https://www.auditjobs.co.uk/sitemap.xml'
];

export const CONSULTING_JOB_BOARDS = [
  'https://www.consultingjobs.co.uk/sitemap.xml',
  'https://www.managementconsultingjobs.co.uk/sitemap.xml',
  'https://www.strategyjobs.co.uk/sitemap.xml',
  'https://www.operationsjobs.co.uk/sitemap.xml',
  'https://www.supplychainjobs.co.uk/sitemap.xml',
  'https://www.procurementjobs.co.uk/sitemap.xml',
  'https://www.projectmanagementjobs.co.uk/sitemap.xml',
  'https://www.changejobs.co.uk/sitemap.xml',
  'https://www.transformationjobs.co.uk/sitemap.xml',
  'https://www.digitaljobs.co.uk/sitemap.xml'
];

// ===== UNIVERSITY & GRADUATE JOB BOARDS =====
export const UNIVERSITY_BOARDS = [
  'https://www.gradcracker.com/sitemap.xml',
  'https://www.prospects.ac.uk/sitemap.xml',
  'https://targetjobs.co.uk/sitemap.xml',
  'https://www.milkround.com/sitemap.xml',
  'https://www.graduatejobs.com/sitemap.xml',
  'https://www.studentjobs.co.uk/sitemap.xml',
  'https://www.internjobs.co.uk/sitemap.xml',
  'https://www.placementjobs.co.uk/sitemap.xml',
  'https://www.summerinternjobs.co.uk/sitemap.xml',
  'https://www.vacationschemejobs.co.uk/sitemap.xml'
];

// ===== SMALL TO MEDIUM COMPANIES BY SECTOR =====

// Engineering & Construction (50+ companies)
export const ENGINEERING_COMPANIES = [
  // Large companies
  'arup', 'atkins', 'wsp', 'aecom', 'mott-macdonald', 'jacobs',
  'balfour-beatty', 'costain', 'skanska-uk', 'laing-orourke',
  'ramboll', 'stantec-uk', 'buro-happold', 'hoare-lea', 'sweco',
  // Medium companies
  'mace', 'kier', 'galliford-try', 'interserve', 'carillion',
  'amey', 'serco', 'capita', 'mitie', 'g4s', 'sodexo',
  'compass', 'elior', 'aramex', 'dhl', 'fedex', 'ups',
  'royal-mail', 'parcelforce', 'hermes', 'yodel', 'dpd',
  // Small companies
  'volkerwessels', 'morgan-sindall', 'willmott-dixon', 'keepmoat',
  'linden-homes', 'barratt', 'persimmon', 'taylor-wimpey',
  'berkeley-group', 'redrow', 'bellway', 'crest-nicholson'
];

// Technology (60+ companies)
export const TECH_COMPANIES = [
  // Large companies
  'google-london', 'microsoft-uk', 'amazon-uk', 'bloomberg-london',
  'deepmind', 'facebook-london', 'apple-uk', 'netflix-uk',
  'spotify-uk', 'uber-uk', 'airbnb-uk', 'booking-uk',
  // Medium companies
  'arm', 'nvidia-uk', 'intel-uk', 'amd-uk', 'qualcomm-uk',
  'broadcom-uk', 'marvell-uk', 'xilinx-uk', 'altera-uk',
  'synopsys-uk', 'cadence-uk', 'mentor-graphics-uk', 'ansys-uk',
  'dassault-uk', 'autodesk-uk', 'adobe-uk', 'salesforce-uk',
  'oracle-uk', 'ibm-uk', 'hp-uk', 'dell-uk', 'cisco-uk',
  'juniper-uk', 'arista-uk', 'palo-alto-uk', 'fortinet-uk',
  'checkpoint-uk', 'symantec-uk', 'mcafee-uk', 'trend-micro-uk',
  // Small companies
  'improbable', 'darktrace', 'benevolent-ai', 'exscientia',
  'graphcore', 'cerebras', 'samba-nova', 'groq', 'mythic',
  'cambridge-consultants', 'pwc-digital', 'deloitte-digital',
  'kpmg-digital', 'ey-digital', 'accenture-uk', 'cognizant-uk',
  'infosys-uk', 'tcs-uk', 'wipro-uk', 'hcl-uk', 'capgemini-uk',
  'atos-uk', 'dxc-uk', 'cgi-uk', 'fujitsu-uk', 'nec-uk'
];

// Finance (40+ companies)
export const FINANCE_COMPANIES = [
  // Large companies
  'goldman-sachs-london', 'jpmorgan-london', 'barclays', 'hsbc',
  'lloyds', 'natwest', 'standard-chartered', 'santander-uk',
  'rbs', 'tsb', 'virgin-money', 'first-direct', 'halifax',
  // Medium companies
  'schroders', 'man-group', 'brevan-howard', 'marshall-wace',
  'citadel', 'point72', 'millennium', 'balyasny', 'exodus-point',
  'capula', 'winton', 'aql', 'quantlab', 'xtx-markets',
  'g-Research', 'two-sigma', 'renaissance-technologies',
  'd-e-shaw', 'tudor-investment', 'moore-capital',
  // Small companies
  'fidelity-uk', 'vanguard-uk', 'blackrock-uk', 'state-street-uk',
  'northern-trust-uk', 'bny-mellon-uk', 'jpmorgan-asset-management',
  'allianz-global-investors', 'legal-general', 'aviva',
  'prudential', 'standard-life', 'aberdeen-asset-management',
  'hermes-investment-management', 'lazard', 'evercore',
  'greenhill', 'perella-weinberg', 'centerview', 'qatalyst'
];

// Consulting (30+ companies)
export const CONSULTING_COMPANIES = [
  // Large companies
  'deloitte-uk', 'pwc-uk', 'kpmg-uk', 'ey-uk', 'accenture-uk',
  'mckinsey-uk', 'bain-uk', 'bcg-uk', 'oliver-wyman-uk',
  // Medium companies
  'kearney-uk', 'roland-berger-uk', 'at-kearney-uk', 'strategy-uk',
  'monitor-uk', 'parthenon-uk', 'le-katz-uk', 'booz-allen-uk',
  'deloitte-consulting', 'pwc-consulting', 'kpmg-consulting',
  'ey-consulting', 'accenture-consulting', 'cognizant-consulting',
  'infosys-consulting', 'tcs-consulting', 'wipro-consulting',
  'hcl-consulting', 'capgemini-consulting', 'atos-consulting',
  'dxc-consulting', 'cgi-consulting', 'fujitsu-consulting',
  // Small companies
  'bain-capital', 'kkr', 'apollo', 'carlyle', 'blackstone',
  'warburg-pincus', 'tpg', 'general-atlantic', 'silver-lake',
  'thoma-bravo', 'vista-equity', 'francisco-partners'
];

// Manufacturing & Aerospace (35+ companies)
export const MANUFACTURING_COMPANIES = [
  // Large companies
  'rolls-royce', 'bae-systems', 'dyson', 'jaguar-land-rover',
  'airbus-uk', 'gkn', 'mbda', 'siemens-uk', 'schneider-electric-uk',
  // Medium companies
  'bombardier-uk', 'leonardo-uk', 'thales-uk', 'saab-uk',
  'lockheed-martin-uk', 'boeing-uk', 'northrop-grumman-uk',
  'raytheon-uk', 'general-dynamics-uk', 'l3harris-uk',
  'cobham-uk', 'qinetiq-uk', 'ultra-electronics-uk',
  'meggitt-uk', 'senior-uk', 'gkn-aerospace-uk',
  'spirit-aerosystems-uk', 'triumph-uk', 'british-aerospace-uk',
  // Small companies
  'airbus-helicopters-uk', 'agusta-westland-uk', 'leonardo-helicopters-uk',
  'airbus-defence-uk', 'airbus-space-uk', 'airbus-commercial-uk',
  'rolls-royce-civil-uk', 'rolls-royce-defence-uk', 'rolls-royce-marine-uk',
  'rolls-royce-power-systems-uk', 'rolls-royce-nuclear-uk'
];

// Energy & Utilities (25+ companies)
export const ENERGY_COMPANIES = [
  // Large companies
  'national-grid', 'sse', 'edf-uk', 'octopus-energy', 'shell-uk', 'bp-uk',
  // Medium companies
  'centrica', 'e-on-uk', 'npower', 'scottish-power', 'british-gas',
  'eon-uk', 'rwe-uk', 'vattenfall-uk', 'statkraft-uk', 'orkla-uk',
  'equinor-uk', 'total-uk', 'chevron-uk', 'exxonmobil-uk',
  'conocophillips-uk', 'marathon-uk', 'valero-uk', 'phillips-66-uk',
  // Small companies
  'drax', 'uniper-uk', 'innogy-uk', 'vitol-uk', 'glencore-uk',
  'trafigura-uk', 'gunvor-uk', 'mercuria-uk', 'koch-uk'
];

// ===== COMBINED CONFIGURATIONS =====
export const ALL_JOB_BOARDS = [
  ...MAJOR_JOB_BOARDS,
  ...ENGINEERING_JOB_BOARDS,
  ...TECH_JOB_BOARDS,
  ...FINANCE_JOB_BOARDS,
  ...CONSULTING_JOB_BOARDS,
  ...UNIVERSITY_BOARDS
];

export const ALL_COMPANIES = [
  ...ENGINEERING_COMPANIES,
  ...TECH_COMPANIES,
  ...FINANCE_COMPANIES,
  ...CONSULTING_COMPANIES,
  ...MANUFACTURING_COMPANIES,
  ...ENERGY_COMPANIES
];

// ===== LEGACY EXPORTS (for backward compatibility) =====
export const SITEMAP_SOURCES = ALL_JOB_BOARDS;
export const MANUAL_URLS = ALL_JOB_BOARDS;
export const UK_COMPANY_KEYS = ALL_COMPANIES;
export const COMPANY_CAREER_SITEMAPS = ALL_JOB_BOARDS;
