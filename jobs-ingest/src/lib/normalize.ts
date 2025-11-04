import { SalaryNorm } from '../types';

// Enhanced classification for UK university students - ONLY allows internship, placement, graduate
export function classifyJobType(text: string): 'internship'|'placement'|'graduate'|'other' {
  const t = text.toLowerCase();

  // First check for exclusions - these are hard rejects (not suitable for students)
  const exclusions = [
    // PhD/Research exclusions
    'phd', 'ph.d', 'ph.d.', 'doctorate', 'doctoral', 'postdoc', 'post-doc', 'post doc',
    'research fellow', 'research assistant', 'research associate', 'research scientist',
    'research engineer', 'research analyst', 'research consultant', 'research manager',
    'senior research', 'principal research', 'lead research', 'head of research',
    'research director', 'research coordinator', 'research specialist', 'research technician',
    'postdoctoral', 'post-doctoral', 'post doctoral', 'academic research', 'university research',
    'research institute', 'research center', 'research centre', 'research lab', 'research laboratory',
    
    // MBA/Senior level exclusions
    'mba only', 'mba required', 'mba preferred', 'mba essential', 'mba mandatory',
    'executive mba', 'emba', 'senior mba', 'mba graduate', 'mba level',
    'senior level', 'principal level', 'lead level', 'head of', 'director level',
    'vp level', 'vice president', 'executive level', 'c-level', 'c suite',
    '5+ years', '10+ years', '15+ years', '20+ years', '25+ years',
    'experienced professional', 'senior professional', 'principal professional',
    'expert level', 'specialist level', 'consultant level', 'architect level',
    'mid-level', 'mid level', 'intermediate level', 'advanced level',
    
    // Senior job title exclusions (any job with "senior" in title)
    'senior', 'senior engineer', 'senior developer', 'senior analyst', 'senior consultant',
    'senior manager', 'senior director', 'senior executive', 'senior specialist',
    'senior coordinator', 'senior administrator', 'senior technician', 'senior designer',
    'senior architect', 'senior scientist', 'senior researcher', 'senior advisor',
    'senior associate', 'senior partner', 'senior officer', 'senior representative',
    'senior supervisor', 'senior coordinator', 'senior administrator', 'senior technician',
    
    // Non-student job types
    'apprenticeship', 'apprentice', 'trainee', 'traineeship', 'school leaver',
    'gcse', 'a-level', 'a level', 'btec', 'nvq', 'level 2', 'level 3',
    'part-time', 'part time', 'casual', 'temporary', 'temp', 'contractor',
    'freelance', 'self-employed', 'volunteer', 'voluntary', 'unpaid',
    'retail', 'hospitality', 'customer service', 'sales assistant', 'shop assistant',
    'waiter', 'waitress', 'bar staff', 'kitchen staff', 'cleaner', 'security',
    'delivery driver', 'taxi driver', 'uber', 'deliveroo', 'just eat',
    'care worker', 'support worker', 'nursing', 'healthcare assistant',
    'teaching assistant', 'lunch supervisor', 'playground supervisor',
    'admin', 'administrative', 'receptionist', 'secretary', 'data entry',
    'warehouse', 'forklift', 'picking', 'packing', 'stock', 'inventory',
    'call center', 'call centre', 'telemarketing', 'cold calling',
    'door to door', 'canvassing', 'leafleting', 'promotional work',
    'event staff', 'catering', 'bar work', 'nightclub', 'pub',
    
    // Driver and transport exclusions
    'driver', 'driving', 'hgv', 'lgv', 'van driver', 'truck driver', 'lorry driver',
    'bus driver', 'coach driver', 'taxi', 'uber', 'delivery', 'courier',
    '7.5 ton', '3.5 ton', '12 ton', '18 ton', '26 ton', '44 ton',
    'heathrow', 'airport', 'aviation', 'pilot', 'cabin crew', 'flight attendant',
    'ground crew', 'baggage handler', 'airport security', 'airport staff',
    
    // Manual labor exclusions
    'labourer', 'laborer', 'construction', 'building', 'plumber', 'electrician',
    'carpenter', 'painter', 'decorator', 'roofer', 'tiler', 'plasterer',
    'mechanic', 'technician', 'maintenance', 'repair', 'servicing',
    'gardener', 'landscaper', 'groundskeeper', 'groundsman',
    
    // Service industry exclusions
    'hairdresser', 'barber', 'beautician', 'beauty therapist', 'nail technician',
    'massage therapist', 'spa therapist', 'fitness instructor', 'personal trainer',
    'lifeguard', 'swimming instructor', 'dance instructor', 'music teacher',
    
    // Sales and marketing exclusions
    'sales rep', 'sales representative', 'sales executive', 'sales manager',
    'marketing executive', 'marketing manager', 'marketing coordinator',
    'business development', 'account manager', 'key account', 'territory manager',
    
    // Healthcare exclusions (non-graduate)
    'care assistant', 'care worker', 'support worker', 'healthcare assistant',
    'nursing assistant', 'care home', 'residential care', 'domiciliary care',
    'mental health support', 'learning disability support', 'elderly care',
    'gym instructor', 'personal trainer', 'fitness', 'sports coach',
    'beauty therapist', 'hairdresser', 'nail technician', 'massage',
    'estate agent', 'lettings', 'property', 'mortgage advisor',
    'insurance', 'financial advisor', 'mortgage broker', 'loan officer',
    'recruitment consultant', 'headhunter', 'talent acquisition',
    'marketing manager', 'marketing director', 'brand manager',
    'account manager', 'business development', 'sales manager',
    'operations manager', 'project manager', 'team leader',
    'supervisor', 'foreman', 'manager', 'director', 'ceo', 'cto',
    'cfo', 'coo', 'founder', 'owner', 'proprietor', 'entrepreneur'
  ];

  // If any exclusion keywords found, return 'other' (will be filtered out)
  if (exclusions.some(keyword => t.includes(keyword))) {
    return 'other';
  }
  
  // Additional check: reject jobs that start with "Senior" (most common pattern)
  if (t.startsWith('senior ')) {
    return 'other';
  }
  
  // Additional check: reject jobs with "Senior" anywhere in title (comprehensive)
  if (/\bsenior\b/.test(t)) {
    return 'other';
  }

  // Internship keywords (high priority)
  if (/\b(intern(ship)?|summer internship|winter internship|spring internship|autumn internship|vacation scheme|vacation work|vacation student|student internship|undergraduate internship|graduate internship)\b/.test(t)) {
    return 'internship';
  }

  // Placement/Year in Industry keywords (UK sandwich courses)
  if (/\b(placement|year in industry|sandwich|industrial placement|work placement|year out|gap year|year abroad|student placement|undergraduate placement|graduate placement|industrial training|work experience|professional placement)\b/.test(t)) {
    return 'placement';
  }

  // Graduate/Early Careers keywords (must be explicit)
  if (/\b(graduate|early careers|new grad|new graduate|entry level|junior|trainee|traineeship|graduate scheme|graduate program|graduate programme|graduate trainee|graduate engineer|graduate consultant|graduate analyst|graduate developer|graduate designer|graduate marketing|graduate sales|graduate finance|graduate hr|graduate operations|graduate project|graduate scientist|graduate technician|graduate technologist|graduate architect|graduate surveyor|graduate planner|graduate environmental|graduate sustainability|graduate energy|graduate renewable|graduate nuclear|graduate aerospace|graduate automotive|graduate mechanical|graduate electrical|graduate civil|graduate structural|graduate geotechnical|graduate transportation|graduate water|graduate waste|graduate scheme|graduate program|graduate programme|graduate trainee|graduate engineer|graduate consultant|graduate analyst|graduate developer|graduate designer|graduate marketing|graduate sales|graduate finance|graduate hr|graduate operations|graduate project|graduate scientist|graduate technician|graduate technologist|graduate architect|graduate surveyor|graduate planner|graduate environmental|graduate sustainability|graduate energy|graduate renewable|graduate nuclear|graduate aerospace|graduate automotive|graduate mechanical|graduate electrical|graduate civil|graduate structural|graduate geotechnical|graduate transportation|graduate water|graduate waste)\b/.test(t)) {
    return 'graduate';
  }

  return 'other';
}

