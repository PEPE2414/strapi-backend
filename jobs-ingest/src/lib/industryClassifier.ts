import { Industry, INDUSTRIES } from '../types';

type ClassifyIndustryInput = {
  title?: string;
  description?: string;
  company?: string;
  hints?: string[];
  query?: string;
};

type HintRule = {
  keyword: string;
  industry: Industry;
  score: number;
};

type PatternRule = {
  pattern: RegExp;
  industry: Industry;
  score: number;
};

const HINT_RULES: HintRule[] = [
  { keyword: 'account', industry: 'Accounting & Finance', score: 3 },
  { keyword: 'finance', industry: 'Accounting & Finance', score: 3 },
  { keyword: 'bank', industry: 'Banking & Investment', score: 4 },
  { keyword: 'investment', industry: 'Banking & Investment', score: 4 },
  { keyword: 'trading', industry: 'Banking & Investment', score: 3 },
  { keyword: 'actuarial', industry: 'Accounting & Finance', score: 3 },
  { keyword: 'aerospace', industry: 'Aerospace & Defence', score: 4 },
  { keyword: 'defence', industry: 'Aerospace & Defence', score: 4 },
  { keyword: 'defense', industry: 'Aerospace & Defence', score: 4 },
  { keyword: 'agric', industry: 'Agriculture & Farming', score: 4 },
  { keyword: 'farming', industry: 'Agriculture & Farming', score: 4 },
  { keyword: 'architecture', industry: 'Architecture', score: 4 },
  { keyword: 'architect', industry: 'Architecture', score: 4 },
  { keyword: 'automotive', industry: 'Automotive', score: 4 },
  { keyword: 'vehicle', industry: 'Automotive', score: 3 },
  { keyword: 'motorsport', industry: 'Automotive', score: 3 },
  { keyword: 'biotech', industry: 'Biotechnology', score: 4 },
  { keyword: 'biolog', industry: 'Biotechnology', score: 3 },
  { keyword: 'chemical engineering', industry: 'Chemical Engineering', score: 5 },
  { keyword: 'civil engineering', industry: 'Civil Engineering', score: 5 },
  { keyword: 'mechanical engineering', industry: 'Mechanical Engineering', score: 5 },
  { keyword: 'electrical engineering', industry: 'Electrical Engineering', score: 5 },
  { keyword: 'consult', industry: 'Consulting', score: 4 },
  { keyword: 'construction', industry: 'Construction', score: 4 },
  { keyword: 'creative', industry: 'Creative & Design', score: 3 },
  { keyword: 'design', industry: 'Creative & Design', score: 3 },
  { keyword: 'cyber', industry: 'Cybersecurity', score: 5 },
  { keyword: 'security', industry: 'Cybersecurity', score: 3 },
  { keyword: 'data', industry: 'Data Science & Analytics', score: 4 },
  { keyword: 'analytics', industry: 'Data Science & Analytics', score: 4 },
  { keyword: 'education', industry: 'Education & Training', score: 4 },
  { keyword: 'teacher', industry: 'Education & Training', score: 4 },
  { keyword: 'energy', industry: 'Energy & Utilities', score: 4 },
  { keyword: 'utilities', industry: 'Energy & Utilities', score: 3 },
  { keyword: 'environment', industry: 'Environmental', score: 4 },
  { keyword: 'sustainab', industry: 'Environmental', score: 4 },
  { keyword: 'fashion', industry: 'Fashion & Textiles', score: 4 },
  { keyword: 'textile', industry: 'Fashion & Textiles', score: 4 },
  { keyword: 'food', industry: 'Food & Beverage', score: 3 },
  { keyword: 'beverage', industry: 'Food & Beverage', score: 3 },
  { keyword: 'public sector', industry: 'Government & Public Sector', score: 4 },
  { keyword: 'government', industry: 'Government & Public Sector', score: 4 },
  { keyword: 'health', industry: 'Healthcare & Medical', score: 4 },
  { keyword: 'medical', industry: 'Healthcare & Medical', score: 4 },
  { keyword: 'hospitality', industry: 'Hospitality & Tourism', score: 4 },
  { keyword: 'tourism', industry: 'Hospitality & Tourism', score: 4 },
  { keyword: 'human resources', industry: 'HR & Recruitment', score: 4 },
  { keyword: 'hr', industry: 'HR & Recruitment', score: 4 },
  { keyword: 'recruit', industry: 'HR & Recruitment', score: 4 },
  { keyword: 'insurance', industry: 'Insurance', score: 4 },
  { keyword: 'legal', industry: 'Law & Legal', score: 4 },
  { keyword: 'law', industry: 'Law & Legal', score: 4 },
  { keyword: 'logistics', industry: 'Logistics & Supply Chain', score: 4 },
  { keyword: 'supply chain', industry: 'Logistics & Supply Chain', score: 4 },
  { keyword: 'manufactur', industry: 'Manufacturing', score: 4 },
  { keyword: 'marketing', industry: 'Marketing & Advertising', score: 4 },
  { keyword: 'advertis', industry: 'Marketing & Advertising', score: 4 },
  { keyword: 'mining', industry: 'Mining & Resources', score: 4 },
  { keyword: 'non-profit', industry: 'Non-Profit & Charity', score: 4 },
  { keyword: 'charity', industry: 'Non-Profit & Charity', score: 4 },
  { keyword: 'oil', industry: 'Oil & Gas', score: 4 },
  { keyword: 'gas', industry: 'Oil & Gas', score: 4 },
  { keyword: 'pharma', industry: 'Pharmaceuticals', score: 4 },
  { keyword: 'drug', industry: 'Pharmaceuticals', score: 3 },
  { keyword: 'real estate', industry: 'Property & Real Estate', score: 4 },
  { keyword: 'property', industry: 'Property & Real Estate', score: 4 },
  { keyword: 'retail', industry: 'Retail', score: 4 },
  { keyword: 'sales', industry: 'Sales', score: 4 },
  { keyword: 'business development', industry: 'Sales', score: 4 },
  { keyword: 'science', industry: 'Science & Research', score: 4 },
  { keyword: 'research', industry: 'Science & Research', score: 4 },
  { keyword: 'social care', industry: 'Social Care', score: 5 },
  { keyword: 'social work', industry: 'Social Care', score: 5 },
  { keyword: 'sport', industry: 'Sports & Fitness', score: 4 },
  { keyword: 'fitness', industry: 'Sports & Fitness', score: 4 },
  { keyword: 'software', industry: 'IT & Software', score: 4 },
  { keyword: 'developer', industry: 'IT & Software', score: 4 },
  { keyword: 'tech', industry: 'Technology', score: 3 },
  { keyword: 'product management', industry: 'Technology', score: 3 },
  { keyword: 'telecom', industry: 'Telecommunications', score: 4 },
  { keyword: 'telecommunications', industry: 'Telecommunications', score: 4 },
  { keyword: 'transport', industry: 'Transport', score: 4 },
  { keyword: 'rail', industry: 'Transport', score: 4 },
  { keyword: 'water', industry: 'Water & Waste Management', score: 4 },
  { keyword: 'waste', industry: 'Water & Waste Management', score: 4 },
  { keyword: 'engineering', industry: 'Engineering (General)', score: 2 },
  { keyword: 'entertainment', industry: 'Entertainment & Media', score: 3 },
  { keyword: 'media', industry: 'Entertainment & Media', score: 3 }
];

