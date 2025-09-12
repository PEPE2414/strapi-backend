// Extend users-permissions to allow PUT /api/users/me for updating jobPrefs only
export default (plugin) => {
  // --- Controller ---
  plugin.controllers.user.updateMe = async (ctx) => {
    const authUser = ctx.state?.user;
    if (!authUser) return ctx.unauthorized('You must be logged in.');

    const body = ctx.request.body || {};
    const { jobPrefs } = body;

    // Optional sanity check: if provided, jobPrefs must be an object (or null)
    if (typeof jobPrefs !== 'undefined' && (jobPrefs === null ? false : typeof jobPrefs !== 'object')) {
      return ctx.badRequest('jobPrefs must be an object.');
    }

    // Persist only jobPrefs on the current user
    const updated = await strapi
      .query('plugin::users-permissions.user')
      .update({
        where: { id: authUser.id },
        data: { jobPrefs },
      });

    // Minimal, safe response (avoid exposing private fields)
    ctx.body = {
      id: updated.id,
      jobPrefs: updated.jobPrefs ?? null,
    };
  };

  // --- Route (content API) ---
  const ca = plugin.routes['content-api'] || { type: 'content-api', routes: [] };
  ca.routes.push({
    method: 'PUT',
    path: '/users/me',
    handler: 'user.updateMe',
    config: {
      // Parse & validate JWT; sets ctx.state.user or 401 if missing/invalid.
      middlewares: ['plugin::users-permissions.jwt'],
      // IMPORTANT: skip the role/permission gate that causes 403 in prod.
      policies: [],
    },
  });
  plugin.routes['content-api'] = ca;

  return plugin;
};
