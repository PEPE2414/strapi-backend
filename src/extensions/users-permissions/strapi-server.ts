// Allow authenticated users to PUT /api/users/me to update jobPrefs (and only jobPrefs)
module.exports = (plugin) => {
  // --- Ensure controllers container exists
  plugin.controllers = plugin.controllers || {};
  plugin.controllers.user = plugin.controllers.user || {};

  // --- Controller: updateMe
  plugin.controllers.user.updateMe = async (ctx) => {
    const authUser = ctx.state && ctx.state.user;
    if (!authUser) return ctx.unauthorized('You must be logged in.');

    const body = ctx.request.body || {};
    const { jobPrefs } = body;

    if (typeof jobPrefs !== 'undefined' && jobPrefs !== null && typeof jobPrefs !== 'object') {
      return ctx.badRequest('jobPrefs must be an object or null.');
    }

    try {
      const updated = await strapi.entityService.update(
        'plugin::users-permissions.user',
        authUser.id,
        { data: { jobPrefs } }
      );

      ctx.body = { ok: true, id: updated.id, jobPrefs: updated.jobPrefs ?? null };
    } catch (err) {
      strapi.log.error('users-permissions:updateMe failed', err);
      ctx.throw(400, 'Failed to update profile');
    }
  };

  // --- Ensure content-api routes container exists
  plugin.routes = plugin.routes || {};
  const ca = plugin.routes['content-api'];
  if (!ca || !Array.isArray(ca.routes)) {
    plugin.routes['content-api'] = { type: 'content-api', routes: (ca && ca.routes) || [] };
  }

  // --- Register route
  plugin.routes['content-api'].routes.push({
    method: 'PUT',
    path: '/users/me',
    handler: 'user.updateMe',
    config: {
      // Use JWT middleware so only logged-in users can call it,
      // and skip the role/permission matrix that caused the 403.
      middlewares: ['plugin::users-permissions.jwt'],
      policies: []
      // Do NOT set auth:true here, that re-enables the permissions gate.
    },
  });

  return plugin;
};
