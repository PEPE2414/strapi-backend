// /src/extensions/users-permissions/strapi-server.ts
// Adds PUT /api/users/me for authenticated users to update whitelisted fields (incl jobPrefs).

export default (plugin: any) => {
  // Ensure the routes container exists
  if (!plugin.routes) plugin.routes = {};
  if (!plugin.routes['content-api']) plugin.routes['content-api'] = { type: 'content-api', routes: [] };
  if (!Array.isArray(plugin.routes['content-api'].routes)) plugin.routes['content-api'].routes = [];

  // Register route
  plugin.routes['content-api'].routes.push({
    method: 'PUT',
    path: '/users/me',
    handler: 'user.updateMe',
    config: {
      auth: true,           // JWT required
      policies: [],
      middlewares: [],
    },
  });

  // Controller: extend/define user.updateMe
  const existingUserCtrl = plugin.controllers?.user || {};
  const userCtrl = { ...existingUserCtrl };

  userCtrl.updateMe = async (ctx: any) => {
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
      ctx.body = { ok: true, id: updated.id };
    } catch (err) {
      strapi.log.error('users-permissions:updateMe failed', err);
      ctx.throw(400, 'Failed to update profile');
    }
  };

  // Reassign controllers object with our override
  plugin.controllers = { ...(plugin.controllers || {}), user: userCtrl };

  return plugin;
};
