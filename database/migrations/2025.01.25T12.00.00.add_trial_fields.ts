import type { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
  // Check if columns exist before adding them (using snake_case for DB columns)
  const hasTrialActive = await knex.schema.hasColumn('up_users', 'trial_active');
  const hasTrialEndsAt = await knex.schema.hasColumn('up_users', 'trial_ends_at');
  const hasTrialLimits = await knex.schema.hasColumn('up_users', 'trial_limits');

  if (!hasTrialActive) {
    await knex.schema.table('up_users', (table) => {
      table.boolean('trial_active').defaultTo(false);
    });
  }

  if (!hasTrialEndsAt) {
    await knex.schema.table('up_users', (table) => {
      table.dateTime('trial_ends_at').nullable();
    });
  }

  if (!hasTrialLimits) {
    await knex.schema.table('up_users', (table) => {
      table.jsonb('trial_limits').nullable();
    });
  }
}

export async function down(knex: Knex): Promise<void> {
  const hasTrialActive = await knex.schema.hasColumn('up_users', 'trial_active');
  const hasTrialEndsAt = await knex.schema.hasColumn('up_users', 'trial_ends_at');
  const hasTrialLimits = await knex.schema.hasColumn('up_users', 'trial_limits');

  if (hasTrialActive) {
    await knex.schema.table('up_users', (table) => {
      table.dropColumn('trial_active');
    });
  }

  if (hasTrialEndsAt) {
    await knex.schema.table('up_users', (table) => {
      table.dropColumn('trial_ends_at');
    });
  }

  if (hasTrialLimits) {
    await knex.schema.table('up_users', (table) => {
      table.dropColumn('trial_limits');
    });
  }
}

