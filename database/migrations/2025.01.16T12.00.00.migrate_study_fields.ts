import { Knex } from 'knex';

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

export async function up(knex: Knex): Promise<void> {
  console.log('Starting study field migration...');
  
  // Get all users with study field values
  const users = await knex('up_users')
    .select('id', 'study_field')
    .whereNotNull('study_field')
    .where('study_field', '!=', '');
  
  console.log(`Found ${users.length} users with study field values`);
  
  let migratedCount = 0;
  
  for (const user of users) {
    const legacyValue = user.study_field;
    const newSlug = LEGACY_MAPPINGS[legacyValue];
    
    if (newSlug && newSlug !== legacyValue) {
      await knex('up_users')
        .where('id', user.id)
        .update({ study_field: newSlug });
      
      migratedCount++;
      console.log(`Migrated user ${user.id}: "${legacyValue}" → "${newSlug}"`);
    }
  }
  
  console.log(`Migration completed. Migrated ${migratedCount} users.`);
}

export async function down(knex: Knex): Promise<void> {
  console.log('Reverting study field migration...');
  
  // Create reverse mapping
  const reverseMappings: Record<string, string> = {};
  for (const [legacy, slug] of Object.entries(LEGACY_MAPPINGS)) {
    if (!reverseMappings[slug]) {
      reverseMappings[slug] = legacy;
    }
  }
  
  // Get all users with migrated study field values
  const users = await knex('up_users')
    .select('id', 'study_field')
    .whereIn('study_field', Object.keys(reverseMappings));
  
  console.log(`Found ${users.length} users with migrated study field values`);
  
  let revertedCount = 0;
  
  for (const user of users) {
    const slug = user.study_field;
    const legacyValue = reverseMappings[slug];
    
    if (legacyValue) {
      await knex('up_users')
        .where('id', user.id)
        .update({ study_field: legacyValue });
      
      revertedCount++;
      console.log(`Reverted user ${user.id}: "${slug}" → "${legacyValue}"`);
    }
  }
  
  console.log(`Revert completed. Reverted ${revertedCount} users.`);
}