// Check if a job is relevant for university students - STRICT filtering
export function isRelevantJobType(text: string): boolean {
  const jobType = classifyJobType(text);
  
  // Only allow our three specific job types
  if (jobType !== 'internship' && jobType !== 'placement' && jobType !== 'graduate') {
    return false;
  }
  
  // Additional filtering for graduate-specific content
  const t = text.toLowerCase();
  
  // Must contain graduate-specific keywords
  const graduateKeywords = [
    // Graduate job variations
    'graduate', 'graduate job', 'graduate role', 'graduate position', 'graduate opportunity',
    'graduate scheme', 'graduate programme', 'graduate program', 'graduate trainee',
    'graduate analyst', 'graduate engineer', 'graduate consultant', 'graduate manager',
    'graduate developer', 'graduate coordinator', 'graduate specialist', 'graduate associate',
    
    // Internship variations
    'internship', 'intern', 'intern role', 'intern position', 'intern opportunity',
    'summer internship', 'winter internship', 'spring internship', 'autumn internship',
    'paid internship', 'unpaid internship', 'internship programme', 'internship program',
    'internship scheme', 'internship opportunity', 'internship role', 'internship position',
    
    // Placement variations
    'placement', 'placement year', 'year in industry', 'industrial placement',
    'work placement', 'student placement', 'university placement', 'college placement',
    'placement programme', 'placement program', 'placement scheme', 'placement opportunity',
    'placement role', 'placement position', 'placement trainee', 'placement analyst',
    'sandwich year', 'gap year', 'year abroad', 'study abroad', 'exchange year',
    
    // Entry level variations
    'entry level', 'entry-level', 'entry level role', 'entry level position',
    'entry level job', 'entry level opportunity', 'entry level trainee',
    'entry level analyst', 'entry level engineer', 'entry level consultant',
    'entry level manager', 'entry level developer', 'entry level coordinator',
    
    // Junior variations
    'junior', 'junior role', 'junior position', 'junior job', 'junior opportunity',
    'junior analyst', 'junior engineer', 'junior consultant', 'junior manager',
    'junior developer', 'junior coordinator', 'junior specialist', 'junior associate',
    
    // General graduate terms
    'assistant', 'coordinator', 'analyst', 'developer', 'engineer',
    'consultant', 'manager', 'director', 'specialist', 'associate',
    'trainee', 'apprentice', 'scheme', 'programme', 'program',
    'opportunity', 'role', 'position', 'career', 'job'
  ];
  
  const hasGraduateKeyword = graduateKeywords.some(keyword => t.includes(keyword));
  if (!hasGraduateKeyword) {
    return false;
  }
  
  // Must NOT contain non-graduate keywords (only the most obvious non-graduate roles)
  const nonGraduateKeywords = [
    // Driver and transport exclusions
    'driver', 'driving', '7.5 ton', '3.5 ton', '12 ton', '18 ton', '26 ton', '44 ton',
    'hgv', 'lgv', 'van driver', 'truck driver', 'lorry driver', 'bus driver', 'coach driver',
    'taxi', 'uber', 'delivery', 'courier', 'heathrow', 'airport', 'aviation',
    'pilot', 'cabin crew', 'flight attendant', 'ground crew', 'baggage handler',
    
    // Manual labor exclusions
    'labourer', 'laborer', 'construction', 'building', 'plumber', 'electrician',
    'carpenter', 'painter', 'decorator', 'roofer', 'tiler', 'plasterer',
    'mechanic', 'technician', 'maintenance', 'repair', 'servicing',
    'gardener', 'landscaper', 'groundskeeper', 'groundsman',
    
    // Service industry exclusions (non-graduate roles only)
    'waiter', 'waitress', 'bar staff', 'kitchen staff', 'cleaner', 'security',
    'warehouse', 'forklift', 'picking', 'packing', 'stock', 'inventory',
    'call center', 'telemarketing', 'cold calling', 'door to door',
    'care worker', 'support worker', 'nursing assistant', 'healthcare assistant',
    'admin', 'administrative', 'receptionist', 'secretary', 'data entry',
    
    // Specific non-graduate exclusions
    'hairdresser', 'barber', 'beautician', 'beauty therapist', 'nail technician',
    'massage therapist', 'spa therapist', 'fitness instructor', 'personal trainer',
    'lifeguard', 'swimming instructor', 'dance instructor', 'music teacher'
  ];
  
  const hasNonGraduateKeyword = nonGraduateKeywords.some(keyword => t.includes(keyword));
  if (hasNonGraduateKeyword) {
    return false;
  }
  
  return true;
}