const SPECIAL_PATTERNS: PatternRule[] = [
  { pattern: /\binvestment bank(ing)?\b/, industry: 'Banking & Investment', score: 6 },
  { pattern: /\basset management\b/, industry: 'Banking & Investment', score: 5 },
  { pattern: /\bhedge fund\b/, industry: 'Banking & Investment', score: 6 },
  { pattern: /\bportfolio (analyst|manager)\b/, industry: 'Banking & Investment', score: 5 },
  { pattern: /\baccount(?:ant|ing)\b/, industry: 'Accounting & Finance', score: 5 },
  { pattern: /\bauditor\b/, industry: 'Accounting & Finance', score: 5 },
  { pattern: /\bfinancial reporting\b/, industry: 'Accounting & Finance', score: 5 },
  { pattern: /\bcivil engineer/i, industry: 'Civil Engineering', score: 7 },
  { pattern: /\bstructural engineer/i, industry: 'Civil Engineering', score: 6 },
  { pattern: /\bmechanical engineer/i, industry: 'Mechanical Engineering', score: 7 },
  { pattern: /\belectrical engineer/i, industry: 'Electrical Engineering', score: 7 },
  { pattern: /\bchemical engineer/i, industry: 'Chemical Engineering', score: 7 },
  { pattern: /\bsoftware engineer/i, industry: 'IT & Software', score: 6 },
  { pattern: /\bfull[- ]stack developer\b/, industry: 'IT & Software', score: 6 },
  { pattern: /\bfront[- ]end developer\b/, industry: 'IT & Software', score: 6 },
  { pattern: /\bback[- ]end developer\b/, industry: 'IT & Software', score: 6 },
  { pattern: /\bdevops\b/, industry: 'IT & Software', score: 6 },
  { pattern: /\bdata scientist\b/, industry: 'Data Science & Analytics', score: 7 },
  { pattern: /\bmachine learning\b/, industry: 'Data Science & Analytics', score: 6 },
  { pattern: /\bcyber ?security\b/, industry: 'Cybersecurity', score: 7 },
  { pattern: /\bpenetration tester\b/, industry: 'Cybersecurity', score: 6 },
  { pattern: /\bclinical trial\b/, industry: 'Pharmaceuticals', score: 6 },
  { pattern: /\bbiotech(nology)?\b/, industry: 'Biotechnology', score: 6 },
  { pattern: /\brenewable energy\b/, industry: 'Energy & Utilities', score: 6 },
  { pattern: /\bpower systems?\b/, industry: 'Electrical Engineering', score: 6 },
  { pattern: /\bmarketing manager\b/, industry: 'Marketing & Advertising', score: 6 },
  { pattern: /\bdigital marketing\b/, industry: 'Marketing & Advertising', score: 6 },
  { pattern: /\bsales executive\b/, industry: 'Sales', score: 6 },
  { pattern: /\bbusiness development manager\b/, industry: 'Sales', score: 6 },
  { pattern: /\bhuman resources\b/, industry: 'HR & Recruitment', score: 6 },
  { pattern: /\btalent acquisition\b/, industry: 'HR & Recruitment', score: 6 },
  { pattern: /\bsocial worker\b/, industry: 'Social Care', score: 7 },
  { pattern: /\bsports coach\b/, industry: 'Sports & Fitness', score: 6 },
  { pattern: /\btelecommunications\b/, industry: 'Telecommunications', score: 6 },
  { pattern: /\bnetwork engineer\b/, industry: 'Telecommunications', score: 6 },
  { pattern: /\bsupply chain\b/, industry: 'Logistics & Supply Chain', score: 6 },
  { pattern: /\bprocurement\b/, industry: 'Logistics & Supply Chain', score: 5 },
  { pattern: /\bconstruction manager\b/, industry: 'Construction', score: 6 },
  { pattern: /\bquantity surveyor\b/, industry: 'Construction', score: 6 },
  { pattern: /\bmanufacturing engineer\b/, industry: 'Manufacturing', score: 6 },
  { pattern: /\boil (?:and|&) gas\b/, industry: 'Oil & Gas', score: 6 },
  { pattern: /\bsubsea\b/, industry: 'Oil & Gas', score: 6 },
  { pattern: /\bmining engineer\b/, industry: 'Mining & Resources', score: 6 },
  { pattern: /\bgeologist\b/, industry: 'Mining & Resources', score: 6 },
  { pattern: /\bteacher\b/, industry: 'Education & Training', score: 6 },
  { pattern: /\blecturer\b/, industry: 'Education & Training', score: 5 },
  { pattern: /\bnurse\b/, industry: 'Healthcare & Medical', score: 6 },
  { pattern: /\bnhs\b/, industry: 'Healthcare & Medical', score: 5 },
  { pattern: /\bhospitality\b/, industry: 'Hospitality & Tourism', score: 6 },
  { pattern: /\bhotel\b/, industry: 'Hospitality & Tourism', score: 5 },
  { pattern: /\btour guide\b/, industry: 'Hospitality & Tourism', score: 5 },
  { pattern: /\bcharity\b/, industry: 'Non-Profit & Charity', score: 6 },
  { pattern: /\bfundraising\b/, industry: 'Non-Profit & Charity', score: 6 },
  { pattern: /\breal estate\b/, industry: 'Property & Real Estate', score: 6 },
  { pattern: /\bproperty manager\b/, industry: 'Property & Real Estate', score: 6 },
  { pattern: /\bretail assistant\b/, industry: 'Retail', score: 6 },
  { pattern: /\bstore manager\b/, industry: 'Retail', score: 6 },
  { pattern: /\btransport planner\b/, industry: 'Transport', score: 6 },
  { pattern: /\blogistics coordinator\b/, industry: 'Logistics & Supply Chain', score: 6 },
  { pattern: /\bwater treatment\b/, industry: 'Water & Waste Management', score: 6 },
  { pattern: /\bwaste management\b/, industry: 'Water & Waste Management', score: 6 },
  { pattern: /\bsustainability analyst\b/, industry: 'Environmental', score: 6 },
  { pattern: /\bux designer\b/, industry: 'Creative & Design', score: 6 },
  { pattern: /\bgraphic designer\b/, industry: 'Creative & Design', score: 6 },
  { pattern: /\bmedia production\b/, industry: 'Entertainment & Media', score: 6 },
  { pattern: /\bjournalism\b/, industry: 'Entertainment & Media', score: 6 }
];

