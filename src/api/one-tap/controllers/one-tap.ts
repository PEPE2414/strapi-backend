import type { Core } from '@strapi/strapi';
import { OAuth2Client } from 'google-auth-library';

const audienceFromEnv = () => {
  const single = process.env.GOOGLE_CLIENT_ID;
  const multi = process.env.GOOGLE_CLIENT_IDS; // optional CSV if you ever add more
  if (multi) return multi.split(',').map((s) => s.trim()).filter(Boolean);
  return single ? [single] : [];
};

export default ({ strapi }: { strapi: Core.Strapi }) => ({
  async login(ctx) {
    try {
      const { credential } = ctx.request.body as { credential?: string };
      if (!credential) return ctx.badRequest('Missing credential');

      const audience = audienceFromEnv();
      if (!audience.length) return ctx.internalServerError('Missing GOOGLE_CLIENT_ID');

      const client = new OAuth2Client();
      const ticket = await client.verifyIdToken({ idToken: credential, audience });
      const payload = ticket.getPayload();
      if (!payload || !payload.email) return ctx.unauthorized('Invalid Google token');

      const email = payload.email.toLowerCase();
      const username = (payload.name || email.split('@')[0]).trim();
      const provider = 'google';

      // Find or create the user
      let user = await strapi.query('plugin::users-permissions.user').findOne({
        where: { email },
      });

      if (!user) {
        user = await strapi.entityService.create('plugin::users-permissions.user', {
          data: {
            username,
            email,
            provider,
            confirmed: true,   // mark confirmed (you already trust Google)
            blocked: false,
          },
        });
      } else if (user.blocked) {
        return ctx.forbidden('User is blocked');
      }

      // Issue Strapi JWT
      const jwt = await strapi.service('plugin::users-permissions.jwt').issue({ id: user.id });

      ctx.send({ jwt, user });
    } catch (err) {
      strapi.log.error('One Tap login failed', err);
      ctx.internalServerError('One Tap login failed');
    }
  },
});