// Enhanced UK location detection with comprehensive filtering
export function isUKJob(text: string): boolean {
  const t = text.toLowerCase();

  // Comprehensive UK location keywords
  const ukKeywords = [
    // Country names
    'united kingdom', 'uk', 'britain', 'british', 'gb', 'great britain',
    'england', 'scotland', 'wales', 'northern ireland', 'cumbria',
    
    // Major UK cities
    'london', 'manchester', 'birmingham', 'leeds', 'glasgow', 'edinburgh',
    'bristol', 'liverpool', 'newcastle', 'sheffield', 'belfast', 'cardiff',
    'cambridge', 'oxford', 'bath', 'york', 'canterbury', 'durham',
    'nottingham', 'leicester', 'coventry', 'bradford', 'hull', 'plymouth',
    'southampton', 'portsmouth', 'brighton', 'hove', 'northampton',
    'swindon', 'derby', 'stoke-on-trent', 'wolverhampton', 'southampton',
    'southend-on-sea', 'reading', 'middlesbrough', 'luton', 'bournemouth',
    'norwich', 'swansea', 'swindon', 'peterborough', 'southend', 'walsall',
    'milton keynes', 'huddersfield', 'poole', 'blackpool', 'stockport',
    'bolton', 'telford', 'newport', 'high wycombe', 'exeter', 'colchester',
    'eastbourne', 'crawley', 'ipswich', 'watford', 'slough', 'gloucester',
    'saint helens', 'southport', 'chester', 'salisbury', 'basingstoke',
    'maidstone', 'oldham', 'salford', 'hastings', 'hartlepool', 'halifax',
    'birkenhead', 'yeovil', 'barrow-in-furness', 'eastleigh', 'scunthorpe',
    'burnley', 'solihull', 'nuneaton', 'carlisle', 'runcorn', 'south shields',
    'barnstaple', 'wigan', 'crewe', 'lowestoft', 'rochdale', 'southsea',
    'farnborough', 'kidderminster', 'margate', 'bognor regis', 'fleetwood',
    'preston', 'stockton-on-tees', 'wakefield', 'woking', 'rhondda',
    'rhondda cynon taf', 'merthyr tydfil', 'caerphilly', 'blaenau gwent',
    'torfaen', 'monmouthshire', 'newport', 'cardiff', 'vale of glamorgan',
    'bridgend', 'neath port talbot', 'swansea', 'carmarthenshire', 'pembrokeshire',
    'ceredigion', 'powys', 'wrexham', 'denbighshire', 'conwy', 'gwynedd',
    'anglesey', 'flintshire', 'aberdeen', 'dundee', 'perth', 'stirling',
    'falkirk', 'livingston', 'cumbernauld', 'airdrie', 'kilmarnock',
    'paisley', 'east kilbride', 'greenock', 'dunfermline', 'kirkcaldy',
    'inverness', 'ayr', 'clydebank', 'motherwell', 'wishaw', 'rutherglen',
    'cambuslang', 'bearsden', 'bathgate', 'renfrew', 'johnstone', 'irvine',
    'dumbarton', 'cumbernauld', 'bellshill', 'viewpark', 'port glasgow',
    'larkhall', 'strathaven', 'stevenston', 'saltcoats', 'ardrossan',
    'kilwinning', 'dalry', 'beith', 'lochwinnoch', 'kilbirnie', 'glengarnock',
    
    // UK regions and counties
    'greater london', 'greater manchester', 'west midlands', 'west yorkshire',
    'south yorkshire', 'tyne and wear', 'merseyside', 'cheshire', 'lancashire',
    'yorkshire', 'north yorkshire', 'east yorkshire', 'south yorkshire',
    'west yorkshire', 'northumberland', 'durham', 'cumbria', 'northumberland',
    'county durham', 'north east', 'north west', 'yorkshire and humber',
    'east midlands', 'west midlands', 'east of england', 'london',
    'south east', 'south west', 'wales', 'scotland', 'northern ireland',
    
    // Remote UK options
    'remote uk', 'hybrid uk', 'uk remote', 'uk hybrid', 'remote (uk)',
    'hybrid (uk)', 'work from home uk', 'wfh uk', 'uk wfh',
    
    // UK postal codes (first part)
    'm1', 'm2', 'm3', 'm4', 'm5', 'm6', 'm7', 'm8', 'm9', 'm10', 'm11', 'm12',
    'm13', 'm14', 'm15', 'm16', 'm17', 'm18', 'm19', 'm20', 'm21', 'm22',
    'b1', 'b2', 'b3', 'b4', 'b5', 'b6', 'b7', 'b8', 'b9', 'b10', 'b11', 'b12',
    'ls1', 'ls2', 'ls3', 'ls4', 'ls5', 'ls6', 'ls7', 'ls8', 'ls9', 'ls10',
    'g1', 'g2', 'g3', 'g4', 'g5', 'g6', 'g7', 'g8', 'g9', 'g10', 'g11', 'g12',
    'e1', 'e2', 'e3', 'e4', 'e5', 'e6', 'e7', 'e8', 'e9', 'e10', 'e11', 'e12',
    'w1', 'w2', 'w3', 'w4', 'w5', 'w6', 'w7', 'w8', 'w9', 'w10', 'w11', 'w12',
    'n1', 'n2', 'n3', 'n4', 'n5', 'n6', 'n7', 'n8', 'n9', 'n10', 'n11', 'n12',
    'sw1', 'sw2', 'sw3', 'sw4', 'sw5', 'sw6', 'sw7', 'sw8', 'sw9', 'sw10',
    'se1', 'se2', 'se3', 'se4', 'se5', 'se6', 'se7', 'se8', 'se9', 'se10',
    'nw1', 'nw2', 'nw3', 'nw4', 'nw5', 'nw6', 'nw7', 'nw8', 'nw9', 'nw10',
    'ec1', 'ec2', 'ec3', 'ec4', 'ec5', 'ec6', 'ec7', 'ec8', 'ec9', 'ec10',
    'wc1', 'wc2', 'wc3', 'wc4', 'wc5', 'wc6', 'wc7', 'wc8', 'wc9', 'wc10'
  ];

  // Comprehensive non-UK keywords (exclude these)
  const nonUKKeywords = [
    // North America
    'united states', 'usa', 'us', 'america', 'american', 'united states of america',
    'san francisco', 'new york', 'new york city', 'nyc', 'seattle', 'los angeles',
    'chicago', 'houston', 'phoenix', 'philadelphia', 'san antonio', 'san diego',
    'dallas', 'austin', 'jacksonville', 'fort worth', 'columbus', 'charlotte',
    'san jose', 'indianapolis', 'san francisco bay area', 'bay area',
    'canada', 'canadian', 'toronto', 'vancouver', 'montreal', 'calgary', 'ottawa',
    'edmonton', 'winnipeg', 'quebec', 'hamilton', 'kitchener', 'london ontario',
    'mexico', 'mexican', 'mexico city', 'guadalajara', 'monterrey',
    
    // Europe (non-UK)
    'germany', 'german', 'berlin', 'munich', 'hamburg', 'cologne', 'frankfurt',
    'france', 'french', 'paris', 'lyon', 'marseille', 'toulouse', 'nice',
    'spain', 'spanish', 'madrid', 'barcelona', 'valencia', 'seville',
    'italy', 'italian', 'rome', 'milan', 'naples', 'turin', 'florence',
    'netherlands', 'dutch', 'amsterdam', 'rotterdam', 'the hague', 'utrecht',
    'belgium', 'belgian', 'brussels', 'antwerp', 'ghent', 'bruges',
    'switzerland', 'swiss', 'zurich', 'geneva', 'basel', 'bern',
    'austria', 'austrian', 'vienna', 'salzburg', 'innsbruck', 'graz',
    'sweden', 'swedish', 'stockholm', 'gothenburg', 'malmo', 'uppsala',
    'norway', 'norwegian', 'oslo', 'bergen', 'trondheim', 'stavanger',
    'denmark', 'danish', 'copenhagen', 'aarhus', 'odense', 'aalborg',
    'finland', 'finnish', 'helsinki', 'espoo', 'tampere', 'vantaa',
    'poland', 'polish', 'warsaw', 'krakow', 'gdansk', 'wroclaw',
    'czech republic', 'czech', 'prague', 'brno', 'ostrava', 'plzen',
    'hungary', 'hungarian', 'budapest', 'debrecen', 'szeged', 'miskolc',
    'romania', 'romanian', 'bucharest', 'cluj-napoca', 'timisoara', 'iasi',
    'bulgaria', 'bulgarian', 'sofia', 'plovdiv', 'varna', 'burgas',
    'croatia', 'croatian', 'zagreb', 'split', 'rijeka', 'osijek',
    'slovenia', 'slovenian', 'ljubljana', 'maribor', 'celje', 'kranj',
    'slovakia', 'slovak', 'bratislava', 'kosice', 'presov', 'zilina',
    'estonia', 'estonian', 'tallinn', 'tartu', 'narva', 'parnu',
    'latvia', 'latvian', 'riga', 'daugavpils', 'liepaja', 'jelgava',
    'lithuania', 'lithuanian', 'vilnius', 'kaunas', 'klaipeda', 'siauliai',
    'ireland', 'irish', 'dublin', 'cork', 'limerick', 'galway', 'waterford',
    'portugal', 'portuguese', 'lisbon', 'porto', 'coimbra', 'braga',
    'greece', 'greek', 'athens', 'thessaloniki', 'patras', 'larissa',
    'cyprus', 'cypriot', 'nicosia', 'limassol', 'larnaca', 'paphos',
    'malta', 'maltese', 'valletta', 'birkirkara', 'qormi', 'zabbar',
    'luxembourg', 'luxembourgish', 'luxembourg city', 'esch-sur-alzette',
    'iceland', 'icelandic', 'reykjavik', 'kopavogur', 'hafnarfjordur',
    
    // Asia Pacific
    'australia', 'australian', 'sydney', 'melbourne', 'brisbane', 'perth',
    'adelaide', 'canberra', 'hobart', 'darwin', 'new zealand', 'auckland',
    'wellington', 'christchurch', 'hamilton', 'japan', 'japanese', 'tokyo',
    'osaka', 'kyoto', 'yokohama', 'nagoya', 'south korea', 'korean', 'seoul',
    'busan', 'incheon', 'daegu', 'singapore', 'singaporean', 'hong kong',
    'taiwan', 'taipei', 'kaohsiung', 'taichung', 'china', 'chinese',
    'beijing', 'shanghai', 'guangzhou', 'shenzhen', 'india', 'indian',
    'mumbai', 'delhi', 'bangalore', 'hyderabad', 'chennai', 'kolkata',
    'thailand', 'thai', 'bangkok', 'chiang mai', 'phuket', 'pattaya',
    'malaysia', 'malaysian', 'kuala lumpur', 'penang', 'johor bahru',
    'indonesia', 'indonesian', 'jakarta', 'surabaya', 'bandung', 'medan',
    'philippines', 'filipino', 'manila', 'cebu', 'davao', 'quezon city',
    'vietnam', 'vietnamese', 'ho chi minh city', 'hanoi', 'da nang',
    'cambodia', 'cambodian', 'phnom penh', 'siem reap', 'battambang',
    'laos', 'laotian', 'vientiane', 'luang prabang', 'pakse',
    'myanmar', 'burmese', 'yangon', 'mandalay', 'naypyidaw',
    'brunei', 'bruneian', 'bandar seri begawan', 'kuala belait',
    
    // Middle East & Africa
    'united arab emirates', 'uae', 'dubai', 'abu dhabi', 'sharjah',
    'saudi arabia', 'saudi', 'riyadh', 'jeddah', 'mecca', 'medina',
    'qatar', 'qatari', 'doha', 'al rayyan', 'al wakrah',
    'kuwait', 'kuwaiti', 'kuwait city', 'al ahmadi', 'hawalli',
    'bahrain', 'bahraini', 'manama', 'muharraq', 'riffa',
    'oman', 'omani', 'muscat', 'salalah', 'nizwa',
    'israel', 'israeli', 'tel aviv', 'jerusalem', 'haifa',
    'turkey', 'turkish', 'istanbul', 'ankara', 'izmir', 'bursa',
    'south africa', 'south african', 'cape town', 'johannesburg',
    'durban', 'pretoria', 'egypt', 'egyptian', 'cairo', 'alexandria',
    'nigeria', 'nigerian', 'lagos', 'abuja', 'kano', 'ibadan',
    'kenya', 'kenyan', 'nairobi', 'mombasa', 'kisumu', 'nakuru',
    'morocco', 'moroccan', 'casablanca', 'rabat', 'fes', 'marrakech',
    'tunisia', 'tunisian', 'tunis', 'sfax', 'sousse', 'kairouan',
    'algeria', 'algerian', 'algiers', 'oran', 'constantine', 'annaba',
    'libya', 'libyan', 'tripoli', 'benghazi', 'misrata', 'zawiya',
    'sudan', 'sudanese', 'khartoum', 'port sudan', 'kassala',
    'ethiopia', 'ethiopian', 'addis ababa', 'dire dawa', 'gondar',
    'ghana', 'ghanaian', 'accra', 'kumasi', 'tamale', 'tema',
    'senegal', 'senegalese', 'dakar', 'thies', 'kaolack', 'ziguinchor',
    'ivory coast', 'ivorian', 'abidjan', 'bouake', 'daloa', 'san-pedro',
    'cameroon', 'cameroonian', 'douala', 'yaounde', 'garoua', 'bamenda',
    'congo', 'congolese', 'kinshasa', 'lubumbashi', 'mbuji-mayi',
    'angola', 'angolan', 'luanda', 'huambo', 'lobito', 'benguela',
    'zambia', 'zambian', 'lusaka', 'ndola', 'kitwe', 'kabwe',
    'zimbabwe', 'zimbabwean', 'harare', 'bulawayo', 'chitungwiza',
    'botswana', 'botswanan', 'gaborone', 'francistown', 'maun',
    'namibia', 'namibian', 'windhoek', 'swakopmund', 'walvis bay',
    'madagascar', 'malagasy', 'antananarivo', 'toamasina', 'fianarantsoa',
    'mauritius', 'mauritian', 'port louis', 'beau bassin', 'curepipe',
    'seychelles', 'seychellois', 'victoria', 'praslin', 'la digue',
    
    // Remote work exclusions
    'remote us', 'hybrid us', 'us remote', 'us hybrid', 'remote (us)',
    'hybrid (us)', 'work from home us', 'wfh us', 'us wfh',
    'remote canada', 'hybrid canada', 'canada remote', 'canada hybrid',
    'remote australia', 'hybrid australia', 'australia remote', 'australia hybrid',
    'remote germany', 'hybrid germany', 'germany remote', 'germany hybrid',
    'remote france', 'hybrid france', 'france remote', 'france hybrid',
    'remote netherlands', 'hybrid netherlands', 'netherlands remote', 'netherlands hybrid',
    'remote singapore', 'hybrid singapore', 'singapore remote', 'singapore hybrid',
    'remote india', 'hybrid india', 'india remote', 'india hybrid',
    'remote philippines', 'hybrid philippines', 'philippines remote', 'philippines hybrid',
    
    // Time zones (non-UK)
    'pst', 'pdt', 'pacific time', 'mst', 'mdt', 'mountain time',
    'cst', 'cdt', 'central time', 'est', 'edt', 'eastern time',
    'aest', 'aedt', 'australian eastern time', 'awst', 'australian western time',
    'cet', 'cest', 'central european time', 'eet', 'eest', 'eastern european time',
    'jst', 'japan standard time', 'kst', 'korea standard time',
    'ist', 'india standard time', 'sgt', 'singapore time',
    'gmt+1', 'gmt+2', 'gmt+3', 'gmt+4', 'gmt+5', 'gmt+6', 'gmt+7', 'gmt+8', 'gmt+9', 'gmt+10', 'gmt+11', 'gmt+12',
    'gmt-1', 'gmt-2', 'gmt-3', 'gmt-4', 'gmt-5', 'gmt-6', 'gmt-7', 'gmt-8', 'gmt-9', 'gmt-10', 'gmt-11', 'gmt-12',
    'utc+1', 'utc+2', 'utc+3', 'utc+4', 'utc+5', 'utc+6', 'utc+7', 'utc+8', 'utc+9', 'utc+10', 'utc+11', 'utc+12',
    'utc-1', 'utc-2', 'utc-3', 'utc-4', 'utc-5', 'utc-6', 'utc-7', 'utc-8', 'utc-9', 'utc-10', 'utc-11', 'utc-12'
  ];

  // Check for UK keywords
  const hasUK = ukKeywords.some(keyword => t.includes(keyword));

  // Check for non-UK keywords
  const hasNonUK = nonUKKeywords.some(keyword => t.includes(keyword));

  // Must have UK keywords to be included
  if (!hasUK) return false;

  // If it has both UK and non-UK, be more selective
  if (hasNonUK) {
    // Only include if UK appears before non-UK in the text (UK is primary)
    const ukIndex = Math.min(...ukKeywords.map(k => t.indexOf(k)).filter(i => i >= 0));
    const nonUKIndex = Math.min(...nonUKKeywords.map(k => t.indexOf(k)).filter(i => i >= 0));
    
    // Include if UK appears first, or if it's a clear multi-location job with UK
    if (ukIndex < nonUKIndex) return true;
    
    // Include if it's clearly a multi-location job (contains "london" and other major cities)
    if (t.includes('london') && (t.includes('dublin') || t.includes('berlin') || t.includes('paris'))) {
      return true;
    }
    
    // Otherwise exclude
    return false;
  }

  return true;
}

