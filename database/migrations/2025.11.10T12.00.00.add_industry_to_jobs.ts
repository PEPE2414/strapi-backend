import { Knex } from 'knex';

const TABLE_NAME = 'jobs';
const COLUMN_NAME = 'industry';

export async function up(knex: Knex): Promise<void> {
  const hasTable = await knex.schema.hasTable(TABLE_NAME);
  if (!hasTable) {
    console.warn(`[add_industry_to_jobs] Table "${TABLE_NAME}" not found, skipping`);
    return;
  }

  const hasColumn = await knex.schema.hasColumn(TABLE_NAME, COLUMN_NAME);
  if (hasColumn) {
    console.log(`[add_industry_to_jobs] Column "${COLUMN_NAME}" already exists`);
    return;
  }

  await knex.schema.alterTable(TABLE_NAME, (table) => {
    table.string(COLUMN_NAME, 128).nullable();
  });

  console.log(`[add_industry_to_jobs] Column "${COLUMN_NAME}" added to "${TABLE_NAME}"`);
}

export async function down(knex: Knex): Promise<void> {
  const hasTable = await knex.schema.hasTable(TABLE_NAME);
  if (!hasTable) {
    return;
  }

  const hasColumn = await knex.schema.hasColumn(TABLE_NAME, COLUMN_NAME);
  if (!hasColumn) {
    return;
  }

  await knex.schema.alterTable(TABLE_NAME, (table) => {
    table.dropColumn(COLUMN_NAME);
  });

  console.log(`[add_industry_to_jobs] Column "${COLUMN_NAME}" dropped from "${TABLE_NAME}"`);
}

