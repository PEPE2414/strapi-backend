// backend/src/api/account/controllers/account.ts
/* Strapi v5 custom controller for updating the current user's jobPrefs.
   Reads JWT from Authorization header, verifies it with the users-permissions plugin,
   then updates plugin::users-permissions.user with the provided jobPrefs JSON. */

type JWTPayload = { id?: number; sub?: number };

export default {
  async updateMe(ctx) {
    // 1) Extract bearer token
    const auth = ctx.request.header.authorization || '';
    const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;
    if (!token) {
      return ctx.unauthorized('Missing Authorization header');
    }

    // 2) Verify via users-permissions JWT service
    let payload: JWTPayload | undefined;
    try {
      const jwtService = (strapi as any).plugin('users-permissions').service('jwt');
      payload = await jwtService.verify(token);
    } catch {
      return ctx.unauthorized('Invalid token');
    }

    const userId = payload?.id ?? payload?.sub;
    if (!userId) {
      return ctx.unauthorized('Invalid token payload');
    }

    // 3) Validate input
    const body = ctx.request.body || {};
    const { jobPrefs } = body;
    if (jobPrefs !== undefined && typeof jobPrefs !== 'object') {
      return ctx.badRequest('jobPrefs must be an object');
    }

    // 4) Update only jobPrefs on the authenticated user
    try {
      const updated = await (strapi as any).entityService.update(
        'plugin::users-permissions.user',
        userId,
        { data: { jobPrefs } }
      );

      // (Return minimal fields if you prefer)
      ctx.body = {
        ok: true,
        user: {
          id: updated.id,
          username: updated.username,
          email: updated.email,
          jobPrefs: updated.jobPrefs ?? null,
        },
      };
    } catch (err) {
      (strapi as any).log.error('updateMe error', err);
      ctx.throw(500, 'Failed to update preferences');
    }
  },
};