const KEYWORD_SETS: Record<Industry, string[]> = {
  'Accounting & Finance': ['finance', 'financial', 'accounting', 'accountant', 'audit', 'tax', 'treasury', 'ledger', 'payable', 'receivable'],
  'Aerospace & Defence': ['aerospace', 'defence', 'defense', 'avionics', 'aircraft', 'spacecraft', 'missile', 'raf', 'mod', 'satellite'],
  'Agriculture & Farming': ['agric', 'farm', 'crop', 'livestock', 'horticulture', 'agronom', 'agri-tech'],
  'Architecture': ['architect', 'architecture', 'architectural', 'riba'],
  'Automotive': ['automotive', 'vehicle', 'automobile', 'motorsport', 'automotive engineering', 'powertrain'],
  'Banking & Investment': ['bank', 'investment', 'asset', 'trading', 'wealth', 'capital markets', 'equity', 'fixed income', 'private banking'],
  'Biotechnology': ['biotech', 'biotechnology', 'genomic', 'cell therapy', 'molecular', 'bioinformatic'],
  'Chemical Engineering': ['chemical engineering', 'process engineer', 'process design', 'chemical plant', 'chemicals'],
  'Civil Engineering': ['civil engineering', 'infrastructure', 'highways', 'bridges', 'transport infrastructure', 'structural'],
  'Consulting': ['consulting', 'consultant', 'advisory', 'strategy', 'management consulting', 'client engagement'],
  'Construction': ['construction', 'contractor', 'site manager', 'quantity surveyor', 'civils', 'building services'],
  'Creative & Design': ['creative', 'design', 'designer', 'ux', 'ui', 'graphic', 'illustration', 'copywriting'],
  'Cybersecurity': ['cyber', 'security analyst', 'infosec', 'threat', 'penetration', 'soc analyst', 'incident response'],
  'Data Science & Analytics': ['data', 'analytics', 'machine learning', 'ml', 'ai', 'statistical', 'business intelligence', 'power bi'],
  'Education & Training': ['education', 'teaching', 'teacher', 'school', 'academy', 'trainer', 'learning development', 'curriculum'],
  'Electrical Engineering': ['electrical', 'electronics', 'circuit', 'embedded', 'power systems', 'control systems'],
  'Energy & Utilities': ['energy', 'utilities', 'renewable', 'grid', 'power generation', 'wind', 'solar', 'battery storage'],
  'Engineering (General)': ['engineering', 'engineer', 'technical engineer', 'engineering placement'],
  'Entertainment & Media': ['media', 'entertainment', 'broadcast', 'film', 'television', 'journalism', 'production'],
  'Environmental': ['environment', 'sustainability', 'carbon', 'ecology', 'environmental impact', 'greenhouse gas'],
  'Fashion & Textiles': ['fashion', 'textile', 'apparel', 'garment', 'merchandiser', 'couture'],
  'Food & Beverage': ['food', 'beverage', 'nutrition', 'culinary', 'ingredients', 'fmcg', 'brewery'],
  'Government & Public Sector': ['public sector', 'government', 'civil service', 'council', 'policy', 'local authority'],
  'Healthcare & Medical': ['healthcare', 'medical', 'clinical', 'patient', 'nhs', 'hospital', 'pharmacy'],
  'Hospitality & Tourism': ['hospitality', 'tourism', 'hotel', 'restaurant', 'travel', 'guest services'],
  'HR & Recruitment': ['human resources', 'hr', 'people partner', 'talent', 'recruit', 'resourcing'],
  'Insurance': ['insurance', 'underwriting', 'claims', 'broker', 'actuarial'],
  'IT & Software': ['software', 'developer', 'engineering', 'programmer', 'devops', 'cloud', 'saas'],
  'Law & Legal': ['legal', 'law', 'solicitor', 'paralegal', 'barrister', 'compliance', 'litigation'],
  'Logistics & Supply Chain': ['logistics', 'supply chain', 'distribution', 'fulfilment', 'warehouse', 'procurement', 'inventory'],
  'Manufacturing': ['manufacturing', 'production', 'assembly', 'lean', 'six sigma', 'plant', 'factory'],
  'Marketing & Advertising': ['marketing', 'advertising', 'brand', 'campaign', 'digital marketing', 'seo', 'content marketing'],
  'Mechanical Engineering': ['mechanical', 'cad', 'thermodynamics', 'mechanical design', 'mechanical systems', 'hvac'],
  'Mining & Resources': ['mining', 'mineral', 'geology', 'extractive', 'metallurgy', 'geoscience'],
  'Non-Profit & Charity': ['charity', 'non-profit', 'ngo', 'third sector', 'fundraising', 'voluntary'],
  'Oil & Gas': ['oil', 'gas', 'petroleum', 'upstream', 'downstream', 'offshore', 'rig'],
  'Pharmaceuticals': ['pharmaceutical', 'drug', 'clinical trial', 'gmp', 'regulatory affairs', 'pharma'],
  'Property & Real Estate': ['real estate', 'property', 'estate agent', 'lettings', 'surveying', 'proptech'],
  'Retail': ['retail', 'store', 'merchandising', 'shop', 'visual merchandising', 'customer advisor'],
  'Sales': ['sales', 'business development', 'account executive', 'inside sales', 'sales consultant', 'sales manager'],
  'Science & Research': ['research', 'laboratory', 'lab', 'scientist', 'r&d', 'research associate'],
  'Social Care': ['social care', 'care worker', 'support worker', 'safeguarding', 'residential care'],
  'Sports & Fitness': ['sport', 'sports', 'fitness', 'athletic', 'coach', 'exercise science'],
  'Technology': ['technology', 'digital transformation', 'innovation', 'product management', 'tech strategy'],
  'Telecommunications': ['telecom', 'telecommunications', 'network', 'fiber', '5g', 'broadband'],
  'Transport': ['transport', 'rail', 'transportation', 'fleet', 'aviation operations', 'transport planner'],
  'Water & Waste Management': ['water', 'wastewater', 'sewage', 'waste management', 'recycling', 'utilities water']
};

