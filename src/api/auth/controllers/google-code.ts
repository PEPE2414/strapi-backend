// src/api/auth/controllers/google-code.ts
import { OAuth2Client } from 'google-auth-library';

const CLIENT_ID = (process.env.GOOGLE_CLIENT_ID || '').trim();
const CLIENT_SECRET = (process.env.GOOGLE_CLIENT_SECRET || '').trim();

// OAuth2Client with 'postmessage' for popup flow
const oauth2 = new OAuth2Client({
  clientId: CLIENT_ID,
  clientSecret: CLIENT_SECRET,
  redirectUri: 'postmessage',
});

export default ({ strapi }: { strapi: any }) => ({
  async googleCode(ctx: any) {
    try {
      const code = ctx.request.body?.code;
      if (!code) return ctx.badRequest('Missing code');
      if (!CLIENT_ID || !CLIENT_SECRET) {
        return ctx.internalServerError('Google client credentials not configured');
      }

      // Exchange code → tokens (contains id_token)
      const { tokens } = await oauth2.getToken(code);
      const idToken = tokens.id_token;
      if (!idToken) return ctx.unauthorized('No id_token from Google');

      // Verify id_token
      const ticket = await oauth2.verifyIdToken({ idToken, audience: CLIENT_ID });
      const payload = ticket.getPayload();
      const email = String(payload?.email || '').toLowerCase();
      if (!email) return ctx.badRequest('Google token missing email');

      const username = (payload?.given_name || payload?.name || email.split('@')[0]).slice(0, 30);

      // Default "authenticated" role
      const roles = await strapi.entityService.findMany('plugin::users-permissions.role', {
        filters: { type: 'authenticated' },
        limit: 1,
      });
      const defaultRole = Array.isArray(roles) ? roles[0] : roles;
      if (!defaultRole?.id) return ctx.internalServerError('Missing authenticated role');

      // Find/create user
      const found = await strapi.entityService.findMany('plugin::users-permissions.user', {
        filters: { email },
        limit: 1,
      });
      let user = Array.isArray(found) ? found[0] : found;

      if (!user) {
        user = await strapi.entityService.create('plugin::users-permissions.user', {
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

      // Issue JWT
      const jwt = await strapi.service('plugin::users-permissions.jwt').issue({ id: user.id });

      ctx.body = { jwt, user };
    } catch (err) {
      console.error('[google-code] error:', err?.message || err);
      ctx.throw(500, 'Google OAuth code exchange failed');
    }
  },
});
