// src/api/auth/controllers/exists.ts
export default ({ strapi }: { strapi: any }) => ({
  async exists(ctx: any) {
    const raw = (ctx.query?.email || '').toString();
    const email = raw.trim().toLowerCase();
    if (!email) return ctx.badRequest('email is required');

    // case-insensitive email check
    const found = await strapi.entityService.findMany(
      'plugin::users-permissions.user',
      {
        filters: { email: { $eqi: email } },
        fields: ['id'],
        limit: 1,
      }
    );

    const exists =
      Array.isArray(found) ? found.length > 0 : Boolean(found?.id);
    ctx.body = { exists };
  },
});
