export interface SlotDefinition {
  name: string;
  industries: string[];
  cities: string[];
  useBacklogWindow: boolean;
}

export const SLOT_DEFINITIONS: SlotDefinition[] = [
  {
    name: 'south-finance-business',
    industries: ['finance', 'investment', 'banking', 'accounting', 'business', 'economics', 'consulting', 'actuarial', 'risk management', 'business development', 'audit', 'tax', 'corporate finance', 'wealth management', 'private equity', 'venture capital', 'asset management', 'insurance', 'real estate', 'commercial banking'],
    cities: ['london', 'reading', 'oxford', 'cambridge', 'brighton', 'southampton', 'guildford', 'maidstone', 'canterbury', 'portsmouth', 'winchester', 'basingstoke'],
    useBacklogWindow: false
  },
  {
    name: 'midlands-engineering-manufacturing',
    industries: ['engineering', 'mechanical engineering', 'civil engineering', 'automotive', 'manufacturing', 'aerospace', 'energy', 'electrical engineering', 'chemical engineering', 'construction', 'materials engineering', 'structural engineering', 'environmental engineering', 'nuclear engineering', 'rail engineering', 'process engineering', 'quality engineering', 'project engineering', 'design engineering', 'production engineering'],
    cities: ['birmingham', 'coventry', 'leicester', 'derby', 'nottingham', 'stoke-on-trent', 'wolverhampton', 'walsall', 'dudley', 'solihull', 'nuneaton', 'rugby'],
    useBacklogWindow: false
  },
  {
    name: 'north-tech-data-marketing',
    industries: ['technology', 'software engineering', 'data', 'analytics', 'marketing', 'digital', 'product management', 'cyber security', 'ux design', 'product design', 'data science', 'machine learning', 'artificial intelligence', 'cloud computing', 'devops', 'full stack', 'frontend', 'backend', 'mobile development', 'game development', 'e-commerce', 'social media marketing', 'content marketing', 'seo', 'ppc'],
    cities: ['manchester', 'leeds', 'liverpool', 'newcastle', 'sheffield', 'york', 'preston', 'blackburn', 'bolton', 'oldham', 'rochdale', 'stockport', 'warrington', 'chester'],
    useBacklogWindow: true
  },
  {
    name: 'nations-health-education-law',
    industries: ['healthcare', 'public sector', 'education', 'law', 'government', 'charity', 'environment', 'social work', 'psychology', 'policy', 'nursing', 'medicine', 'pharmacy', 'dentistry', 'veterinary', 'public health', 'mental health', 'criminal law', 'corporate law', 'family law', 'employment law', 'environmental law', 'human rights', 'policy analysis', 'research'],
    cities: ['glasgow', 'edinburgh', 'cardiff', 'belfast', 'aberdeen', 'swansea', 'dundee', 'inverness', 'stirling', 'perth', 'newport', 'wrexham'],
    useBacklogWindow: true
  },
  {
    name: 'placement-all-industries',
    industries: [
      'finance', 'business', 'engineering', 'technology', 'consulting', 'marketing', 'sales', 'law', 'healthcare', 'education',
      'public sector', 'environment', 'analytics', 'supply chain', 'operations', 'manufacturing', 'fmcg', 'media', 'creative',
      'human resources', 'data science'
    ],
    cities: [
      'london', 'manchester', 'birmingham', 'leeds', 'glasgow', 'edinburgh', 'bristol', 'liverpool', 'cardiff', 'belfast',
      'sheffield', 'nottingham', 'newcastle', 'oxford', 'cambridge'
    ],
    useBacklogWindow: true
  },
  {
    name: 'internship-all-industries',
    industries: [
      'finance', 'investment', 'banking', 'consulting', 'technology', 'software engineering', 'data', 'analytics', 'marketing',
      'product management', 'design', 'engineering', 'manufacturing', 'media', 'journalism', 'communications', 'law',
      'healthcare', 'biotech', 'pharmaceutical', 'education', 'public sector', 'charity', 'environment', 'sustainability'
    ],
    cities: [
      'london', 'manchester', 'birmingham', 'leeds', 'glasgow', 'edinburgh', 'bristol', 'liverpool', 'nottingham', 'newcastle',
      'sheffield', 'oxford', 'cambridge', 'cardiff', 'belfast'
    ],
    useBacklogWindow: true
  },
  {
    name: 'graduate-all-industries',
    industries: [
      'finance', 'investment', 'banking', 'consulting', 'technology', 'software engineering', 'data', 'analytics', 'marketing',
      'product management', 'engineering', 'manufacturing', 'law', 'healthcare', 'biotech', 'pharmaceutical', 'education',
      'public sector', 'government', 'charity', 'environment', 'media', 'creative', 'human resources', 'supply chain', 'operations'
    ],
    cities: [
      'london', 'manchester', 'birmingham', 'leeds', 'glasgow', 'edinburgh', 'bristol', 'liverpool', 'nottingham', 'newcastle',
      'sheffield', 'oxford', 'cambridge', 'cardiff', 'belfast'
    ],
    useBacklogWindow: true
  }
];

