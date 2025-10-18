import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  // Add cvAnalysis column to up_users table
  await knex.schema.alterTable('up_users', (table) => {
    table.jsonb('cv_analysis').nullable();
  });

  // Add index for better query performance on cvAnalysis
  await knex.raw(`
    CREATE INDEX IF NOT EXISTS idx_up_users_cv_analysis 
    ON up_users USING gin (cv_analysis)
  `);
}

export async function down(knex: Knex): Promise<void> {
  // Remove index first
  await knex.raw(`DROP INDEX IF EXISTS idx_up_users_cv_analysis`);
  
  // Remove cvAnalysis column
  await knex.schema.alterTable('up_users', (table) => {
    table.dropColumn('cv_analysis');
  });
}
