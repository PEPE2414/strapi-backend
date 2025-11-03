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

  async startTrial(ctx) {
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

    try {
      // 3) Get current user to check if they already have a plan or trial
      const user = await (strapi as any).entityService.findOne(
        'plugin::users-permissions.user',
        userId
      );

      // 4) Check if user already has a plan or packages
      if (user.plan && user.plan !== 'none') {
        return ctx.badRequest('You already have an active plan');
      }
      
      // Check if user has any active packages
      const packagesArr = Array.isArray(user.packages) ? user.packages : [];
      if (packagesArr.length > 0) {
        return ctx.badRequest('You already have an active plan');
      }

      // 5) Check if user already has an active trial
      if (user.trialActive && user.trialEndsAt) {
        const trialEndsAt = new Date(user.trialEndsAt);
        const now = new Date();
        if (trialEndsAt > now) {
          return ctx.badRequest('You already have an active trial');
        }
      }

      // 6) Start new trial: 14 days from now
      const trialEndsAt = new Date();
      trialEndsAt.setDate(trialEndsAt.getDate() + 14);

      const updated = await (strapi as any).entityService.update(
        'plugin::users-permissions.user',
        userId,
        {
          data: {
            trialActive: true,
            trialEndsAt: trialEndsAt.toISOString(),
            trialLimits: {
              coverLetters: 10,
              recruiterLookups: 10,
              savedJobs: 20
            }
          }
        }
      );

      ctx.body = {
        ok: true,
        user: {
          id: updated.id,
          trialActive: updated.trialActive,
          trialEndsAt: updated.trialEndsAt,
          trialLimits: updated.trialLimits,
        },
      };
    } catch (err) {
      (strapi as any).log.error('startTrial error', err);
      ctx.throw(500, 'Failed to start trial');
    }
  },
};
