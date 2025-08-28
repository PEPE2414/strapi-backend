// src/api/profile/controllers/profile.ts
export default ({ strapi }: { strapi: any }) => ({
  async updateProfile(ctx: any) {
    try {
      // Manually verify the Bearer token (so we don't depend on role UI toggles)
      const auth = ctx.request?.header?.authorization || '';
      const m = auth.match(/^Bearer\s+(.+)$/i);
      if (!m) return ctx.unauthorized('Missing Authorization');

      const payload = await strapi
        .service('plugin::users-permissions.jwt')
        .verify(m[1]);

      const userId = payload?.id;
      if (!userId) return ctx.unauthorized('Invalid token');

      // Accept only allowed profile fields
      const body = (ctx.request.body && ctx.request.body.data) || {};
      const allowed = ['preferredName', 'university', 'course', 'studyField', 'keyStats'];
      const data: Record<string, any> = {};
      for (const k of allowed) if (body[k] !== undefined) data[k] = body[k];

      const updated = await strapi.entityService.update(
        'plugin::users-permissions.user',
        userId,
        { data }
      );

      ctx.body = updated; // entityService output is sanitized
    } catch (e) {
      ctx.throw(500, 'Profile update failed');
    }
  },
});