export function parseSalary(text?: string): SalaryNorm|undefined {
  if (!text) return undefined;
  // very light parser; prefer JSON-LD if present
  const m = text.replace(/[, ]/g,'').match(/£?(\d{2,6})(?:[-–/to]+£?(\d{2,6}))?(?:\s*(pa|perannum|year|hour|day|week|month))?/i);
  if (!m) return undefined;
  const min = Number(m[1]), max = m[2] ? Number(m[2]) : undefined;
  let period: SalaryNorm['period'] = 'year';
  if (m[3]) {
    const p = m[3].toLowerCase();
    if (p.includes('hour')) period='hour';
    else if (p.includes('day')) period='day';
    else if (p.includes('week')) period='week';
    else if (p.includes('month')) period='month';
  }
  return { min, max, currency:'GBP', period };
}

export const toISO = (s?: string) => {
  if (!s) return undefined;
  const d = new Date(s);
  return isNaN(d.getTime()) ? undefined : d.toISOString();
}

// Enhanced job validation for required fields
export function validateJobRequirements(job: any): { valid: boolean; reason?: string } {
  // Check for required fields
  if (!job.title || job.title.trim().length < 3) {
    return { valid: false, reason: 'Missing or invalid title' };
  }

  if (!job.company?.name || job.company.name.trim().length < 2) {
    return { valid: false, reason: 'Missing or invalid company name' };
  }

  if (!job.applyUrl || job.applyUrl.trim().length < 10) {
    return { valid: false, reason: 'Missing or invalid apply URL' };
  }

  // Check job description length (relaxed to ≥50 chars)
  const description = job.descriptionText || job.descriptionHtml || '';
  const cleanDescription = description.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
  if (cleanDescription.length < 50) {
    return { valid: false, reason: `Job description too short (${cleanDescription.length} chars, need ≥50)` };
  }

  // Company page link is now optional (removed requirement)
  // Apply URL aggregator filter removed to allow major job boards

  // Check if job is currently open (not past deadline)
  if (job.deadline) {
    const deadline = new Date(job.deadline);
    const now = new Date();
    if (deadline < now) {
      return { valid: false, reason: 'Job deadline has passed' };
    }
  }

  return { valid: true };
}

