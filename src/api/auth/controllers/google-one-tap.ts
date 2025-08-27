// src/api/auth/controllers/google-one-tap.ts
import { OAuth2Client } from 'google-auth-library';

const CLIENT_IDS = (
  process.env.GOOGLE_CLIENT_IDS ||
  process.env.GOOGLE_CLIENT_ID ||
  ''
)
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

const googleClient = new OAuth2Client();

async function verifyGoogle(credential: string): Promise<any | null> {
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

export default ({ strapi }: { strapi: any }) => ({
  async googleOneTap(ctx: any) {
    try {
      // 0) Basic config sanity
      if (!CLIENT_IDS.length) {
        return ctx.internalServerError('GOOGLE_CLIENT_ID not configured on server');
      }

      // 1) Input
      const { credential } = (ctx.request.body || {}) as { credential?: string };
      if (!credential) return ctx.badRequest('Missing credential');

      // 2) Verify Google token
      const payload = await verifyGoogle(credential);
      if (!payload) return ctx.unauthorized('Invalid Google token');

      const email = String(payload.email || '').toLowerCase();
      if (!email) return ctx.badRequest('Google token missing email');

      const username = (payload.given_name || payload.name || email.split('@')[0]).slice(0, 30);

      // 3) Default "authenticated" role (via entityService to avoid low-level pitfalls)
      const roles = await strapi.entityService.findMany('plugin::users-permissions.role', {
        filters: { type: 'authenticated' },
        limit: 1,
      });
      const defaultRole = Array.isArray(roles) ? roles[0] : roles;
      if (!defaultRole?.id) return ctx.internalServerError('Missing authenticated role');

      // 4) Find existing user by email
      const found = await strapi.entityService.findMany('plugin::users-permissions.user', {
        filters: { email },
        limit: 1,
      });
      let user = Array.isArray(found) ? found[0] : found;

      if (!user) {
        // 5) Create new user with role + confirmed
        user = await strapi.entityService.create('plugin::users-permissions.user', {
          data: {
            email,
            username,
            provider: 'google',
            confirmed: true,
            blocked: false,
            role: defaultRole.id, // works with entityService
          },
        });
      } else {
        if (user.blocked) return ctx.forbidden('User is blocked');

        const patch: Record<string, any> = {};
        if (!user.role) patch.role = defaultRole.id;
        if (!user.confirmed) patch.confirmed = true;

        if (Object.keys(patch).length) {
          user = await strapi.entityService.update('plugin::users-permissions.user', user.id, {
            data: patch,
          });
        }
      }

      // 6) Issue JWT
      const jwt = await strapi.service('plugin::users-permissions.jwt').issue({ id: user.id });

      // 7) Return (entityService already sanitizes output)
      ctx.body = { jwt, user };
    } catch (err: any) {
      // Log the real error once so we can see root cause if any remains
      console.error('[google-one-tap] error:', err?.message || err);
      ctx.throw(500, 'One Tap failed');
    }
  },
});
