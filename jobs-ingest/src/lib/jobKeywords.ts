export type JobTypeKey = 'graduate' | 'placement' | 'internship';

type IndustryKey =
  | 'finance'
  | 'business'
  | 'investment'
  | 'banking'
  | 'technology'
  | 'software engineering'
  | 'data'
  | 'analytics'
  | 'engineering'
  | 'consulting'
  | 'marketing'
  | 'sales'
  | 'law'
  | 'healthcare'
  | 'biotech'
  | 'pharmaceutical'
  | 'education'
  | 'public sector'
  | 'government'
  | 'charity'
  | 'environment'
  | 'sustainability'
  | 'manufacturing'
  | 'media'
  | 'creative'
  | 'human resources'
  | 'supply chain'
  | 'operations'
  | 'product management'
  | 'design'
  | 'journalism'
  | 'communications';

const GENERAL_TITLES: Record<JobTypeKey, string[]> = {
  graduate: [
    'graduate scheme',
    'graduate analyst',
    'graduate engineer',
    'graduate consultant',
    'graduate trainee',
    'graduate programme'
  ],
  placement: [
    'industrial placement',
    'year in industry',
    'placement year',
    '12 month placement',
    'professional placement'
  ],
  internship: [
    'summer internship',
    'winter internship',
    'spring week',
    'off-cycle internship',
    'paid internship'
  ]
};

const INDUSTRY_TITLES: Partial<Record<IndustryKey, Partial<Record<JobTypeKey, string[]>>>> = {
  finance: {
    graduate: [
      'investment banking analyst',
      'finance graduate scheme',
      'financial analyst graduate',
      'accounting graduate programme'
    ],
    placement: [
      'finance placement',
      'investment banking placement',
      'accounting placement',
      'audit placement'
    ],
    internship: [
      'summer analyst',
      'finance internship',
      'investment banking internship',
      'asset management internship'
    ]
  },
  business: {
    graduate: ['business graduate scheme', 'operations graduate', 'management trainee', 'commercial graduate'],
    placement: ['business placement', 'operations placement', 'commercial placement'],
    internship: ['business internship', 'operations internship', 'strategy internship']
  },
  investment: {
    internship: ['private equity internship', 'investment internship'],
    graduate: ['investment analyst graduate']
  },
  banking: {
    graduate: ['corporate banking graduate', 'risk graduate'],
    internship: ['banking internship', 'risk internship']
  },
  technology: {
    graduate: ['software engineer graduate', 'technology graduate programme', 'data graduate scheme'],
    placement: ['software engineering placement', 'technology placement', 'it placement'],
    internship: ['software engineering internship', 'technology internship', 'data science internship']
  },
  'software engineering': {
    graduate: ['graduate software developer', 'graduate software engineer'],
    placement: ['software engineering placement'],
    internship: ['software developer internship', 'software engineering internship']
  },
  data: {
    graduate: ['data analyst graduate', 'data scientist graduate'],
    placement: ['data science placement'],
    internship: ['data analyst internship', 'data science internship']
  },
  analytics: {
    graduate: ['analytics graduate programme'],
    internship: ['analytics internship']
  },
  engineering: {
    graduate: ['mechanical engineering graduate', 'civil engineering graduate', 'electrical engineering graduate'],
    placement: ['mechanical engineering placement', 'civil engineering placement', 'electrical engineering placement'],
    internship: ['engineering internship', 'mechanical engineering internship']
  },
  consulting: {
    graduate: ['consulting graduate programme', 'strategy graduate'],
    placement: ['consulting placement'],
    internship: ['consulting internship', 'strategy internship']
  },
  marketing: {
    graduate: ['marketing graduate scheme', 'digital marketing graduate'],
    placement: ['marketing placement', 'digital marketing placement'],
    internship: ['marketing internship', 'digital marketing internship']
  },
  sales: {
    graduate: ['sales graduate scheme', 'business development graduate'],
    placement: ['sales placement'],
    internship: ['sales internship', 'business development internship']
  },
  law: {
    graduate: ['paralegal graduate', 'legal graduate programme'],
    placement: ['legal placement'],
    internship: ['legal internship', 'law internship']
  },
  healthcare: {
    graduate: ['biomedical graduate programme', 'healthcare management graduate'],
    placement: ['healthcare placement'],
    internship: ['healthcare internship']
  },
  biotech: {
    internship: ['biotech internship'],
    graduate: ['biotech graduate']
  },
  pharmaceutical: {
    internship: ['pharmaceutical internship'],
    graduate: ['pharmaceutical graduate scheme']
  },
  education: {
    graduate: ['teaching graduate programme'],
    placement: ['education placement'],
    internship: ['education internship']
  },
  'public sector': {
    graduate: ['civil service fast stream', 'public sector graduate scheme'],
    internship: ['public sector internship']
  },
  government: {
    graduate: ['government graduate scheme'],
    internship: ['government internship']
  },
  charity: {
    internship: ['charity internship'],
    graduate: ['charity graduate programme']
  },
  environment: {
    graduate: ['environmental graduate scheme'],
    internship: ['environmental internship'],
    placement: ['environmental placement']
  },
  sustainability: {
    graduate: ['sustainability graduate scheme'],
    internship: ['sustainability internship'],
    placement: ['sustainability placement']
  },
  manufacturing: {
    graduate: ['manufacturing graduate scheme'],
    placement: ['manufacturing placement'],
    internship: ['manufacturing internship']
  },
  media: {
    graduate: ['media graduate scheme', 'journalism graduate programme'],
    internship: ['media internship', 'journalism internship']
  },
  creative: {
    internship: ['graphic design internship', 'creative internship'],
    graduate: ['creative graduate scheme']
  },
  'human resources': {
    graduate: ['hr graduate scheme', 'people graduate programme'],
    placement: ['hr placement'],
    internship: ['hr internship']
  },
  'supply chain': {
    graduate: ['supply chain graduate scheme', 'logistics graduate programme'],
    placement: ['supply chain placement'],
    internship: ['supply chain internship']
  },
  operations: {
    graduate: ['operations graduate scheme'],
    placement: ['operations placement'],
    internship: ['operations internship']
  },
  'product management': {
    graduate: ['product graduate programme'],
    internship: ['product management internship']
  },
  design: {
    internship: ['ux design internship', 'graphic design internship'],
    graduate: ['design graduate programme']
  },
  journalism: {
    internship: ['journalism internship'],
    graduate: ['journalism graduate scheme']
  },
  communications: {
    internship: ['communications internship'],
    graduate: ['communications graduate programme']
  }
};

export function getPopularTitles(industry: string, jobType: JobTypeKey): string[] {
  const lowerIndustry = industry.toLowerCase() as IndustryKey;
  const industryTitles = INDUSTRY_TITLES[lowerIndustry]?.[jobType] ?? [];
  if (industryTitles.length > 0) {
    return [...industryTitles, ...GENERAL_TITLES[jobType]];
  }
  return GENERAL_TITLES[jobType];
}

