import type { Core } from '@strapi/strapi';

export default ({ strapi }: { strapi: Core.Strapi }) => ({
  async exists(ctx) {
    const emailRaw = ctx.query.email;
    const email = typeof emailRaw === 'string' ? emailRaw.toLowerCase().trim() : '';
    if (!email) return ctx.badRequest('email is required');

    const user = await strapi.query('plugin::users-permissions.user').findOne({
      where: { email },
      select: ['id'],
    });

    ctx.send({ exists: !!user });
  },
});
