import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  // Remove the old 'deadline' field from the jobs table
  await knex.schema.alterTable('jobs', (table) => {
    table.dropColumn('deadline');
  });
}

export async function down(knex: Knex): Promise<void> {
  // Add back the 'deadline' field if needed for rollback
  await knex.schema.alterTable('jobs', (table) => {
    table.datetime('deadline');
  });
}
