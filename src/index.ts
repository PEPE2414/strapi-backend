// src/index.ts
import type { Core } from '@strapi/strapi';

export default {
  register({ strapi }: { strapi: Core.Strapi }) {
    // Ensure Koa trusts the reverse proxy for HTTPS detection
    strapi.server.app.proxy = true;
  },
  async bootstrap({ strapi }: { strapi: Core.Strapi }) {
    try {
      // Grant permissions to authenticated role for custom API routes using Strapi v5 API
      const authenticatedRole = await strapi.db.query('plugin::users-permissions.role').findOne({
        where: { type: 'authenticated' },
      });

      if (authenticatedRole) {
        // Define the permissions for our custom routes
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

        // Use Strapi's permission service to grant permissions
        const permissionService = strapi.service('plugin::users-permissions.permission');
        
        for (const action of customPermissions) {
          try {
            await permissionService.create({
              action,
              subject: null,
              properties: {},
              conditions: [],
              role: authenticatedRole.id,
            });
            strapi.log.info(`Granted permission: ${action} to authenticated role`);
          } catch (error: any) {
            // Permission might already exist, that's okay
            if (!error.message?.includes('already exists')) {
              strapi.log.warn(`Failed to grant permission ${action}:`, error.message);
            }
          }
        }
      }
    } catch (error) {
      strapi.log.warn('Failed to set up custom route permissions:', error);
    }
  },
};