export function normaliseIndustry(value?: string | null): Industry | null {
  if (!value) return null;
  const match = INDUSTRIES.find((industry) => industry.toLowerCase() === value.toLowerCase().trim());
  return match ?? null;
}

export function classifyIndustry(input: ClassifyIndustryInput): Industry | null {
  const { title, description, company, hints = [], query } = input;
  const text = [title, description, company, query]
    .filter((part): part is string => Boolean(part && part.trim()))
    .join(' ')
    .toLowerCase();

  const scores = new Map<Industry, number>();
  INDUSTRIES.forEach((industry) => scores.set(industry, 0));

  const addScore = (industry: Industry, value: number) => {
    const current = scores.get(industry) ?? 0;
    scores.set(industry, current + value);
  };

  const processedHints = hints
    .flatMap((hint) => hint?.split(/[,/]| and | & /i) ?? [])
    .map((hint) => hint.trim().toLowerCase())
    .filter(Boolean);

  for (const hint of processedHints) {
    for (const rule of HINT_RULES) {
      if (hint.includes(rule.keyword)) {
        addScore(rule.industry, rule.score);
      }
    }
  }

  for (const rule of SPECIAL_PATTERNS) {
    if (rule.pattern.test(text)) {
      addScore(rule.industry, rule.score);
    }
  }

  for (const industry of INDUSTRIES) {
    const keywords = KEYWORD_SETS[industry];
    let delta = 0;
    for (const keyword of keywords) {
      if (keyword && text.includes(keyword)) {
        delta += keyword.length >= 12 ? 1.5 : 1;
      }
    }
    if (delta > 0) {
      addScore(industry, delta);
    }
  }

  const sorted = [...scores.entries()].sort((a, b) => b[1] - a[1]);
  const [bestIndustry, bestScore] = sorted[0] ?? [null, 0];
  const secondScore = sorted[1]?.[1] ?? 0;

  if (!bestIndustry || bestScore <= 0) {
    return null;
  }

  if (bestScore >= 5 && bestScore >= secondScore + 1) {
    return bestIndustry;
  }

  if (bestScore >= 4 && bestScore > secondScore) {
    return bestIndustry;
  }

  if (bestScore >= 3 && secondScore <= 1) {
    return bestIndustry;
  }

  return null;
}

export function assignIndustryOrNull(value?: string | null): Industry | null {
  return normaliseIndustry(value ?? undefined);
}

