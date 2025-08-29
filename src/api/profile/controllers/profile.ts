// src/api/profile/controllers/profile.ts
export default ({ strapi }: { strapi: any }) => ({
  async updateProfile(ctx: any) {
    try {
      // 1) Verify Bearer token (route is public; we self-auth here)
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
      for (const k of allowed) if (body[k] !== undefined) data[k] = body[k];

      // 3) Normalise types
      ['preferredName', 'university', 'course', 'studyField'].forEach((k) => {
        if (typeof data[k] === 'string') data[k] = data[k].trim();
      });

      // keyStats must be valid JSON for PG json/jsonb
      if (data.keyStats !== undefined) {
        if (typeof data.keyStats === 'string') {
          const s = data.keyStats.trim();
          // If it looks like JSON, try to parse; otherwise wrap as an object
          if ((s.startsWith('{') && s.endsWith('}')) || (s.startsWith('[') && s.endsWith(']'))) {
            try {
              data.keyStats = JSON.parse(s);
            } catch {
              data.keyStats = { notes: s }; // fallback to JSON object
            }
          } else if (s.length) {
            data.keyStats = { notes: s };   // wrap free text
          } else {
            data.keyStats = null;           // allow clearing
          }
        }
      }

      // 4) Try entityService first
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

      // 5) Low-level fallback
      try {
        const updated = await strapi.db
          .query('plugin::users-permissions.user')
          .update({ where: { id: userId }, data });
        ctx.body = updated;
        return;
      } catch (err: any) {
        console.error('[profile:update] db.query update failed:', err?.message || err);
        return ctx.badRequest('Could not update profile');
      }
    } catch (e: any) {
      console.error('[profile:update] unexpected error:', e?.message || e);
      ctx.throw(500, 'Profile update failed');
    }
  },
});
