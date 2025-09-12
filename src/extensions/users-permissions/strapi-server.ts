// backend/src/extensions/users-permissions/strapi-server.ts
import type { Core } from '@strapi/strapi';

export default ({ strapi }: { strapi: Core.Strapi }) => {
  const plugin = strapi.plugin('users-permissions');

  // ---- Controller: updateMe (only jobPrefs) ----
  // Ensure the controllers bag exists
  (plugin.controllers as any).user = (plugin.controllers as any).user || {};
  (plugin.controllers as any).user.updateMe = async (ctx: Core.KoaContext) => {
    const authUser = ctx.state.user;
    if (!authUser?.id) return ctx.unauthorized('You must be authenticated.');

    let { jobPrefs } = (ctx.request.body as any) || {};
    // Allow a JSON string or an object
    if (typeof jobPrefs === 'string') {
      try { jobPrefs = JSON.parse(jobPrefs); } catch { /* ignore parse error */ }
    }
    if (jobPrefs == null || typeof jobPrefs !== 'object') {
      return ctx.badRequest('jobPrefs must be an object.');
    }

    const updated = await strapi.entityService.update(
      'plugin::users-permissions.user',
      authUser.id,
      { data: { jobPrefs } }
    );

    // Return a minimal payload (avoid exposing sensitive fields)
    ctx.body = { id: updated.id, jobPrefs: updated.jobPrefs };
  };

  // ---- Route: PUT /users/me ----
  // Support both shapes for plugin.routes in different setups
  const bucket =
    (plugin.routes as any)['content-api'] ??
    ((plugin.routes as any)['content-api'] = { type: 'content-api', routes: [] });

  const routesArray = Array.isArray(bucket.routes) ? bucket.routes : (plugin.routes as any)['content-api'];

  routesArray.push({
    method: 'PUT',
    path: '/users/me',
    handler: 'user.updateMe',
    config: {
      // Use the plugin’s built-in auth policy. Do NOT reference a non-existent middleware.
      policies: ['plugin::users-permissions.isAuthenticated'],
      middlewares: [],
    },
  });

  return plugin;
};
