// src/api/profile/controllers/profile.ts
export default ({ strapi }: { strapi: any }) => ({
  async updateProfile(ctx: any) {
    const userId = ctx.state.user?.id;
    if (!userId) return ctx.unauthorized('Not authenticated');

    // Accept only allowed fields from body.data
    const payload = (ctx.request.body && ctx.request.body.data) || {};
    const data: Record<string, any> = {};
    const allowed = ['preferredName', 'university', 'course', 'studyField', 'keyStats'];

    for (const k of allowed) {
      if (payload[k] !== undefined) data[k] = payload[k];
    }

    const updated = await strapi.entityService.update('plugin::users-permissions.user', userId, { data });
    ctx.body = updated; // entityService output is already sanitized
  },
});
