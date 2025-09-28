import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  console.log('Starting company column migration...');
  
  try {
    // Check if jobs table exists
    const hasJobsTable = await knex.schema.hasTable('jobs');
    if (!hasJobsTable) {
      console.log('Jobs table does not exist, skipping migration');
      return;
    }
    
    // Check if company column exists
    const hasCompanyColumn = await knex.schema.hasColumn('jobs', 'company');
    if (!hasCompanyColumn) {
      console.log('Company column does not exist, skipping migration');
      return;
    }
    
    // Get a sample of existing data to understand the current format
    const sampleData = await knex('jobs').select('id', 'company').limit(10);
    console.log('Sample company data:', sampleData);
    
    if (sampleData.length === 0) {
      console.log('No existing data to migrate');
      return;
    }
    
    // Check if the first record's company field is a string (not JSON)
    const firstRecord = sampleData[0];
    if (firstRecord.company && typeof firstRecord.company === 'string') {
      console.log('Converting string company values to JSON format...');
      
      // Convert all string company values to JSON format
      await knex.raw(`
        UPDATE jobs 
        SET company = CASE 
          WHEN company IS NULL OR company = '' THEN '{"name": "Unknown"}'
          WHEN company::text ~ '^[^{]' THEN json_build_object('name', company::text)
          ELSE company::jsonb
        END
        WHERE company IS NOT NULL
      `);
      
      console.log('Company column migration completed successfully');
    } else {
      console.log('Company column is already in JSON format or empty');
    }
    
  } catch (error) {
    console.error('Error during company column migration:', error);
    throw error;
  }
}

export async function down(knex: Knex): Promise<void> {
  console.log('Rolling back company column migration...');
  
  try {
    // Convert JSON company back to string format
    await knex.raw(`
      UPDATE jobs 
      SET company = CASE 
        WHEN company::jsonb ? 'name' THEN (company::jsonb->>'name')
        ELSE 'Unknown'
      END
      WHERE company IS NOT NULL
    `);
    
    console.log('Company column rollback completed');
  } catch (error) {
    console.error('Error during company column rollback:', error);
    throw error;
  }
}
