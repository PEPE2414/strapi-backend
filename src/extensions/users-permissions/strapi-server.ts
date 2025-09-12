// /src/extensions/users-permissions/strapi-server.ts
// Adds PUT /api/users/me to update the current user's profile (whitelisted fields only)

export default (plugin: any) => {
  // 1) Route
  plugin.routes['content-api'].routes.push({
    method: 'PUT',
    path: '/users/me',
    handler: 'user.updateMe',
    config: {
      auth: true,            // JWT required
      policies: [],          // no extra policies needed
      middlewares: [],
    },
  });

  // 2) Controller
  const ctrl = plugin.controllers?.user || {};
  ctrl.updateMe = async (ctx: any) => {
    const authUser = ctx.state.user;
    if (!authUser) return ctx.unauthorized();

    const body = ctx.request.body || {};

    // Only allow these fields to be updated by the end user
    const ALLOWED_FIELDS = [
      'jobPrefs',
      'preferredName',
      'university',
      'studyField',
      'course',
      'weeklyGoal',
      'plan',
      'packages',
      'addons',
      'keyStats',
    ];

    const data: Record<string, any> = {};
    for (const k of ALLOWED_FIELDS) {
      if (Object.prototype.hasOwnProperty.call(body, k)) data[k] = body[k];
    }

    try {
      const updated = await strapi.entityService.update(
        'plugin::users-permissions.user',
        authUser.id,
        { data }
      );

      // Keep the response tiny; frontend only needs success
      ctx.body = { ok: true, id: updated.id };
    } catch (err) {
      strapi.log.error('updateMe failed', err);
      ctx.throw(400, 'Failed to update profile');
    }
  };

  plugin.controllers.user = { ...(plugin.controllers?.user || {}), ...ctrl };
  return plugin;
};
