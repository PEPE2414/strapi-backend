// src/api/profile/controllers/profile.ts
export default ({ strapi }: { strapi: any }) => ({
  async updateProfile(ctx: any) {
    // We verify the JWT ourselves so the route can be public at router level.
    try {
      // 1) Verify Bearer token
      const auth = ctx.request?.header?.authorization || '';
      const m = auth.match(/^Bearer\s+(.+)$/i);
      if (!m) return ctx.unauthorized('Missing Authorization');

      let payload: any;
      try {
        payload = await strapi.service('plugin::users-permissions.jwt').verify(m[1]);
      } catch (e) {
        console.error('[profile:update] JWT verify failed:', e);
        return ctx.unauthorized('Invalid token');
      }

      const userId = payload?.id;
      if (!userId) return ctx.unauthorized('Invalid token payload');

      // 2) Whitelist allowed fields
      const body = (ctx.request.body && ctx.request.body.data) || {};
      const allowed = ['preferredName', 'university', 'course', 'studyField', 'keyStats'];
      const data: Record<string, any> = {};
      for (const k of allowed) {
        if (body[k] !== undefined) data[k] = body[k];
      }

      // Optional: trim simple strings
      ['preferredName', 'university', 'course', 'studyField'].forEach((k) => {
        if (typeof data[k] === 'string') data[k] = data[k].trim();
      });

      // If keyStats is a string that looks like JSON, try to parse (but it's fine to store a string in JSON field too)
      if (typeof data.keyStats === 'string') {
        const s = data.keyStats.trim();
        if ((s.startsWith('{') && s.endsWith('}')) || (s.startsWith('[') && s.endsWith(']'))) {
          try { data.keyStats = JSON.parse(s); } catch {/* leave as string */}
        }
      }

      // 3) Try with entityService first (preferred)
      try {
        const updated = await strapi.entityService.update(
          'plugin::users-permissions.user',
          userId,
          { data }
        );
        ctx.body = updated;
        return;
      } catch (err: any) {
        console.error('[profile:update] entityService.update failed:', err?.message || err);
      }

      // 4) Fallback to low-level query (bypasses strict validations)
      try {
        const updated = await strapi.db
          .query('plugin::users-permissions.user')
          .update({ where: { id: userId }, data });
        ctx.body = updated;
        return;
      } catch (err: any) {
        console.error('[profile:update] db.query update failed:', err?.message || err);
        // Surface a readable error back to the client instead of masking as 500
        return ctx.badRequest('Could not update profile');
      }
    } catch (e: any) {
      console.error('[profile:update] unexpected error:', e?.message || e);
      // As a last resort
      ctx.throw(500, 'Profile update failed');
    }
  },
});