// Enhanced job description cleaning
export function cleanJobDescription(html: string): string {
  if (!html) return '';
  
  // Remove HTML tags
  let text = html.replace(/<[^>]*>/g, ' ');
  
  // Remove common boilerplate
  const boilerplate = [
    'apply now', 'click here to apply', 'submit your application',
    'we are an equal opportunity employer', 'diversity and inclusion',
    'please note that', 'this position is', 'the successful candidate',
    'we offer competitive', 'benefits include', 'salary range',
    'location:', 'department:', 'reports to:', 'job type:',
    'employment type:', 'work schedule:', 'shift:', 'schedule:',
    'experience level:', 'education level:', 'required skills:',
    'preferred skills:', 'responsibilities:', 'requirements:',
    'qualifications:', 'skills required:', 'skills preferred:',
    'about us:', 'company overview:', 'our company', 'we are',
    'equal opportunity', 'diversity', 'inclusion', 'inclusive',
    'affirmative action', 'accessibility', 'accommodation',
    'reasonable accommodation', 'disability', 'veteran status',
    'protected class', 'non-discrimination', 'harassment',
    'workplace safety', 'health and safety', 'environmental',
    'sustainability', 'corporate social responsibility',
    'csr', 'community', 'charity', 'volunteer', 'giving back'
  ];
  
  // Remove boilerplate text
  boilerplate.forEach(phrase => {
    const regex = new RegExp(`\\b${phrase}\\b`, 'gi');
    text = text.replace(regex, '');
  });
  
  // Clean up whitespace
  text = text.replace(/\s+/g, ' ').trim();
  
  return text;
}

