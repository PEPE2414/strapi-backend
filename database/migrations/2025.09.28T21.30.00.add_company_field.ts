import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  console.log('Adding JSON fields back to jobs table...');
  
  try {
    // Check if jobs table exists
    const hasJobsTable = await knex.schema.hasTable('jobs');
    if (!hasJobsTable) {
      console.log('Jobs table does not exist, skipping migration');
      return;
    }
    
    // Add all JSON fields with proper defaults
    await knex.schema.alterTable('jobs', (table) => {
      // Company field
      if (!knex.schema.hasColumn('jobs', 'company')) {
        table.json('company').defaultTo(JSON.stringify({ name: 'Unknown' }));
      }
      
      // Salary field
      if (!knex.schema.hasColumn('jobs', 'salary')) {
        table.json('salary').nullable();
      }
      
      // Related degree field
      if (!knex.schema.hasColumn('jobs', 'related_degree')) {
        table.json('related_degree').nullable();
      }
      
      // Degree level field
      if (!knex.schema.hasColumn('jobs', 'degree_level')) {
        table.json('degree_level').nullable();
      }
    });
    
    console.log('All JSON fields added successfully');
    
  } catch (error) {
    console.error('Error adding JSON fields:', error);
    throw error;
  }
}

export async function down(knex: Knex): Promise<void> {
  console.log('Removing JSON fields from jobs table...');
  
  try {
    await knex.schema.alterTable('jobs', (table) => {
      table.dropColumn('company');
      table.dropColumn('salary');
      table.dropColumn('related_degree');
      table.dropColumn('degree_level');
    });
    
    console.log('JSON fields removed successfully');
  } catch (error) {
    console.error('Error removing JSON fields:', error);
    throw error;
  }
}
