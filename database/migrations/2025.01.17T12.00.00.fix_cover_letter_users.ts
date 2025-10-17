import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  // First, let's see what we're working with
  console.log('🔍 Checking cover letters without user assignments...');
  
  const coverLettersWithoutUser = await knex('cover_letters')
    .whereNull('user')
    .orWhere('user', 0)
    .select('id', 'title', 'company', 'created_at');
    
  console.log(`Found ${coverLettersWithoutUser.length} cover letters without user assignments`);
  
  if (coverLettersWithoutUser.length > 0) {
    console.log('⚠️  WARNING: Found cover letters without user assignments:');
    coverLettersWithoutUser.forEach((cl: any) => {
      console.log(`  - ID: ${cl.id}, Title: ${cl.title}, Company: ${cl.company}, Created: ${cl.created_at}`);
    });
    
    // For now, we'll delete these orphaned cover letters since we can't determine ownership
    // In a production environment, you might want to assign them to a specific user or archive them
    console.log('🗑️  Deleting orphaned cover letters (they cannot be properly attributed to users)...');
    
    await knex('cover_letters')
      .whereNull('user')
      .orWhere('user', 0)
      .del();
      
    console.log('✅ Orphaned cover letters deleted');
  }
  
  // Ensure the user column is properly set up
  console.log('🔧 Ensuring user column is properly configured...');
  
  // Check if user column exists and is properly configured
  const hasUserColumn = await knex.schema.hasColumn('cover_letters', 'user');
  if (!hasUserColumn) {
    console.log('❌ User column does not exist in cover_letters table!');
    throw new Error('User column missing from cover_letters table');
  }
  
  // Add a NOT NULL constraint to prevent future orphaned records
  try {
    await knex.schema.alterTable('cover_letters', (table) => {
      table.integer('user').notNullable().alter();
    });
    console.log('✅ Added NOT NULL constraint to user column');
  } catch (error) {
    console.log('ℹ️  User column constraint already exists or cannot be modified');
  }
  
  console.log('✅ Cover letter user assignment migration completed');
}

export async function down(knex: Knex): Promise<void> {
  // Remove the NOT NULL constraint
  try {
    await knex.schema.alterTable('cover_letters', (table) => {
      table.integer('user').nullable().alter();
    });
    console.log('✅ Removed NOT NULL constraint from user column');
  } catch (error) {
    console.log('ℹ️  Could not remove constraint');
  }
}