// Check if job is fresh (recently posted or updated)
export function isJobFresh(job: any, maxAgeDays: number = 30): boolean {
  const now = new Date();
  const maxAge = maxAgeDays * 24 * 60 * 60 * 1000; // Convert days to milliseconds
  
  // Check posted date (multiple field names for compatibility)
  const postedDate = job.postedAt || job.posted_at || job.datePosted || job.date_posted;
  if (postedDate) {
    try {
      const posted = new Date(postedDate);
      if (!isNaN(posted.getTime()) && now.getTime() - posted.getTime() > maxAge) {
        return false;
      }
    } catch (e) {
      // Invalid date, continue to other checks
    }
  }
  
  // Check apply deadline (API jobs often use this field)
  const deadlineDate = job.applyDeadline || job.apply_deadline || job.deadline;
  if (deadlineDate) {
    try {
      const deadline = new Date(deadlineDate);
      if (!isNaN(deadline.getTime())) {
        // If deadline is in the past, job is still fresh if it was posted recently
        // For API jobs, if deadline is future, consider it fresh
        if (deadline.getTime() > now.getTime()) {
          return true; // Future deadline = fresh
        }
        // If deadline passed but was recent, still consider fresh
        if (now.getTime() - deadline.getTime() < maxAge) {
          return true;
        }
      }
    } catch (e) {
      // Invalid date, continue to other checks
    }
  }
  
  // Check if job has been updated recently (if we have that info)
  if (job.updatedAt || job.updated_at) {
    try {
      const updated = new Date(job.updatedAt || job.updated_at);
      if (!isNaN(updated.getTime()) && now.getTime() - updated.getTime() > maxAge) {
        return false;
      }
    } catch (e) {
      // Invalid date, continue
    }
  }
  
  // If no dates available, assume fresh (better to include than exclude)
  // This is especially important for API jobs that may not have postedAt
  return true;
}
