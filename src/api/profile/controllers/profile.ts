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

export default {
  async test(ctx) {
    console.log('[profile:test] Test endpoint called');
    ctx.body = { message: 'Profile controller is working' };
  },

  async getProfile(ctx) {
    try {
      console.log('[profile:get] Starting getProfile request');
      
      // 1) Extract bearer token
      const auth = ctx.request?.header?.authorization || '';
      console.log('[profile:get] Authorization header:', auth ? 'Present' : 'Missing');
      
      const m = auth.match(/^Bearer\s+(.+)$/i);
      if (!m) {
        console.log('[profile:get] No token found');
        return ctx.unauthorized('Missing Authorization');
      }
      const token = m[1];

      // 2) Verify via users-permissions JWT service
      let payload: any;
      try {
        payload = await strapi.service('plugin::users-permissions.jwt').verify(token);
        console.log('[profile:get] JWT verified successfully, payload:', payload);
      } catch (error) {
        console.log('[profile:get] JWT verification failed:', error);
        return ctx.unauthorized('Invalid token');
      }

      const userId = payload?.id;
      if (!userId) {
        console.log('[profile:get] No user ID in payload');
        return ctx.unauthorized('Invalid token payload');
      }
      
      console.log('[profile:get] User ID:', userId);

      const user = await strapi.entityService.findOne('plugin::users-permissions.user', userId, {
        populate: '*'
      });

      if (!user) return ctx.notFound('User not found');

      console.log('[profile:get] User found:', user.id);
      console.log('[profile:get] User notificationPrefs:', user.notificationPrefs);
      console.log('[profile:get] User notificationPrefs type:', typeof user.notificationPrefs);

      ctx.body = user;
    } catch (e: any) {
      console.error('[profile:get] unexpected error:', e?.message || e);
      ctx.throw(500, 'Internal server error');
    }
  },

  async updateProfile(ctx) {
    try {
      // 1) Verify Bearer token (route is public; we self-auth here)
      const auth = ctx.request?.header?.authorization || '';
      const m = auth.match(/^Bearer\s+(.+)$/i);
      if (!m) return ctx.unauthorized('Missing Authorization');

      let payload: any;
      try {
        payload = await strapi.service('plugin::users-permissions.jwt').verify(m[1]);
      } catch (e: any) {
        console.error('[profile:update] JWT verify failed:', e);
        return ctx.unauthorized('Invalid token');
      }
      const userId = payload?.id;
      if (!userId) return ctx.unauthorized('Invalid token payload');

      // 2) Whitelist allowed fields
      const body = (ctx.request.body && ctx.request.body.data) || {};
      const allowed = ['preferredName', 'university', 'course', 'studyField', 'keyStats', 'coverLetterPoints', 'weeklyGoal', 'notificationPrefs', 'deadlineCheckboxes', 'deadlineTodos', 'skippedPastApps'];
      const data: Record<string, any> = {};
      for (const k of allowed) if (body[k] !== undefined) data[k] = body[k];

      // 3) Normalise types
      ['preferredName', 'university', 'course', 'studyField'].forEach((k) => {
        if (typeof data[k] === 'string') data[k] = data[k].trim();
      });

      // Validate weeklyGoal (must be a positive integer between 1 and 30)
      if (data.weeklyGoal !== undefined) {
        const goal = Number(data.weeklyGoal);
        if (!Number.isInteger(goal) || goal < 1 || goal > 30) {
          return ctx.badRequest('weeklyGoal must be an integer between 1 and 30');
        }
        data.weeklyGoal = goal;
      }

      // Validate notificationPrefs (must be an object)
      if (data.notificationPrefs !== undefined) {
        console.log('[profile:update] notificationPrefs received:', data.notificationPrefs);
        if (typeof data.notificationPrefs !== 'object' || data.notificationPrefs === null) {
          return ctx.badRequest('notificationPrefs must be an object');
        }
        // Ensure it's a valid JSON object
        try {
          data.notificationPrefs = JSON.parse(JSON.stringify(data.notificationPrefs));
          console.log('[profile:update] notificationPrefs processed:', data.notificationPrefs);
        } catch (e: any) {
          return ctx.badRequest('notificationPrefs must be a valid JSON object');
        }
      }

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

      // Validate deadlineCheckboxes (must be an object)
      if (data.deadlineCheckboxes !== undefined) {
        if (typeof data.deadlineCheckboxes !== 'object' || data.deadlineCheckboxes === null) {
          return ctx.badRequest('deadlineCheckboxes must be an object');
        }
        try {
          data.deadlineCheckboxes = JSON.parse(JSON.stringify(data.deadlineCheckboxes));
        } catch (e: any) {
          return ctx.badRequest('deadlineCheckboxes must be a valid JSON object');
        }
      }

      // Validate deadlineTodos (must be an object)
      if (data.deadlineTodos !== undefined) {
        if (typeof data.deadlineTodos !== 'object' || data.deadlineTodos === null) {
          return ctx.badRequest('deadlineTodos must be an object');
        }
        try {
          data.deadlineTodos = JSON.parse(JSON.stringify(data.deadlineTodos));
        } catch (e: any) {
          return ctx.badRequest('deadlineTodos must be a valid JSON object');
        }
      }
                  
      // 4) Try entityService first
      try {
        console.log('[profile:update] Updating user with data:', data);
        const updated = await strapi.entityService.update(
          'plugin::users-permissions.user',
          userId,
          { data }
        );
        console.log('[profile:update] User updated successfully:', updated);
        console.log('[profile:update] Updated user notificationPrefs:', updated.notificationPrefs);
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

   // ====== Get current CV (no extraction here) ======
  async getCv(ctx) {
    try {
      const auth = ctx.request?.header?.authorization || '';
      const m = auth.match(/^Bearer\s+(.+)$/i);
      if (!m) return ctx.unauthorized('Missing Authorization');
  
      let payload: any;
      try {
        payload = await strapi.service('plugin::users-permissions.jwt').verify(m[1]);
      } catch (e: any) {
        console.error('[profile:getCv] JWT verify failed:', e);
        return ctx.unauthorized('Invalid token');
      }
      const userId = payload?.id;
      if (!userId) return ctx.unauthorized('Invalid token payload');
  
      const me = await strapi.entityService.findOne('plugin::users-permissions.user', userId, {
        populate: { cvFile: true },
      });
  
      ctx.body = { data: sanitizeFile(me?.cvFile) };
    } catch (e: any) {
      console.error('[profile:getCv] unexpected error:', e?.message || e);
      ctx.throw(500, 'Fetch CV failed');
    }
  },

  async linkCv(ctx) {
    try {
      // 0) Verify Bearer token (route is public; we self-auth here)
      const auth = ctx.request?.header?.authorization || '';
      const m = auth.match(/^Bearer\s+(.+)$/i);
      if (!m) return ctx.unauthorized('Missing Authorization');

      let payload: any;
      try {
        payload = await strapi.service('plugin::users-permissions.jwt').verify(m[1]);
      } catch (e: any) {
        console.error('[profile:cv] JWT verify failed:', e);
        return ctx.unauthorized('Invalid token');
      }
      const userId = payload?.id;
      if (!userId) return ctx.unauthorized('Invalid token payload');

      // 1) Validate input and load file from Upload plugin
      const body = ctx.request.body || {};
      const fileId = Number(body?.fileId);
      if (!fileId) return ctx.badRequest('fileId is required');

      const f = await strapi.entityService.findOne('plugin::upload.file', fileId);
      if (!f) return ctx.badRequest('fileId not found');

      // 2) Enforce allowed MIME types (PDF/DOCX/older DOC optional)
      const mime = String(f.mime || '').toLowerCase();
      const ext = String(f.ext || '').toLowerCase();
      const ok =
        mime === 'application/pdf' ||
        mime === 'application/msword' ||
        mime === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
        ext === '.pdf' || ext === '.doc' || ext === '.docx';
      if (!ok) {
        return ctx.badRequest('Unsupported CV type. Please upload a PDF or Word document.');
      }

      // 3) Link the uploaded file to the user (user.cvFile = fileId)
      try {
        await strapi.entityService.update('plugin::users-permissions.user', userId, {
          data: { cvFile: fileId },
        });
      } catch (err: any) {
        console.warn('[profile:cv] entityService.update failed, using db.query():', err?.message || err);
        await strapi.db
          .query('plugin::users-permissions.user')
          .update({ where: { id: userId }, data: { cvFile: fileId } });
      }

      // 4) Extract text and store on user.cvText (S3-first; robust key)
      try {
        // 4a) Read bytes from S3 (provider key) or fall back to HTTP
        let buf: Buffer | null = null;
        try {
          const { S3Client, GetObjectCommand } = await import('@aws-sdk/client-s3');
          const region = process.env.S3_REGION;
          const bucket = process.env.S3_BUCKET;
          if (!region || !bucket) throw new Error('missing_s3_env');

          const keyFromProvider = (f as any)?.provider_metadata?.key as string | undefined;

          let key = keyFromProvider;
          if (!key) {
            const url = String(f.url || '');
            if (!url) throw new Error('no_file_url');
            const path =
              url.startsWith('http://') || url.startsWith('https://')
                ? new URL(url).pathname
                : url;
            key = path.replace(/^\/+/, '');
          }

          const s3 = new S3Client({
            region,
            credentials: {
              accessKeyId: process.env.S3_ACCESS_KEY_ID || '',
              secretAccessKey: process.env.S3_SECRET_ACCESS_KEY || '',
            },
          });
          const out = await s3.send(new GetObjectCommand({ Bucket: bucket, Key: key! }));
          // @ts-ignore Node 18+ helper
          const bytes = await out.Body?.transformToByteArray();
          if (!bytes) throw new Error('no_body');
          buf = Buffer.from(bytes);
        } catch (e: any) {
          strapi.log.warn('[profile:cv] S3 GetObject failed, falling back to HTTP: ' + (e as any)?.message);
        }

        if (!buf) {
          const url = String(f.url || '');
          if (!url.startsWith('http')) throw new Error('no_absolute_url_for_http_fetch');
          const res = await fetch(url);
          const ab = await res.arrayBuffer();
          buf = Buffer.from(ab);
        }

        // 4b) Parse text (PDF or DOCX). Leave others empty for now.
        let cvText = '';
        try {
          if (ext === '.pdf' || mime === 'application/pdf' || mime === 'application/x-pdf') {
            const pdfMod = await import('pdf-parse');
            const pdfParse: any = (pdfMod as any).default || (pdfMod as any);
            const out = await pdfParse(buf);
            cvText = (out?.text || '').trim();
          } else if (ext === '.docx' || mime === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
            const mmMod = await import('mammoth');
            const mammoth: any = (mmMod as any).default || (mmMod as any);
            const out = await mammoth.extractRawText({ buffer: buf });
            cvText = (out?.value || '').trim();
          } else {
            // .doc or other types – you can add an extractor later
            cvText = '';
          }
        } catch (e: any) {
          strapi.log.warn('[profile:cv] extractor error: ' + (e as any)?.message);
          cvText = '';
        }

        strapi.log.info(`[profile:cv] extracted ${cvText.length} chars from ${f.mime} (size=${buf.length})`);

        // 4c) Save cvText (entityService, then fallback), then read back & log
        try {
          await strapi.entityService.update('plugin::users-permissions.user', userId, { data: { cvText } });
        } catch (e: any) {
          strapi.log.warn('[profile:cv] entityService.update(cvText) failed, using db.query(): ' + (e as any)?.message);
          await strapi.db
            .query('plugin::users-permissions.user')
            .update({ where: { id: userId }, data: { cvText } });
        }

        const check = await strapi.entityService.findOne(
          'plugin::users-permissions.user',
          userId,
          { fields: ['id', 'cvText'] }
        );
        strapi.log.info(`[profile:cv] saved cvText length: ${check?.cvText ? String(check.cvText).length : 0}`);
      } catch (ex) {
        strapi.log.warn('[profile:cv] CV text extraction failed: ' + (ex as any)?.message);
      }

      // 5) Return minimal file payload for the FE
      ctx.body = {
        data: {
          id: f.id,
          name: f.name,
          url: f.url,
          size: f.size,
          updatedAt: f.updatedAt,
        },
      };
    } catch (e: any) {
      console.error('[profile:cv] unexpected error:', e?.message || e);
      ctx.throw(500, 'CV link failed');
    }
  },
  
  // ====== NEW: set/replace current CV (expects { fileId }) ======
  async setCv(ctx) {
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
      } catch (e: any) {
        // ignore clean-up failure
      }
    }

    ctx.body = { data: sanitizeFile(file) };
  },
};
