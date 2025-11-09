import { Knex } from 'knex';

const TABLE_NAME = 'up_users';
const STRIPE_CUSTOMER_COLUMN = 'stripe_customer_id';
const STRIPE_SUBSCRIPTION_COLUMN = 'stripe_subscription_id';

export async function up(knex: Knex): Promise<void> {
  console.log('Adding Stripe customer/subscription columns to users...');

  const hasTable = await knex.schema.hasTable(TABLE_NAME);
  if (!hasTable) {
    console.warn(`Table ${TABLE_NAME} does not exist, skipping Stripe column migration.`);
    return;
  }

  const existingColumns = await knex('information_schema.columns')
    .where('table_name', TABLE_NAME)
    .select('column_name');

  const columnNames = existingColumns.map(col => col.column_name);

  if (!columnNames.includes(STRIPE_CUSTOMER_COLUMN)) {
    console.log(`Adding ${STRIPE_CUSTOMER_COLUMN} column...`);
    await knex.schema.alterTable(TABLE_NAME, table => {
      table.string(STRIPE_CUSTOMER_COLUMN).nullable();
    });
  } else {
    console.log(`${STRIPE_CUSTOMER_COLUMN} already exists, skipping.`);
  }

  if (!columnNames.includes(STRIPE_SUBSCRIPTION_COLUMN)) {
    console.log(`Adding ${STRIPE_SUBSCRIPTION_COLUMN} column...`);
    await knex.schema.alterTable(TABLE_NAME, table => {
      table.string(STRIPE_SUBSCRIPTION_COLUMN).nullable();
    });
  } else {
    console.log(`${STRIPE_SUBSCRIPTION_COLUMN} already exists, skipping.`);
  }

  console.log('Stripe columns migration complete.');
}

export async function down(knex: Knex): Promise<void> {
  console.log('Removing Stripe customer/subscription columns from users...');

  const hasTable = await knex.schema.hasTable(TABLE_NAME);
  if (!hasTable) {
    console.warn(`Table ${TABLE_NAME} does not exist, skipping Stripe column rollback.`);
    return;
  }

  const hasCustomerColumn = await knex.schema.hasColumn(TABLE_NAME, STRIPE_CUSTOMER_COLUMN);
  if (hasCustomerColumn) {
    await knex.schema.alterTable(TABLE_NAME, table => {
      table.dropColumn(STRIPE_CUSTOMER_COLUMN);
    });
  }

  const hasSubscriptionColumn = await knex.schema.hasColumn(TABLE_NAME, STRIPE_SUBSCRIPTION_COLUMN);
  if (hasSubscriptionColumn) {
    await knex.schema.alterTable(TABLE_NAME, table => {
      table.dropColumn(STRIPE_SUBSCRIPTION_COLUMN);
    });
  }

  console.log('Stripe columns removed.');
}
