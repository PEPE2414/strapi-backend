// src/index.ts
import type { Core } from '@strapi/strapi';

export default {
  register({ strapi }: { strapi: Core.Strapi }) {
    // Ensure Koa trusts the reverse proxy for HTTPS detection
    strapi.server.app.proxy = true;
  },
  async bootstrap({ strapi }: { strapi: Core.Strapi }) {
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
  },
};
