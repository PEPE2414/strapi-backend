import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  // Add user_id column to linkedin_optimisations table
  await knex.schema.alterTable('linkedin_optimisations', (table) => {
    table.integer('user_id').unsigned().nullable();
    table.foreign('user_id').references('id').inTable('up_users').onDelete('CASCADE');
  });

  // Update existing records to link them to users based on userEmail
  // This will only work if the userEmail matches an existing user email
  await knex.raw(`
    UPDATE linkedin_optimisations 
    SET user_id = (
      SELECT id 
      FROM up_users 
      WHERE up_users.email = linkedin_optimisations.user_email
    )
    WHERE user_email IS NOT NULL
  `);

  // Make user_id required after populating existing records
  await knex.schema.alterTable('linkedin_optimisations', (table) => {
    table.integer('user_id').unsigned().notNullable().alter();
  });
}

export async function down(knex: Knex): Promise<void> {
  // Remove the foreign key constraint and column
  await knex.schema.alterTable('linkedin_optimisations', (table) => {
    table.dropForeign(['user_id']);
    table.dropColumn('user_id');
  });
}
