// src/index.ts
import type { Core } from '@strapi/strapi';
import { scheduledTasksService } from './services/scheduledTasks';

export default {
  register({ strapi }: { strapi: Core.Strapi }) {
    // Ensure Koa trusts the reverse proxy for HTTPS detection
    strapi.server.app.proxy = true;
  },
  async bootstrap({ strapi }: { strapi: Core.Strapi }) {
    // Run trial fields migration
    try {
      await runTrialFieldsMigration(strapi);
      strapi.log.info('✅ Trial fields migration completed');
    } catch (error) {
      strapi.log.warn('⚠️  Trial fields migration failed:', error);
    }

    try {
      // Grant permissions to authenticated role for custom API routes using direct database approach
      const authenticatedRole = await strapi.db.query('plugin::users-permissions.role').findOne({
        where: { type: 'authenticated' },
      });

      if (authenticatedRole) {
        // Define the permissions for our custom routes (policy-based in Strapi v5)
        const customPermissions = [
          'api::profile.profile.getProfile',
          'api::profile.profile.updateProfile',
          'api::profile.profile.getCv',
          'api::profile.profile.linkCv',
          'api::usage-log.usage-log.find',
          'api::usage-log.usage-log.findOne',
          'api::usage-log.usage-log.create',
          'api::usage-log.usage-log.update',
          'api::usage-log.usage-log.delete',
          'api::linkedin-recruiter.linkedin-recruiter.search',
          'api::linkedin-recruiter.linkedin-recruiter.results',
          'api::cheat-sheet.cheat-sheet.me',
          'api::cheat-sheet.cheat-sheet.generate',
        ];

        // Get existing permissions
        const existingPermissions = authenticatedRole.permissions || [];
        const existingActionIds = existingPermissions.map((p: any) => p.action);

        // Add new permissions that don't already exist
        const newPermissions = [];
        for (const action of customPermissions) {
          if (!existingActionIds.includes(action)) {
            newPermissions.push({
              action,
              subject: null,
              properties: {},
              conditions: [],
              role: authenticatedRole.id,
            });
          }
        }

        // Update role with new permissions using direct database query
        if (newPermissions.length > 0) {
          await strapi.db.connection('permissions').insert(newPermissions);
          strapi.log.info(`Granted ${newPermissions.length} permissions to authenticated role`);
        } else {
          strapi.log.info('All custom route permissions already exist');
        }
      }
    } catch (error) {
      strapi.log.warn('Failed to set up custom route permissions:', error);
    }

    // Start scheduled tasks (job cleanup)
    try {
      scheduledTasksService.start();
      strapi.log.info('✅ Scheduled tasks started successfully');
    } catch (error) {
      strapi.log.error('❌ Failed to start scheduled tasks:', error);
    }
  },
};

async function runTrialFieldsMigration(strapi: Core.Strapi) {
  const hasTrialActive = await strapi.db.connection.schema.hasColumn('up_users', 'trial_active');
  const hasTrialEndsAt = await strapi.db.connection.schema.hasColumn('up_users', 'trial_ends_at');
  const hasTrialLimits = await strapi.db.connection.schema.hasColumn('up_users', 'trial_limits');

  if (!hasTrialActive || !hasTrialEndsAt || !hasTrialLimits) {
    strapi.log.info('🔧 Adding trial fields to up_users table...');
    
    if (!hasTrialActive) {
      await strapi.db.connection.schema.alterTable('up_users', (table) => {
        table.boolean('trial_active').defaultTo(false);
      });
      strapi.log.info('✅ Added trial_active column');
    }

    if (!hasTrialEndsAt) {
      await strapi.db.connection.schema.alterTable('up_users', (table) => {
        table.dateTime('trial_ends_at').nullable();
      });
      strapi.log.info('✅ Added trial_ends_at column');
    }

    if (!hasTrialLimits) {
      await strapi.db.connection.schema.alterTable('up_users', (table) => {
        table.jsonb('trial_limits').nullable();
      });
      strapi.log.info('✅ Added trial_limits column');
    }
  } else {
    strapi.log.info('ℹ️  Trial fields already exist in up_users table');
  }
}
