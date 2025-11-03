// src/api/profile/controllers/profile.ts
import { errors } from '@strapi/utils';
import { validateStudyField } from '../../../services/studyFieldValidation';
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
      console.log('[profile:get] ctx.state:', ctx.state);
      console.log('[profile:get] ctx.state.user:', ctx.state.user);
      console.log('[profile:get] Authorization header:', ctx.request.header.authorization);
      
      // Manual JWT verification since auth: false bypasses built-in auth
      const authHeader = ctx.request.header.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        console.log('[profile:get] No valid Authorization header');
        return ctx.unauthorized('Authentication required');
      }
      
      const token = authHeader.slice(7);
      let user = null;
      
      try {
        // Use Strapi's JWT service to verify the token
        const jwtService = strapi.plugin('users-permissions').service('jwt');
        user = await jwtService.verify(token);
        console.log('[profile:get] JWT verified, user ID:', user.id);
      } catch (jwtError) {
        console.log('[profile:get] JWT verification failed:', jwtError.message);
        return ctx.unauthorized('Invalid token');
      }
      
      if (!user || !user.id) {
        console.log('[profile:get] No user found in JWT');
        return ctx.unauthorized('Authentication required');
      }

      // Ensure userId is a number
      const userId = Number(user.id);
      
      if (!userId || !Number.isInteger(userId)) {
        console.log(`[profile:get] Invalid user ID: ${user.id} (type: ${typeof user.id})`);
        return ctx.badRequest('Invalid user ID');
      }

      // Get full user data with populated fields
      const fullUser = await strapi.entityService.findOne('plugin::users-permissions.user', userId, {
        populate: '*'
      });

      if (!fullUser) return ctx.notFound('User not found');

      console.log('[profile:get] User found:', fullUser.id);
      console.log('[profile:get] User notificationPrefs:', fullUser.notificationPrefs);
      console.log('[profile:get] User notificationPrefs type:', typeof fullUser.notificationPrefs);

      ctx.body = fullUser;
    } catch (e: any) {
      console.error('[profile:get] unexpected error:', e?.message || e);
      ctx.throw(500, 'Internal server error');
    }
  },

  async updateProfile(ctx) {
    try {
      console.log('[profile:update] Starting updateProfile request');
      console.log('[profile:update] Authorization header:', ctx.request.header.authorization);
      
      // Manual JWT verification (auth: false bypasses built-in auth to avoid permission issues)
      const authHeader = ctx.request.header.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        console.log('[profile:update] No valid Authorization header');
        return ctx.unauthorized('Authentication required');
      }
      
      const token = authHeader.slice(7);
      let user = null;
      
      try {
        const jwtService = strapi.plugin('users-permissions').service('jwt');
        user = await jwtService.verify(token);
        console.log('[profile:update] JWT verified, user ID:', user.id);
      } catch (jwtError: any) {
        console.log('[profile:update] JWT verification failed:', jwtError.message);
        return ctx.unauthorized('Invalid or expired token');
      }
      
      if (!user || !user.id) {
        console.log('[profile:update] No user found in JWT');
        return ctx.unauthorized('Authentication required');
      }
      
      // Ensure userId is a number
      const userId = Number(user.id);
      
      if (!userId || !Number.isInteger(userId)) {
        console.log(`[profile:update] Invalid user ID: ${user.id} (type: ${typeof user.id})`);
        return ctx.badRequest('Invalid user ID');
      }
      
      console.log('[profile:update] Authenticated user ID:', userId);

      // 2) Whitelist allowed fields
      const body = (ctx.request.body && ctx.request.body.data) || {};
      console.log('[profile:update] Request body:', ctx.request.body);
      console.log('[profile:update] Extracted data:', body);
      
      const allowed = ['preferredName', 'fullName', 'university', 'course', 'studyField', 'keyStats', 'coverLetterPoints', 'weeklyGoal', 'notificationPrefs', 'deadlineCheckboxes', 'deadlineTodos', 'skippedPastApps', 'preferences', 'profilePicture', 'avatarChoice'];
      const data: Record<string, any> = {};
      for (const k of allowed) if (body[k] !== undefined) data[k] = body[k];
      console.log('[profile:update] Filtered data:', data);

      // 3) Normalise types
      ['preferredName', 'fullName', 'university', 'course', 'studyField'].forEach((k) => {
        if (typeof data[k] === 'string') data[k] = data[k].trim();
      });

      // Validate and normalize study field
      if (data.studyField !== undefined) {
        const validation = validateStudyField(data.studyField);
        if (!validation.isValid) {
          return ctx.badRequest('Invalid study field value');
        }
        data.studyField = validation.normalizedValue;
        
        if (validation.isLegacy) {
          console.log(`[profile:update] Mapped legacy study field "${data.studyField}" to "${validation.normalizedValue}"`);
        }
      }

      // Validate weeklyGoal (must be a positive integer between 1 and 30)
      if (data.weeklyGoal !== undefined) {
        const goal = Number(data.weeklyGoal);
        if (!Number.isInteger(goal) || goal < 1 || goal > 30) {
          return ctx.badRequest('weeklyGoal must be an integer between 1 and 30');
        }
        data.weeklyGoal = goal;
      }

      // Validate skippedPastApps (must be a boolean)
      if (data.skippedPastApps !== undefined) {
        console.log('[profile:update] skippedPastApps received:', data.skippedPastApps, 'type:', typeof data.skippedPastApps);
        data.skippedPastApps = Boolean(data.skippedPastApps);
        console.log('[profile:update] skippedPastApps processed:', data.skippedPastApps);
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

      // Validate preferences (must be an object with priorities, hardFilters, etc.)
      if (data.preferences !== undefined) {
        console.log('[profile:update] preferences received:', data.preferences);
        if (typeof data.preferences !== 'object' || data.preferences === null) {
          return ctx.badRequest('preferences must be an object');
        }
        try {
          data.preferences = JSON.parse(JSON.stringify(data.preferences));
          console.log('[profile:update] preferences processed:', data.preferences);
        } catch (e: any) {
          return ctx.badRequest('preferences must be a valid JSON object');
        }
      }

      // Validate profilePicture (must be a valid file ID or null)
      if (data.profilePicture !== undefined) {
        console.log('[profile:update] profilePicture received:', data.profilePicture);
        if (data.profilePicture !== null && (!Number.isInteger(data.profilePicture) || data.profilePicture <= 0)) {
          return ctx.badRequest('profilePicture must be a valid file ID or null');
        }
      }

      // Validate avatarChoice (must be a string or null)
      if (data.avatarChoice !== undefined) {
        console.log('[profile:update] avatarChoice received:', data.avatarChoice);
        if (data.avatarChoice !== null && typeof data.avatarChoice !== 'string') {
          return ctx.badRequest('avatarChoice must be a string or null');
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
      console.log('[profile:getCv] Starting getCv request');
      console.log('[profile:getCv] ctx.state.user:', ctx.state.user);
      console.log('[profile:getCv] Authorization header:', ctx.request.header.authorization);
      
      // Manual JWT verification since auth: false bypasses built-in auth
      const authHeader = ctx.request.header.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        console.log('[profile:getCv] No valid Authorization header');
        return ctx.unauthorized('Authentication required');
      }
      
      const token = authHeader.slice(7);
      let user = null;
      
      try {
        // Use Strapi's JWT service to verify the token
        const jwtService = strapi.plugin('users-permissions').service('jwt');
        user = await jwtService.verify(token);
        console.log('[profile:getCv] JWT verified, user ID:', user.id);
      } catch (jwtError) {
        console.log('[profile:getCv] JWT verification failed:', jwtError.message);
        return ctx.unauthorized('Invalid token');
      }
      
      if (!user || !user.id) {
        console.log('[profile:getCv] No user found in JWT');
        return ctx.unauthorized('Authentication required');
      }
      
      // Ensure userId is a number
      const userId = Number(user.id);
      
      if (!userId || !Number.isInteger(userId)) {
        console.log(`[profile:getCv] Invalid user ID: ${user.id} (type: ${typeof user.id})`);
        return ctx.badRequest('Invalid user ID');
      }
  
      const me = await strapi.entityService.findOne('plugin::users-permissions.user', userId, {
        populate: { cvFile: true },
      });
  
      const cvFile = sanitizeFile(me?.cvFile);
      if (cvFile) {
        ctx.body = { hasCv: true, file: cvFile };
      } else {
        ctx.body = { hasCv: false };
      }
    } catch (e: any) {
      console.error('[profile:getCv] unexpected error:', e?.message || e);
      ctx.throw(500, 'Fetch CV failed');
    }
  },

  async linkCv(ctx) {
    try {
      console.log('[profile:linkCv] Starting linkCv request');
      console.log('[profile:linkCv] ctx.state.user:', ctx.state.user);
      console.log('[profile:linkCv] Authorization header:', ctx.request.header.authorization);
      
      // Manual JWT verification since auth: false bypasses built-in auth
      const authHeader = ctx.request.header.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        console.log('[profile:linkCv] No valid Authorization header');
        return ctx.unauthorized('Authentication required');
      }
      
      const token = authHeader.slice(7);
      let user = null;
      
      try {
        // Use Strapi's JWT service to verify the token
        const jwtService = strapi.plugin('users-permissions').service('jwt');
        user = await jwtService.verify(token);
        console.log('[profile:linkCv] JWT verified, user ID:', user.id);
      } catch (jwtError) {
        console.log('[profile:linkCv] JWT verification failed:', jwtError.message);
        return ctx.unauthorized('Invalid token');
      }
      
      if (!user || !user.id) {
        console.log('[profile:linkCv] No user found in JWT');
        return ctx.unauthorized('Authentication required');
      }
      
      // Ensure userId is a number
      const userId = Number(user.id);
      
      if (!userId || !Number.isInteger(userId)) {
        console.log(`[profile:linkCv] Invalid user ID: ${user.id} (type: ${typeof user.id})`);
        return ctx.badRequest('Invalid user ID');
      }

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

        // 4d) Trigger CV analysis asynchronously (non-blocking)
        setImmediate(async () => {
          try {
            const { analyzeCV } = await import('../../../services/cvAnalysisService');
            const analysis = await analyzeCV(cvText);
            if (analysis) {
              // Save analysis directly using strapi from controller context
              try {
                await strapi.entityService.update('plugin::users-permissions.user', userId, {
                  data: { cvAnalysis: analysis }
                });
                strapi.log.info(`[profile:cv] CV analysis completed and saved for user ${userId}`, {
                  skillsCount: analysis.skills.length,
                  experienceLevel: analysis.experienceLevel,
                  industriesCount: analysis.industries.length
                });
              } catch (saveError: any) {
                strapi.log.warn(`[profile:cv] CV analysis completed but failed to save for user ${userId}:`, saveError.message);
              }
            } else {
              strapi.log.info(`[profile:cv] CV analysis skipped for user ${userId}`);
            }
          } catch (analysisError: any) {
            strapi.log.warn(`[profile:cv] CV analysis failed for user ${userId}:`, analysisError.message);
          }
        });
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

  // ====== NEW: Validate text extraction from uploaded file ======
  async validateText(ctx) {
    try {
      console.log('[profile:validateText] Starting validateText request');
      console.log('[profile:validateText] ctx.state.user:', ctx.state.user);
      console.log('[profile:validateText] Authorization header:', ctx.request.header.authorization);
      
      // Manual JWT verification since auth: false bypasses built-in auth
      const authHeader = ctx.request.header.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        console.log('[profile:validateText] No valid Authorization header');
        return ctx.unauthorized('Authentication required');
      }
      
      const token = authHeader.slice(7);
      let user = null;
      
      try {
        // Use Strapi's JWT service to verify the token
        const jwtService = strapi.plugin('users-permissions').service('jwt');
        user = await jwtService.verify(token);
        console.log('[profile:validateText] JWT verified, user ID:', user.id);
      } catch (jwtError) {
        console.log('[profile:validateText] JWT verification failed:', jwtError.message);
        return ctx.unauthorized('Invalid token');
      }
      
      if (!user || !user.id) {
        console.log('[profile:validateText] No user found in JWT');
        return ctx.unauthorized('Authentication required');
      }
      
      // Ensure userId is a number
      const userId = Number(user.id);
      
      if (!userId || !Number.isInteger(userId)) {
        console.log(`[profile:validateText] Invalid user ID: ${user.id} (type: ${typeof user.id})`);
        return ctx.badRequest('Invalid user ID');
      }

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
        return ctx.badRequest('Unsupported file type. Please upload a PDF or Word document.');
      }

      // 3) Extract text and validate
      let hasText = false;
      let extractedText = '';
      
      try {
        // 3a) Read bytes from S3 (provider key) or fall back to HTTP
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
          strapi.log.warn('[profile:validateText] S3 GetObject failed, falling back to HTTP: ' + (e as any)?.message);
        }

        if (!buf) {
          const url = String(f.url || '');
          if (!url.startsWith('http')) throw new Error('no_absolute_url_for_http_fetch');
          const res = await fetch(url);
          const ab = await res.arrayBuffer();
          buf = Buffer.from(ab);
        }

        // 3b) Parse text (PDF or DOCX). Leave others empty for now.
        try {
          if (ext === '.pdf' || mime === 'application/pdf' || mime === 'application/x-pdf') {
            const pdfMod = await import('pdf-parse');
            const pdfParse: any = (pdfMod as any).default || (pdfMod as any);
            const out = await pdfParse(buf);
            extractedText = (out?.text || '').trim();
          } else if (ext === '.docx' || mime === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
            const mmMod = await import('mammoth');
            const mammoth: any = (mmMod as any).default || (mmMod as any);
            const out = await mammoth.extractRawText({ buffer: buf });
            extractedText = (out?.value || '').trim();
          } else {
            // .doc or other types – you can add an extractor later
            extractedText = '';
          }
        } catch (e: any) {
          strapi.log.warn('[profile:validateText] extractor error: ' + (e as any)?.message);
          extractedText = '';
        }

        // 3c) Check if text was successfully extracted
        hasText = extractedText.length > 0;
        
        strapi.log.info(`[profile:validateText] extracted ${extractedText.length} chars from ${f.mime} (size=${buf.length}), hasText=${hasText}`);

      } catch (ex) {
        strapi.log.warn('[profile:validateText] Text extraction failed: ' + (ex as any)?.message);
        hasText = false;
      }

      // 4) Return validation result
      ctx.body = {
        hasText,
        extractedTextLength: extractedText.length,
        fileId: f.id,
        fileName: f.name,
        fileSize: f.size,
      };
    } catch (e: any) {
      console.error('[profile:validateText] unexpected error:', e?.message || e);
      ctx.throw(500, 'Text validation failed');
    }
  },

  // ====== NEW: Add previous cover letter file ======
  async addPreviousCoverLetter(ctx) {
    try {
      console.log('[profile:addPreviousCoverLetter] Starting request');
      
      // Manual JWT verification
      const authHeader = ctx.request.header.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return ctx.unauthorized('Authentication required');
      }
      
      const token = authHeader.slice(7);
      let user = null;
      
      try {
        const jwtService = strapi.plugin('users-permissions').service('jwt');
        user = await jwtService.verify(token);
      } catch (jwtError) {
        return ctx.unauthorized('Invalid token');
      }
      
      if (!user || !user.id) {
        return ctx.unauthorized('Authentication required');
      }
      
      // Ensure userId is a number
      const userId = Number(user.id);
      
      if (!userId || !Number.isInteger(userId)) {
        console.log(`[profile] Invalid user ID: ${user.id} (type: ${typeof user.id})`);
        return ctx.badRequest('Invalid user ID');
      }

      // 1) Get fileId from request
      const body = ctx.request.body || {};
      const fileId = Number(body?.fileId);
      if (!fileId) return ctx.badRequest('fileId is required');

      // 2) Verify the file exists
      const f = await strapi.entityService.findOne('plugin::upload.file', fileId);
      if (!f) return ctx.badRequest('fileId not found');

      // 3) Get current user with existing previousCoverLetterFiles
      const me = await strapi.entityService.findOne('plugin::users-permissions.user', userId, {
        populate: { previousCoverLetterFiles: true },
      }) as any;

      console.log(`[profile:addPreviousCoverLetter] Current previousCoverLetterFiles:`, me?.previousCoverLetterFiles);

      // 4) Get existing file IDs
      const existingFiles = Array.isArray(me?.previousCoverLetterFiles)
        ? me.previousCoverLetterFiles.map((file: any) => file.id)
        : [];

      console.log(`[profile:addPreviousCoverLetter] Existing file IDs:`, existingFiles);

      // 5) Add new fileId if not already present
      if (!existingFiles.includes(fileId)) {
        const updatedFileIds = [...existingFiles, fileId];
        
        console.log(`[profile:addPreviousCoverLetter] Updating with file IDs:`, updatedFileIds);
        
        // Try entityService first
        try {
          const updated = await strapi.entityService.update('plugin::users-permissions.user', userId, {
            data: { previousCoverLetterFiles: updatedFileIds },
          });
          console.log(`[profile:addPreviousCoverLetter] ✓ EntityService update succeeded`);
        } catch (entityErr: any) {
          console.log(`[profile:addPreviousCoverLetter] EntityService failed, trying db.query:`, entityErr?.message);
          
          // Fallback to raw DB query
          await strapi.db.query('plugin::users-permissions.user').update({
            where: { id: userId },
            data: { previousCoverLetterFiles: updatedFileIds },
          });
          console.log(`[profile:addPreviousCoverLetter] ✓ DB query update succeeded`);
        }
        
        console.log(`[profile:addPreviousCoverLetter] ✓ Added file ${fileId} (${f.name}) to user ${userId}. Total files: ${updatedFileIds.length}`);
        
        // Verify it was saved
        const verify = await strapi.entityService.findOne('plugin::users-permissions.user', userId, {
          populate: { previousCoverLetterFiles: true },
        }) as any;
        console.log(`[profile:addPreviousCoverLetter] Verification - files after update:`, verify?.previousCoverLetterFiles);
      } else {
        console.log(`[profile:addPreviousCoverLetter] File ${fileId} already exists for user ${userId}`);
      }

      ctx.body = { success: true, fileId };
    } catch (e: any) {
      console.error('[profile:addPreviousCoverLetter] unexpected error:', e?.message || e);
      ctx.throw(500, 'Failed to add previous cover letter');
    }
  },

  // ====== NEW: Remove previous cover letter file ======
  async removePreviousCoverLetter(ctx) {
    try {
      console.log('[profile:removePreviousCoverLetter] Starting request');
      
      // Manual JWT verification
      const authHeader = ctx.request.header.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return ctx.unauthorized('Authentication required');
      }
      
      const token = authHeader.slice(7);
      let user = null;
      
      try {
        const jwtService = strapi.plugin('users-permissions').service('jwt');
        user = await jwtService.verify(token);
      } catch (jwtError) {
        return ctx.unauthorized('Invalid token');
      }
      
      if (!user || !user.id) {
        return ctx.unauthorized('Authentication required');
      }
      
      // Ensure userId is a number
      const userId = Number(user.id);
      
      if (!userId || !Number.isInteger(userId)) {
        console.log(`[profile] Invalid user ID: ${user.id} (type: ${typeof user.id})`);
        return ctx.badRequest('Invalid user ID');
      }

      // 1) Get fileId from request
      const fileId = Number(ctx.params.fileId);
      if (!fileId) return ctx.badRequest('fileId is required');

      // 2) Get current user with existing previousCoverLetterFiles
      const me = await strapi.entityService.findOne('plugin::users-permissions.user', userId, {
        populate: { previousCoverLetterFiles: true },
      }) as any;

      // 3) Remove the fileId
      const existingFiles = Array.isArray(me?.previousCoverLetterFiles)
        ? me.previousCoverLetterFiles.map((file: any) => file.id)
        : [];

      const updatedFileIds = existingFiles.filter(id => id !== fileId);
      
      await strapi.entityService.update('plugin::users-permissions.user', userId, {
        data: { previousCoverLetterFiles: updatedFileIds },
      });
      
      console.log(`[profile:removePreviousCoverLetter] Removed file ${fileId} from user ${userId}`);

      // Optionally delete the file from storage
      try {
        const uploadService = strapi.plugin('upload').service('upload');
        const file = await strapi.entityService.findOne('plugin::upload.file', fileId);
        if (file) {
          await uploadService.remove(file);
        }
      } catch (e: any) {
        console.log('[profile:removePreviousCoverLetter] Could not delete file from storage:', e?.message);
      }

      ctx.body = { success: true, fileId };
    } catch (e: any) {
      console.error('[profile:removePreviousCoverLetter] unexpected error:', e?.message || e);
      ctx.throw(500, 'Failed to remove previous cover letter');
    }
  },

  // ====== NEW: Get all previous cover letter files ======
  async getPreviousCoverLetters(ctx) {
    try {
      console.log('[profile:getPreviousCoverLetters] Starting request');
      
      // Manual JWT verification
      const authHeader = ctx.request.header.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return ctx.unauthorized('Authentication required');
      }
      
      const token = authHeader.slice(7);
      let user = null;
      
      try {
        const jwtService = strapi.plugin('users-permissions').service('jwt');
        user = await jwtService.verify(token);
      } catch (jwtError) {
        return ctx.unauthorized('Invalid token');
      }
      
      if (!user || !user.id) {
        return ctx.unauthorized('Authentication required');
      }
      
      // Ensure userId is a number
      const userId = Number(user.id);
      
      if (!userId || !Number.isInteger(userId)) {
        console.log(`[profile] Invalid user ID: ${user.id} (type: ${typeof user.id})`);
        return ctx.badRequest('Invalid user ID');
      }

      // Get user with populated previousCoverLetterFiles
      const me = await strapi.entityService.findOne('plugin::users-permissions.user', userId, {
        populate: { previousCoverLetterFiles: true },
      }) as any;

      const files = Array.isArray(me?.previousCoverLetterFiles)
        ? me.previousCoverLetterFiles.map(sanitizeFile).filter(Boolean)
        : [];

      ctx.body = { files };
    } catch (e: any) {
      console.error('[profile:getPreviousCoverLetters] unexpected error:', e?.message || e);
      ctx.throw(500, 'Failed to get previous cover letters');
    }
  },

  // ====== DEBUG: Test cover letter text extraction ======
  async debugCoverLetterExtraction(ctx) {
    try {
      const authHeader = ctx.request.header.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return ctx.unauthorized('Authentication required');
      }
      
      const token = authHeader.slice(7);
      let user = null;
      
      try {
        const jwtService = strapi.plugin('users-permissions').service('jwt');
        user = await jwtService.verify(token);
      } catch (jwtError) {
        return ctx.unauthorized('Invalid token');
      }
      
      if (!user || !user.id) {
        return ctx.unauthorized('Authentication required');
      }
      
      // Ensure userId is a number
      const userId = Number(user.id);
      
      if (!userId || !Number.isInteger(userId)) {
        console.log(`[profile] Invalid user ID: ${user.id} (type: ${typeof user.id})`);
        return ctx.badRequest('Invalid user ID');
      }

      // Fetch with multiple approaches
      const results: any = {};

      // Approach 1: EntityService with populate
      try {
        const userWithFiles = await strapi.entityService.findOne('plugin::users-permissions.user', userId, {
          populate: { previousCoverLetterFiles: true } as any,
        }) as any;
        results.entityService = {
          files: userWithFiles?.previousCoverLetterFiles,
          count: Array.isArray(userWithFiles?.previousCoverLetterFiles) 
            ? userWithFiles.previousCoverLetterFiles.length 
            : 0,
        };
      } catch (e: any) {
        results.entityService = { error: e.message };
      }

      // Approach 2: DB query
      try {
        const dbUser = await strapi.db.query('plugin::users-permissions.user').findOne({
          where: { id: userId },
          populate: { previousCoverLetterFiles: true },
        }) as any;
        results.dbQuery = {
          files: dbUser?.previousCoverLetterFiles,
          count: Array.isArray(dbUser?.previousCoverLetterFiles) 
            ? dbUser.previousCoverLetterFiles.length 
            : 0,
        };
      } catch (e: any) {
        results.dbQuery = { error: e.message };
      }

      // Try extracting text from files if any found
      const files = (results.entityService?.files || results.dbQuery?.files);
      if (Array.isArray(files) && files.length > 0) {
        results.extractionTests = [];
        
        for (const file of files.slice(0, 2)) { // Test first 2 files only
          const testResult: any = {
            fileId: file.id,
            fileName: file.name,
            mime: file.mime,
            ext: file.ext,
            url: file.url,
          };

          try {
            // Try to read and extract
            let buf: Buffer | null = null;
            
            // Try HTTP fetch (simpler for testing)
            const url = String(file.url || '');
            if (url.startsWith('http')) {
              const res = await fetch(url);
              const ab = await res.arrayBuffer();
              buf = Buffer.from(ab);
              testResult.bufferSize = buf.length;
            }

            if (buf) {
              const mime = String(file.mime || '').toLowerCase();
              const ext = String(file.ext || '').toLowerCase();

              if (ext === '.docx' || mime === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
                const mmMod = await import('mammoth');
                const mammoth: any = (mmMod as any).default || (mmMod as any);
                const out = await mammoth.extractRawText({ buffer: buf });
                testResult.extractedText = (out?.value || '').trim();
                testResult.extractedLength = testResult.extractedText.length;
                testResult.preview = testResult.extractedText.substring(0, 200);
              }
            }
          } catch (e: any) {
            testResult.error = e.message;
          }

          results.extractionTests.push(testResult);
        }
      }

      ctx.body = results;
    } catch (e: any) {
      console.error('[profile:debugCoverLetterExtraction] unexpected error:', e?.message || e);
      ctx.throw(500, 'Debug failed');
    }
  },

  // ====== Get users who need email reminders (for n8n automation) ======
  async getRemindersNeeded(ctx) {
    try {
      console.log('[profile:getRemindersNeeded] Starting request');
      
      // Simple API key check for security (you should set this in your .env)
      const apiKey = ctx.request.header['x-api-key'] || ctx.query.apiKey;
      const expectedKey = process.env.REMINDERS_API_KEY || 'change-me-in-production';
      
      if (!apiKey || apiKey !== expectedKey) {
        console.log('[profile:getRemindersNeeded] Invalid or missing API key');
        return ctx.unauthorized('Invalid API key');
      }

      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      const reminders: any = {
        applications: [],
        followUps: [],
        interviews: [],
      };

      // Get all users with notification preferences
      const users = await strapi.entityService.findMany('plugin::users-permissions.user', {
        filters: {
          notificationPrefs: { $notNull: true },
        },
      });

      console.log(`[profile:getRemindersNeeded] Found ${users.length} users with notification preferences`);

      for (const user of users) {
        const prefs = user.notificationPrefs || {};
        
        // Parse JSON if it's a string
        const notificationPrefs = typeof prefs === 'string' ? JSON.parse(prefs) : prefs;

        // 1. Application deadline reminders
        if (notificationPrefs.applications?.enabled) {
          const leadDays = notificationPrefs.applications.leadDays || 0;
          const secondReminder = notificationPrefs.applications.secondReminder || 0;

          // Determine reminder configuration type
          const hasSecondReminder = secondReminder > 0 && secondReminder !== leadDays;
          const reminderCount = hasSecondReminder ? 2 : 1;

          // Get user's applications
          const applications = await strapi.entityService.findMany('api::application.application', {
            filters: {
              owner: { id: user.id },
              deadline: { 
                $gte: today.toISOString().split('T')[0] // Only future deadlines (implies not null)
              },
            },
          });

          for (const app of applications) {
            if (!app.deadline) continue;
            
            const deadline = new Date(app.deadline);
            deadline.setHours(0, 0, 0, 0);
            
            const daysUntilDeadline = Math.ceil((deadline.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

            // First reminder check
            if (daysUntilDeadline === leadDays) {
              reminders.applications.push({
                userId: user.id,
                email: user.email,
                preferredName: user.preferredName || user.username,
                reminderType: 'first',
                reminderIndex: 1,
                reminderCount: reminderCount, // 1 or 2
                isLastReminder: !hasSecondReminder, // true if 1/1, false if 1/2
                application: {
                  id: app.id,
                  title: app.title,
                  company: app.company,
                  deadline: app.deadline,
                },
                daysBefore: leadDays,
              });
            }

            // Second reminder check (if configured and different from first)
            if (hasSecondReminder && daysUntilDeadline === secondReminder) {
              reminders.applications.push({
                userId: user.id,
                email: user.email,
                preferredName: user.preferredName || user.username,
                reminderType: 'second',
                reminderIndex: 2,
                reminderCount: reminderCount, // Always 2 if second reminder is configured
                isLastReminder: true, // Always true for second reminder
                application: {
                  id: app.id,
                  title: app.title,
                  company: app.company,
                  deadline: app.deadline,
                },
                daysBefore: secondReminder,
              });
            }
          }
        }

        // 2. Follow-up reminders
        if (notificationPrefs.followUps?.enabled) {
          const daysAfter = notificationPrefs.followUps.daysAfter || 0;
          const secondReminder = notificationPrefs.followUps.secondReminder || 0;

          // Get user's applications that need follow-up
          const applications = await strapi.entityService.findMany('api::application.application', {
            filters: {
              owner: { id: user.id },
              stage: { $in: ['Phase1', 'Phase2', 'Assessment'] }, // Stages that might need follow-up
            },
          });

          // Determine reminder configuration type
          const hasSecondReminder = secondReminder > 0;
          const reminderCount = hasSecondReminder ? 2 : 1;

          for (const app of applications) {
            if (!app.createdAt) continue;
            
            const createdAt = new Date(app.createdAt);
            createdAt.setHours(0, 0, 0, 0);
            
            const daysSinceApplication = Math.floor((today.getTime() - createdAt.getTime()) / (1000 * 60 * 60 * 24));

            // First follow-up reminder (X days after applying)
            if (daysSinceApplication === daysAfter) {
              reminders.followUps.push({
                userId: user.id,
                email: user.email,
                preferredName: user.preferredName || user.username,
                reminderType: 'first',
                reminderIndex: 1,
                reminderCount: reminderCount, // 1 or 2
                isLastReminder: !hasSecondReminder, // true if 1/1, false if 1/2
                application: {
                  id: app.id,
                  title: app.title,
                  company: app.company,
                  appliedDate: app.createdAt,
                  deadline: app.deadline || null,
                },
                daysAfter: daysAfter,
              });
            }

            // Second follow-up reminder: X days before deadline (if deadline exists)
            if (hasSecondReminder && app.deadline) {
              const deadline = new Date(app.deadline);
              deadline.setHours(0, 0, 0, 0);
              
              const daysUntilDeadline = Math.ceil((deadline.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
              
              // Second reminder triggers X days before the deadline
              if (daysUntilDeadline === secondReminder && daysUntilDeadline > 0) {
                reminders.followUps.push({
                  userId: user.id,
                  email: user.email,
                  preferredName: user.preferredName || user.username,
                  reminderType: 'second',
                  reminderIndex: 2,
                  reminderCount: reminderCount, // Always 2 if second reminder is configured
                  isLastReminder: true, // Always true for second reminder
                  application: {
                    id: app.id,
                    title: app.title,
                    company: app.company,
                    appliedDate: app.createdAt,
                    deadline: app.deadline,
                  },
                  daysBefore: secondReminder,
                });
              }
            }
          }
        }

        // 3. Interview reminders
        if (notificationPrefs.interviews?.enabled) {
          const leadDays = notificationPrefs.interviews.leadDays || 0;
          const secondReminder = notificationPrefs.interviews.secondReminder || 0;

          // Determine reminder configuration type
          const hasSecondReminder = secondReminder > 0 && secondReminder !== leadDays;
          const reminderCount = hasSecondReminder ? 2 : 1;

          // Get user's applications with interview stage and nextActionDate
          const applications = await strapi.entityService.findMany('api::application.application', {
            filters: {
              owner: { id: user.id },
              stage: 'Interview',
              nextActionDate: { 
                $gte: today.toISOString() // Only future interviews (implies not null)
              },
            },
          });

          for (const app of applications) {
            if (!app.nextActionDate) continue;
            
            const interviewDate = new Date(app.nextActionDate);
            interviewDate.setHours(0, 0, 0, 0);
            
            const daysUntilInterview = Math.ceil((interviewDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

            // First interview reminder
            if (daysUntilInterview === leadDays) {
              reminders.interviews.push({
                userId: user.id,
                email: user.email,
                preferredName: user.preferredName || user.username,
                reminderType: 'first',
                reminderIndex: 1,
                reminderCount: reminderCount, // 1 or 2
                isLastReminder: !hasSecondReminder, // true if 1/1, false if 1/2
                application: {
                  id: app.id,
                  title: app.title,
                  company: app.company,
                  interviewDate: app.nextActionDate,
                },
                daysBefore: leadDays,
              });
            }

            // Second interview reminder (if configured and different from first)
            if (hasSecondReminder && daysUntilInterview === secondReminder) {
              reminders.interviews.push({
                userId: user.id,
                email: user.email,
                preferredName: user.preferredName || user.username,
                reminderType: 'second',
                reminderIndex: 2,
                reminderCount: reminderCount, // Always 2 if second reminder is configured
                isLastReminder: true, // Always true for second reminder
                application: {
                  id: app.id,
                  title: app.title,
                  company: app.company,
                  interviewDate: app.nextActionDate,
                },
                daysBefore: secondReminder,
              });
            }
          }
        }
      }

      console.log(`[profile:getRemindersNeeded] Found ${reminders.applications.length} application reminders, ${reminders.followUps.length} follow-up reminders, ${reminders.interviews.length} interview reminders`);

      ctx.body = {
        success: true,
        date: today.toISOString().split('T')[0],
        reminders,
        summary: {
          applications: reminders.applications.length,
          followUps: reminders.followUps.length,
          interviews: reminders.interviews.length,
          total: reminders.applications.length + reminders.followUps.length + reminders.interviews.length,
        },
      };
    } catch (e: any) {
      console.error('[profile:getRemindersNeeded] unexpected error:', e?.message || e);
      ctx.throw(500, 'Failed to get reminders needed');
    }
  },
};
