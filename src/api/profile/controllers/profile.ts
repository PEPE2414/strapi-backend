// src/api/profile/controllers/profile.ts
import { errors } from '@strapi/utils';
const { UnauthorizedError, ValidationError } = errors;

const sanitizeFile = (f: any) => {
  if (!f) return null;
  return {
    id: f.id,
    name: f.name,
    size: f.size,   // bytes
    ext: f.ext,
    mime: f.mime,
    url: f.url,
    updatedAt: f.updatedAt,
  };
};

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
      const allowed = ['preferredName', 'university', 'course', 'studyField', 'keyStats', 'coverLetterPoints'];
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
          if ((s.startsWith('{') && s.endsWith('}')) || (s.startsWith('[') && s.endsWith(']'))) {
            try {
              data.keyStats = JSON.parse(s);
            } catch {
              data.keyStats = { notes: s };
            }
          } else if (s.length) {
            data.keyStats = { notes: s };
          } else {
            data.keyStats = null;
          }
        }
      }

      // coverLetterPoints: coerce to array of strings
      if (data.coverLetterPoints !== undefined) {
        const v = data.coverLetterPoints;
        if (Array.isArray(v)) {
          data.coverLetterPoints = v
            .map(x => (typeof x === 'string' ? x.trim() : ''))
            .filter(Boolean);
        } else if (typeof v === 'string' && v.trim()) {
          data.coverLetterPoints = [v.trim()];
        } else {
          data.coverLetterPoints = [];
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

  // ====== NEW: get current CV ======
  async getCv(ctx: any) {
    const user = ctx.state.user;
    if (!user) throw new UnauthorizedError();

    const me = await strapi.entityService.findOne('plugin::users-permissions.user', user.id, {
      populate: { cvFile: true },
    });

    ctx.body = { data: sanitizeFile(me?.cvFile) };
  },

  // ====== NEW: set/replace current CV (expects { fileId }) ======
  async setCv(ctx: any) {
    const user = ctx.state.user;
    if (!user) throw new UnauthorizedError();

    const { fileId } = ctx.request.body || {};
    if (!fileId) throw new ValidationError('Missing fileId');

    // Verify the file exists
    const file = await strapi.entityService.findOne('plugin::upload.file', fileId);
    if (!file) throw new ValidationError('File not found');

    // Get previous CV (if any)
    const me = await strapi.entityService.findOne('plugin::users-permissions.user', user.id, {
      populate: { cvFile: true },
    });
    const prev = me?.cvFile;

    // Attach the new file
    await strapi.entityService.update('plugin::users-permissions.user', user.id, {
      data: { cvFile: fileId },
    });

    // Try to remove the old one (only if different id)
    if (prev && prev.id !== fileId) {
      try {
        const uploadService = strapi.plugin('upload').service('upload');
        await uploadService.remove(prev);
      } catch (e) {
        // ignore clean-up failure
      }
    }

    ctx.body = { data: sanitizeFile(file) };
  },
});
