// src/api/auth/controllers/google-one-tap.ts
import type { Context } from 'koa';
import { OAuth2Client, TokenPayload } from 'google-auth-library';

const CLIENT_IDS = (
  process.env.GOOGLE_CLIENT_IDS ||
  process.env.GOOGLE_CLIENT_ID ||
  ''
)
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

const googleClient = new OAuth2Client();

async function verifyGoogle(credential: string): Promise<TokenPayload | null> {
  for (const aud of CLIENT_IDS) {
    try {
      const ticket = await googleClient.verifyIdToken({ idToken: credential, audience: aud });
      const payload = ticket.getPayload();
      if (payload) return payload;
    } catch {
      // try next audience
    }
  }
  return null;
}

export default {
  async googleOneTap(ctx: Context) {
    try {
      const { credential } = ctx.request.body as { credential?: string };
      if (!credential) return ctx.badRequest('Missing credential');

      const payload = await verifyGoogle(credential);
      if (!payload) return ctx.unauthorized('Invalid Google token');

      const email = String(payload.email || '').toLowerCase();
      if (!email) return ctx.badRequest('Google token missing email');

      const username =
        (payload.given_name || payload.name || email.split('@')[0]).slice(0, 30);

      // 1) Get default "authenticated" role
      const defaultRole = await strapi.db
        .query('plugin::users-permissions.role')
        .findOne({ where: { type: 'authenticated' } });

      if (!defaultRole) return ctx.internalServerError('Missing authenticated role');

      // 2) Find existing user by email
      let user = await strapi.db
        .query('plugin::users-permissions.user')
        .findOne({ where: { email } });

      if (!user) {
        // 3) Create new Google user WITH role + confirmed
        user = await strapi.db
          .query('plugin::users-permissions.user')
          .create({
            data: {
              email,
              username,
              provider: 'google',
              confirmed: true,
              blocked: false,
              role: defaultRole.id,
            },
          });
      } else {
        // 4) Ensure existing user has role + confirmed and not blocked
        const patch: any = {};
        if (!user.role) patch.role = defaultRole.id;
        if (!user.confirmed) patch.confirmed = true;
        if (user.blocked) return ctx.forbidden('User is blocked');

        if (Object.keys(patch).length) {
          user = await strapi.db
            .query('plugin::users-permissions.user')
            .update({ where: { id: user.id }, data: patch });
        }
      }

      // 5) Issue JWT
      const jwt = await strapi
        .service('plugin::users-permissions.jwt')
        .issue({ id: user.id });

      // 6) Sanitize user before returning
      const safeUser = await strapi
        .service('plugin::users-permissions.user')
        .sanitizeOutput(user);

      ctx.body = { jwt, user: safeUser };
    } catch (err) {
      ctx.throw(500, 'One Tap failed');
    }
  },
};
