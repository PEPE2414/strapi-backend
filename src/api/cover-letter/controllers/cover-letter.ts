import type { Core } from '@strapi/strapi';

export default ({ strapi }: { strapi: Core.Strapi }) => ({
  /**
   * POST /api/cover-letters/generate
   * Body: { title, company, description, source?, savedJobId? }
   * Debits 1 coverLetterCredit, creates usage-log, creates CL (pending),
   * then posts webhook to n8n with x-cl-webhook-secret.
   */
  async generate(ctx) {
    const user = ctx.state.user;
    if (!user) return ctx.unauthorized('Auth required');

    const { title, company, description, source, savedJobId } = ctx.request.body || {};
    if (!title || !company || !description) {
      return ctx.badRequest('title, company, description required');
    }

    // 1) Reload user to get latest credits/points/cvText
    const freshUser = await strapi.db.query('plugin::users-permissions.user').findOne({
      where: { id: user.id },
      select: ['id', 'coverLetterCredits', 'cvText', 'coverLetterPoints'],
    });

    const credits = freshUser?.coverLetterCredits ?? 0;
    const packagesArr = Array.isArray((freshUser as any)?.packages) ? (freshUser as any).packages : [];
    const entitled = packagesArr.includes('find-track') || packagesArr.includes('fast-track');
    
    // Decide if we allow this generation:
    const allow = entitled || credits > 0;
    if (!allow) {
      return ctx.throw(402, 'No cover letter credits');
    }

    // 4) Decrement credits only if not entitled
    if (!entitled) {
      await strapi.db.query('plugin::users-permissions.user').update({
        where: { id: user.id },
        data: { coverLetterCredits: Math.max(0, credits - 1) },
      });
    }
        
    // 2) Create cover letter (pending)
    const cl = await strapi.entityService.create('api::cover-letter.cover-letter' as any, {
      data: {
        title,
        company,
        description,
        source: source || 'manual',
        savedJobId: savedJobId || null,
        status: 'pending',
        user: user.id,
      },
    });

    // 3) Idempotent usage log (app-level)
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

    // 4) Decrement credits
    await strapi.db.query('plugin::users-permissions.user').update({
      where: { id: user.id },
      data: { coverLetterCredits: Math.max(0, credits - 1) },
    });

    // 5) Fire webhook to n8n (non-blocking)
    try {
      const payload = {
        coverLetterId: cl.id,
        userId: user.id,
        title,
        company,
        description,
        source: source || 'manual',
        savedJobId: savedJobId || null,
        cvUrl: null,
        cvText: freshUser?.cvText || '',
        points: Array.isArray((freshUser as any)?.coverLetterPoints)
          ? (freshUser as any).coverLetterPoints
          : [],
      };

      const url = process.env.COVERLETTER_WEBHOOK_URL;
      const secret = process.env.CL_WEBHOOK_SECRET;
      if (url) {
        await fetch(url, {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            ...(secret ? { 'x-cl-webhook-secret': secret } : {}),
          },
          body: JSON.stringify(payload),
        });
      }
    } catch (e) {
      strapi.log.warn('[cover-letters] webhook post failed', e as any);
      // keep CL pending; can retry
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
});
