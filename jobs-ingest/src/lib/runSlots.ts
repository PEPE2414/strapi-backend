export interface SlotDefinition {
  name: string;
  industries: string[];
  cities: string[];
  useBacklogWindow: boolean;
}

export const SLOT_DEFINITIONS: SlotDefinition[] = [
  {
    name: 'south-finance-business',
    industries: ['finance', 'investment', 'banking', 'accounting', 'business', 'economics', 'consulting', 'actuarial', 'risk management', 'business development'],
    cities: ['london', 'reading', 'oxford', 'cambridge', 'brighton', 'southampton'],
    useBacklogWindow: false
  },
  {
    name: 'midlands-engineering-manufacturing',
    industries: ['engineering', 'mechanical engineering', 'civil engineering', 'automotive', 'manufacturing', 'aerospace', 'energy', 'electrical engineering', 'chemical engineering', 'construction'],
    cities: ['birmingham', 'coventry', 'leicester', 'derby', 'nottingham', 'stoke-on-trent'],
    useBacklogWindow: false
  },
  {
    name: 'north-tech-data-marketing',
    industries: ['technology', 'software engineering', 'data', 'analytics', 'marketing', 'digital', 'product management', 'cyber security', 'ux design', 'product design'],
    cities: ['manchester', 'leeds', 'liverpool', 'newcastle', 'sheffield', 'york'],
    useBacklogWindow: true
  },
  {
    name: 'nations-health-education-law',
    industries: ['healthcare', 'public sector', 'education', 'law', 'government', 'charity', 'environment', 'social work', 'psychology', 'policy'],
    cities: ['glasgow', 'edinburgh', 'cardiff', 'belfast', 'aberdeen', 'swansea'],
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
  return SLOT_DEFINITIONS[slotIndex]?.useBacklogWindow === true;
}

