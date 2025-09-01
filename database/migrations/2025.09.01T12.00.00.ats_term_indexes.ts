import type { Knex } from 'knex';

export async function up(knex: Knex) {
  await knex.schema.raw(`CREATE INDEX IF NOT EXISTS idx_ats_terms_phrase_ci ON ats_terms (LOWER(phrase));`);
  await knex.schema.raw(`CREATE INDEX IF NOT EXISTS idx_ats_terms_field_ci  ON ats_terms (LOWER(field));`);
  await knex.schema.raw(`CREATE INDEX IF NOT EXISTS idx_ats_terms_role_ci   ON ats_terms (LOWER(role));`);
}

export async function down(knex: Knex) {
  await knex.schema.raw(`DROP INDEX IF EXISTS idx_ats_terms_phrase_ci;`);
  await knex.schema.raw(`DROP INDEX IF EXISTS idx_ats_terms_field_ci;`);
  await knex.schema.raw(`DROP INDEX IF EXISTS idx_ats_terms_role_ci;`);
}
