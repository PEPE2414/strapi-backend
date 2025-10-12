import { factories } from '@strapi/strapi';

export default factories.createCoreController('api::cover-letter.cover-letter' as any, ({ strapi }) => ({
  /**
   * POST /api/cover-letters/generate
   * Body: { title, company, companyUrl?, description, source?, savedJobId? }
   * Debits 1 coverLetterCredit (unless entitled), creates usage-log, creates CL (pending),
   * then posts webhook to n8n with:
   *   - Job details (title, company, companyUrl, description)
   *   - User's CV text (cvText)
   *   - User's cover letter points (points)
   *   - Up to 5 most recent successful cover letters (previousCoverLetters)
   * n8n should call back to /api/cover-letters/:id/complete when done.
   */
  async generate(ctx) {
    // Manual JWT verification since auth: false bypasses built-in auth
    const authHeader = ctx.request.header.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return ctx.unauthorized('Authentication required');
    }
    
    const token = authHeader.slice(7);
    let user = null;
    
    try {
      // Use Strapi's JWT service to verify the token
      const jwtService = strapi.plugin('users-permissions').service('jwt');
      user = await jwtService.verify(token);
    } catch (jwtError) {
      return ctx.unauthorized('Invalid token');
    }

    const { title, company, companyUrl, description, source, savedJobId } = ctx.request.body || {};
    if (!title || !company || !description) {
      return ctx.badRequest('title, company, description required');
    }
    const cleanSavedJobId = savedJobId == null ? null : String(savedJobId);

    // Load latest credits/points/cvText/packages
    const freshUser = await strapi.db.query('plugin::users-permissions.user').findOne({
      where: { id: user.id },
      select: ['id', 'coverLetterCredits', 'cvText', 'coverLetterPoints', 'packages'],
    });

    const credits = freshUser?.coverLetterCredits ?? 0;
    const packagesArr = Array.isArray((freshUser as any)?.packages) ? (freshUser as any).packages : [];
    const entitled = packagesArr.includes('find-track') || packagesArr.includes('fast-track');
    const allow = entitled || credits > 0;
    if (!allow) return ctx.throw(402, 'No cover letter credits');

    // Create CL (pending)
    const cl = await strapi.entityService.create('api::cover-letter.cover-letter' as any, {
      data: {
        title,
        company,
        companyUrl: companyUrl || null,
        description,
        source: source || 'manual',
        savedJobId: cleanSavedJobId,
        status: 'pending',
        user: user.id,
      },
    });

    // Idempotent usage-log
    const existingLog = await strapi.db.query('api::usage-log.usage-log').findOne({
      where: { type: 'cover_letter', resourceId: cl.id },
    });
    if (!existingLog) {
      await strapi.entityService.create('api::usage-log.usage-log' as any, {
        data: {
          user: user.id,
          type: 'cover_letter',
          resourceId: cl.id,
          meta: { source: source || 'manual' },
        },
      });
    }

    // Decrement credits only if not entitled
    if (!entitled) {
      await strapi.db.query('plugin::users-permissions.user').update({
        where: { id: user.id },
        data: { coverLetterCredits: Math.max(0, credits - 1) },
      });
    }

    // Fetch user's uploaded previous cover letter files and extract text
    const userWithFiles = await strapi.entityService.findOne('plugin::users-permissions.user', user.id, {
      populate: { previousCoverLetterFiles: true } as any,
    });

    const previousCoverLetterTexts: string[] = [];

    // Extract text from each uploaded cover letter file
    const files = (userWithFiles as any)?.previousCoverLetterFiles;
    if (Array.isArray(files) && files.length > 0) {
      for (const file of files) {
        try {
          const mime = String(file.mime || '').toLowerCase();
          const ext = String(file.ext || '').toLowerCase();

          // Read file from S3 or HTTP
          let buf: Buffer | null = null;
          try {
            const { S3Client, GetObjectCommand } = await import('@aws-sdk/client-s3');
            const region = process.env.S3_REGION;
            const bucket = process.env.S3_BUCKET;
            
            if (region && bucket) {
              const keyFromProvider = (file as any)?.provider_metadata?.key as string | undefined;
              let key = keyFromProvider;
              
              if (!key) {
                const url = String(file.url || '');
                if (url) {
                  const path = url.startsWith('http://') || url.startsWith('https://')
                    ? new URL(url).pathname
                    : url;
                  key = path.replace(/^\/+/, '');
                }
              }

              if (key) {
                const s3 = new S3Client({
                  region,
                  credentials: {
                    accessKeyId: process.env.S3_ACCESS_KEY_ID || '',
                    secretAccessKey: process.env.S3_SECRET_ACCESS_KEY || '',
                  },
                });
                const out = await s3.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
                // @ts-ignore Node 18+ helper
                const bytes = await out.Body?.transformToByteArray();
                if (bytes) buf = Buffer.from(bytes);
              }
            }
          } catch (e: any) {
            strapi.log.warn(`[cover-letter] S3 GetObject failed for file ${file.id}, falling back to HTTP`);
          }

          if (!buf) {
            const url = String(file.url || '');
            if (url.startsWith('http')) {
              const res = await fetch(url);
              const ab = await res.arrayBuffer();
              buf = Buffer.from(ab);
            }
          }

          if (!buf) continue;

          // Extract text based on file type
          let extractedText = '';
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
          }

          if (extractedText.length > 0) {
            previousCoverLetterTexts.push(extractedText);
            strapi.log.info(`[cover-letter] Extracted ${extractedText.length} chars from uploaded file ${file.id}`);
          }
        } catch (e: any) {
          strapi.log.warn(`[cover-letter] Failed to extract text from file ${file.id}: ${e.message}`);
        }
      }
    }

    // Fire webhook to n8n
    try {
      const payload = {
        coverLetterId: cl.id,
        userId: user.id,
        title,
        company,
        companyUrl: companyUrl || null,
        description,
        source: source || 'manual',
        savedJobId: cleanSavedJobId,
        cvUrl: null,
        cvText: freshUser?.cvText || '',
        points: Array.isArray((freshUser as any)?.coverLetterPoints)
          ? (freshUser as any).coverLetterPoints
          : [],
        previousCoverLetters: previousCoverLetterTexts,
      };

      const url = process.env.COVERLETTER_WEBHOOK_URL;
      const secret = process.env.CL_WEBHOOK_SECRET; // keep in sync with your n8n Webhook header check
      if (url) {
        await fetch(url, {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            ...(secret ? { 'x-cl-secret': secret } : {}),
          },
          body: JSON.stringify(payload),
        });
      }
    } catch (e) {
      strapi.log.warn('[cover-letters] webhook post failed', e as any);
    }

    ctx.body = { ok: true, id: cl.id };
  },

  /**
   * POST /api/cover-letters/:id/complete
   * Accepts { fileId } OR { contentHtml, contentText } (+ optional score / cvAudit*)
   * Guarded by x-cl-secret == COVERLETTER_PROCESSING_SECRET
   */
  async complete(ctx) {
    const { id } = ctx.params;
    const secret = ctx.request.headers['x-cl-secret'];
    if (secret !== process.env.COVERLETTER_PROCESSING_SECRET) return ctx.unauthorized();

    const { fileId, contentHtml, contentText, score, cvAudit, cvAuditScore } = ctx.request.body || {};
    if (!fileId && !contentText) return ctx.badRequest('fileId or contentText required');

    const data: any = { status: 'ready' };
    if (fileId) data.file = fileId;
    if (typeof contentHtml === 'string') data.contentHtml = contentHtml;
    if (typeof contentText === 'string') data.contentText = contentText;
    if (Number.isInteger(score)) data.score = score;
    if (Number.isInteger(cvAuditScore)) data.cvAuditScore = cvAuditScore;
    if (cvAudit && typeof cvAudit === 'object') data.cvAudit = cvAudit;

    const updated = await strapi.entityService.update('api::cover-letter.cover-letter' as any, id, { data });
    ctx.body = { ok: true, id: updated.id };
  },

  /**
   * POST /api/cover-letters/:id/fail
   * Guarded by x-cl-secret == COVERLETTER_PROCESSING_SECRET
   */
  async fail(ctx) {
    const { id } = ctx.params;
    const secret = ctx.request.headers['x-cl-secret'];
    if (secret !== process.env.COVERLETTER_PROCESSING_SECRET) return ctx.unauthorized();

    const { error } = ctx.request.body || {};
    await strapi.entityService.update('api::cover-letter.cover-letter' as any, id, {
      data: { status: 'failed' },
    });
    strapi.log.warn(`[cover-letters] ${id} failed: ${error || 'unknown'}`);
    ctx.body = { ok: true };
  },
}));
