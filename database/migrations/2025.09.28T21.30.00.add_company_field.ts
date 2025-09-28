import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  console.log('Adding company field back to jobs table...');
  
  try {
    // Check if jobs table exists
    const hasJobsTable = await knex.schema.hasTable('jobs');
    if (!hasJobsTable) {
      console.log('Jobs table does not exist, skipping migration');
      return;
    }
    
    // Check if company column already exists
    const hasCompanyColumn = await knex.schema.hasColumn('jobs', 'company');
    if (hasCompanyColumn) {
      console.log('Company column already exists, skipping migration');
      return;
    }
    
    // Add the company column as JSON with a default value
    await knex.schema.alterTable('jobs', (table) => {
      table.json('company').defaultTo(JSON.stringify({ name: 'Unknown' }));
    });
    
    console.log('Company field added successfully');
    
  } catch (error) {
    console.error('Error adding company field:', error);
    throw error;
  }
}

export async function down(knex: Knex): Promise<void> {
  console.log('Removing company field from jobs table...');
  
  try {
    await knex.schema.alterTable('jobs', (table) => {
      table.dropColumn('company');
    });
    
    console.log('Company field removed successfully');
  } catch (error) {
    console.error('Error removing company field:', error);
    throw error;
  }
}
