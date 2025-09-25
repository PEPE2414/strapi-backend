import type { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
  // Create indexes for job performance optimization
  await knex.raw(`
    CREATE INDEX IF NOT EXISTS idx_jobs_jobtype ON jobs ((data ->> 'jobType'));
  `);
  
  await knex.raw(`
    CREATE INDEX IF NOT EXISTS idx_jobs_deadline ON jobs ((data ->> 'deadline'));
  `);
  
  await knex.raw(`
    CREATE INDEX IF NOT EXISTS idx_jobs_postedat ON jobs ((data ->> 'postedAt'));
  `);
  
  await knex.raw(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_jobs_hash ON jobs ((data ->> 'hash'));
  `);
  
  await knex.raw(`
    CREATE INDEX IF NOT EXISTS idx_jobs_location ON jobs ((data ->> 'location'));
  `);
  
  await knex.raw(`
    CREATE INDEX IF NOT EXISTS idx_jobs_source ON jobs ((data ->> 'source'));
  `);
}

export async function down(knex: Knex): Promise<void> {
  await knex.raw(`DROP INDEX IF EXISTS idx_jobs_jobtype`);
  await knex.raw(`DROP INDEX IF EXISTS idx_jobs_deadline`);
  await knex.raw(`DROP INDEX IF EXISTS idx_jobs_postedat`);
  await knex.raw(`DROP INDEX IF EXISTS idx_jobs_hash`);
  await knex.raw(`DROP INDEX IF EXISTS idx_jobs_location`);
  await knex.raw(`DROP INDEX IF EXISTS idx_jobs_source`);
}
