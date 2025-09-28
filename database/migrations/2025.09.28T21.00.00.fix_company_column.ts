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
    
    console.log('Dropping and recreating company column to fix JSON conversion...');
    
    // Step 1: Create a temporary column with the new JSON format
    await knex.schema.alterTable('jobs', (table) => {
      table.json('company_temp').defaultTo(JSON.stringify({ name: 'Unknown' }));
    });
    
    // Step 2: Migrate data from old column to new column
    await knex.raw(`
      UPDATE jobs 
      SET company_temp = CASE 
        WHEN company IS NULL OR company = '' THEN '{"name": "Unknown"}'
        WHEN company::text ~ '^[^{]' THEN json_build_object('name', company::text)
        ELSE company::jsonb
      END
      WHERE company IS NOT NULL
    `);
    
    // Step 3: Drop the old column
    await knex.schema.alterTable('jobs', (table) => {
      table.dropColumn('company');
    });
    
    // Step 4: Rename the temporary column to the original name
    await knex.schema.alterTable('jobs', (table) => {
      table.renameColumn('company_temp', 'company');
    });
    
    console.log('Company column migration completed successfully');
    
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
