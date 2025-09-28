import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  console.log('Finalizing JSON fields migration...');
  
  try {
    // Check if jobs table exists
    const hasJobsTable = await knex.schema.hasTable('jobs');
    if (!hasJobsTable) {
      console.log('Jobs table does not exist, skipping migration');
      return;
    }
    
    // Get current column info
    const columns = await knex('information_schema.columns')
      .where('table_name', 'jobs')
      .where('table_schema', 'public')
      .select('column_name', 'data_type');
    
    const columnNames = columns.map(col => col.column_name);
    console.log('Current columns:', columnNames);
    
    // Add missing JSON columns one by one
    const jsonFields = [
      { name: 'company', default: JSON.stringify({ name: 'Unknown' }) },
      { name: 'salary', default: null },
      { name: 'related_degree', default: null },
      { name: 'degree_level', default: null }
    ];
    
    for (const field of jsonFields) {
      if (!columnNames.includes(field.name)) {
        console.log(`Adding ${field.name} column...`);
        
        await knex.schema.alterTable('jobs', (table) => {
          if (field.default) {
            table.json(field.name).defaultTo(field.default);
          } else {
            table.json(field.name).nullable();
          }
        });
        
        console.log(`${field.name} column added successfully`);
      } else {
        console.log(`${field.name} column already exists`);
      }
    }
    
    console.log('JSON fields migration completed successfully');
    
  } catch (error) {
    console.error('Error during JSON fields migration:', error);
    throw error;
  }
}

export async function down(knex: Knex): Promise<void> {
  console.log('Rolling back JSON fields migration...');
  
  try {
    await knex.schema.alterTable('jobs', (table) => {
      table.dropColumn('company');
      table.dropColumn('salary');
      table.dropColumn('related_degree');
      table.dropColumn('degree_level');
    });
    
    console.log('JSON fields rollback completed');
  } catch (error) {
    console.error('Error during JSON fields rollback:', error);
    throw error;
  }
}
