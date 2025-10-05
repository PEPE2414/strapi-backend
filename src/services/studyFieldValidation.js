// Study field validation service
// Provides validation and mapping for study field values

const VALID_STUDY_FIELDS = [
  'accounting-finance',
  'actuarial-science',
  'aerospace-engineering',
  'architecture',
  'biochemistry',
  'biomedical-sciences',
  'business-management',
  'chemical-engineering',
  'chemistry',
  'civil-engineering',
  'computer-science',
  'computing-it',
  'construction-qs',
  'data-science-analytics',
  'design-product',
  'design-visual',
  'economics',
  'electrical-electronic',
  'energy-power',
  'english-linguistics',
  'environmental-science',
  'geography',
  'geology-earth-science',
  'history-archaeology',
  'languages-cultures',
  'law',
  'maths',
  'maths-physics',
  'maths-statistics',
  'mechanical-engineering',
  'media-communications',
  'medicine-dentistry',
  'nursing-allied-health',
  'pharmacy-pharmacology',
  'physics',
  'physics-astronomy',
  'politics-ir',
  'psychology',
  'social-sciences',
  'sport-exercise-science',
  'teacher-education',
  'theatre-film',
  'tourism-hospitality'
];

// Legacy value mappings for backward compatibility
const LEGACY_MAPPINGS = {
  'Business Management': 'business-management',
  'Economics': 'economics',
  'Accounting & Finance': 'accounting-finance',
  'Computer Science': 'computer-science',
  'Data Science': 'data-science-analytics',
  'Software Engineering': 'computer-science',
  'Electrical Engineering': 'electrical-electronic',
  'Mechanical Engineering': 'mechanical-engineering',
  'Civil Engineering': 'civil-engineering',
  'Architecture': 'architecture',
  'Design': 'design-product',
  'Mathematics': 'maths',
  'Physics': 'physics',
  'Chemistry': 'chemistry',
  'Biology': 'biomedical-sciences',
  'Medicine': 'medicine-dentistry',
  'Nursing': 'nursing-allied-health',
  'Law': 'law',
  'Politics / International Relations': 'politics-ir',
  'Psychology': 'psychology',
  'Geography': 'geography',
  'Environmental Science': 'environmental-science',
  'Marketing': 'business-management',
  'Communications': 'media-communications',
  'Education': 'teacher-education',
  'Languages': 'languages-cultures',
  'History': 'history-archaeology',
  'Philosophy': 'social-sciences'
};

/**
 * Validates and normalizes a study field value
 * @param {string} studyField - The study field value to validate
 * @returns {object} - { isValid: boolean, normalizedValue: string, isLegacy: boolean }
 */
function validateStudyField(studyField) {
  if (!studyField || typeof studyField !== 'string') {
    return { isValid: false, normalizedValue: '', isLegacy: false };
  }

  const trimmed = studyField.trim();
  
  // Check if it's already a valid slug
  if (VALID_STUDY_FIELDS.includes(trimmed)) {
    return { isValid: true, normalizedValue: trimmed, isLegacy: false };
  }
  
  // Check if it's a legacy value that can be mapped
  if (LEGACY_MAPPINGS[trimmed]) {
    return { 
      isValid: true, 
      normalizedValue: LEGACY_MAPPINGS[trimmed], 
      isLegacy: true 
    };
  }
  
  // Invalid value
  return { isValid: false, normalizedValue: '', isLegacy: false };
}

/**
 * Gets all valid study field slugs
 * @returns {string[]} - Array of valid study field slugs
 */
function getValidStudyFields() {
  return [...VALID_STUDY_FIELDS];
}

/**
 * Maps a legacy study field value to its new slug
 * @param {string} legacyValue - The legacy study field value
 * @returns {string} - The mapped slug or original value if no mapping exists
 */
function mapLegacyStudyField(legacyValue) {
  if (!legacyValue || typeof legacyValue !== 'string') {
    return '';
  }
  
  const trimmed = legacyValue.trim();
  return LEGACY_MAPPINGS[trimmed] || trimmed;
}

module.exports = {
  validateStudyField,
  getValidStudyFields,
  mapLegacyStudyField,
  VALID_STUDY_FIELDS,
  LEGACY_MAPPINGS
};
