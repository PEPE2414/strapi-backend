// src/extensions/users-permissions/strapi-server.ts
// v5-safe: do NOT add routes/middlewares. Just override the built-in controller.
// Requires Authenticated role permission: User → update (me).
declare const strapi: any;

export default (plugin: any) => {
  // Ensure containers exist
  plugin.controllers = plugin.controllers || {};
  plugin.controllers.user = plugin.controllers.user || {};

  // Keep a reference (optional)
  const originalUpdateMe = plugin.controllers.user.updateMe;

  // Override: allow updating jobPrefs on /api/users/me
  plugin.controllers.user.updateMe = async (ctx: any) => {
    const authUser = ctx.state?.user;
    if (!authUser?.id) return ctx.unauthorized('You must be authenticated.');

    const body = ctx.request.body || {};
    const { jobPrefs } = body;

    // If you also want to allow core fields (email/password), you could call originalUpdateMe here.
    // For prefs only, skip it to avoid extra validation complexity.

    if (typeof jobPrefs !== 'undefined') {
      if (jobPrefs !== null && typeof jobPrefs !== 'object') {
        return ctx.badRequest('jobPrefs must be an object or null.');
      }
      try {
        await strapi.entityService.update('plugin::users-permissions.user', authUser.id, {
          data: { jobPrefs },
        });
      } catch (err) {
        strapi.log.error('update jobPrefs failed', err);
        return ctx.throw(400, 'Failed to update jobPrefs');
      }
    }

    // Minimal success payload
    ctx.body = { ok: true };
    return ctx.body;
  };

  return plugin;
};