export function getCurrentRunSlot(totalSlots: number = SLOT_DEFINITIONS.length): { slotIndex: number; hoursPerSlot: number } {
  const hoursPerSlot = Math.max(1, Math.floor(24 / totalSlots));
  const override = process.env.RUN_SLOT_INDEX ?? process.env.RUN_SLOT_OVERRIDE;
  if (override !== undefined) {
    const parsed = Number(override);
    if (!Number.isNaN(parsed)) {
      const normalized = ((Math.floor(parsed) % totalSlots) + totalSlots) % totalSlots;
      return { slotIndex: normalized, hoursPerSlot };
    }
  }
  const currentHour = new Date().getHours();
  const slotIndex = Math.floor(currentHour / hoursPerSlot) % totalSlots;
  return { slotIndex, hoursPerSlot };
}

export function isBacklogSlot(slotIndex: number): boolean {
  if (process.env.RUN_BACKLOG === '1') {
    return true;
  }
  if (process.env.RUN_FRESH_ONLY === '1') {
    return false;
  }
  return SLOT_DEFINITIONS[slotIndex]?.useBacklogWindow === true;
}

export function buildPlacementBoostTerms(slot: SlotDefinition): string[] {
  const terms = new Set<string>();
  // Increased from 400 to 2000 to reach 100k jobs target
  const MAX_TERMS = 2000;

  const add = (value: string) => {
    const cleaned = value.trim().toLowerCase();
    if (!cleaned) return;
    if (terms.has(cleaned)) return;
    if (terms.size >= MAX_TERMS) return;
    terms.add(cleaned);
  };

  const generic = [
    'placement uk',
    'placement jobs uk',
    'placement year uk',
    'year in industry uk',
    'industrial placement uk',
    'industrial placement year uk',
    'industrial trainee uk',
    'industrial training placement uk',
    'undergraduate placement uk',
    'placement scheme uk',
    'placement programme uk',
    'placement student uk',
    'professional placement uk'
  ];
  generic.forEach(add);

  slot.industries.forEach(industry => {
    add(`${industry} placement`);
    add(`${industry} placement uk`);
    add(`${industry} placement year`);
    add(`${industry} year in industry`);
    add(`${industry} industrial placement`);
    add(`${industry} undergraduate placement`);
    add(`${industry} placement scheme`);
    add(`industrial placement ${industry}`);
    add(`placement year in ${industry}`);
    add(`year in industry ${industry}`);
    add(`placement student ${industry}`);
  });

  slot.cities.forEach(city => {
    add(`placement jobs ${city}`);
    add(`placement year ${city}`);
    add(`year in industry ${city}`);
    add(`industrial placement ${city}`);
    add(`undergraduate placement ${city}`);
    add(`${city} placement scheme`);
    add(`${city} placement student`);
  });

  return Array.from(terms);
}

