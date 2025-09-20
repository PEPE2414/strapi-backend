import type { Core } from '@strapi/strapi';

export default ({ strapi }: { strapi: Core.Strapi }) => ({
  /**
   * POST /api/cover-letters/generate
   * Body: { title, company, description, source, savedJobId }
   * Self-auth via ctx.state.user; debits 1 coverLetterCredit, creates usage-log, creates CL (pending),
   * then posts webhook to n8n with x-cl-webhook-secret.
   */
  async generate(ctx) {
    const user = ctx.state.user;
    if (!user) return ctx.unauthorized('Auth required');

    const { title, company, description, source, savedJobId } = ctx.request.body || {};
    if (!title || !company || !description) return ctx.badRequest('title, company, description required');

    const webhookUrl = process.env.COVERLETTER_WEBHOOK_URL;
    const webhookSecret = process.env.CL_WEBHOOK_SECRET;

    const trxRes = await strapi.db.connection.transaction(async (trx) => {
      // fresh user (credits)
      const freshUser = await strapi.db.query('plugin::users-permissions.user').findOne({
        where: { id: user.id },
        select: ['id', 'coverLetterCredits', 'coverLetterPoints', 'cvText'],
        transacting: trx
      });

      const credits = freshUser?.coverLetterCredits ?? 0;
      if (credits <= 0) {
        ctx.throw(402, 'No cover letter credits');
      }

      // create CL (pending)
      const cl = await strapi.entityService.create('api::cover-letter.cover-letter', {
        data: {
          title, company, description,
          source: source || 'manual',
          savedJobId: savedJobId || null,
          status: 'pending',
          user: user.id
        },
        transacting: trx
      });

      // idempotent usage-log for this CL
      const existing = await strapi.db.query('api::usage-log.usage-log').findOne({
        where: { type: 'cover_letter', resourceId: cl.id },
        transacting: trx
      });
      if (existing) ctx.throw(409, 'Duplicate usage for this cover letter');

      await strapi.entityService.create('api::usage-log.usage-log', {
        data: {
          user: user.id,
          type: 'cover_letter',
          resourceId: cl.id,
          meta: { source: source || 'manual' }
        },
        transacting: trx
      });

      // decrement credits
      await strapi.db.query('plugin::users-permissions.user').update({
        where: { id: user.id },
        data: { coverLetterCredits: credits - 1 },
        transacting: trx
      });

      // pass through useful fields for webhook
      return {
        clId: cl.id,
        cvText: freshUser?.cvText || '',
        points: Array.isArray((freshUser as any)?.coverLetterPoints) ? (freshUser as any).coverLetterPoints : []
      };
    });

    // fire webhook (non-blocking for user response)
    try {
      if (webhookUrl) {
        const payload = {
          coverLetterId: trxRes.clId,
          userId: user.id,
          title,
          company,
          description,
          source: source || 'manual',
          savedJobId: savedJobId || null,
          cvUrl: null,
          cvText: trxRes.cvText || '',
          points: trxRes.points || []
        };

        await fetch(webhookUrl, {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            ...(webhookSecret ? { 'x-cl-webhook-secret': webhookSecret } : {})
          },
          body: JSON.stringify(payload)
        });
      }
    } catch (e) {
      strapi.log.warn('[cover-letters] webhook post failed', e);
      // Keep CL pending; you can retry manually if needed
    }

    ctx.body = { ok: true, id: trxRes.clId };
  },

  /**
   * POST /api/cover-letters/:id/complete
   * Accepts either { fileId } OR { contentHtml, contentText } plus optional { score, cvAudit, cvAuditScore }
   * Guarded by header x-cl-secret == COVERLETTER_PROCESSING_SECRET
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

    const updated = await strapi.entityService.update('api::cover-letter.cover-letter', id, { data });
    ctx.body = { ok: true, id: updated.id };
  },

  /**
   * POST /api/cover-letters/:id/fail
   * Guarded by header x-cl-secret == COVERLETTER_PROCESSING_SECRET
   */
  async fail(ctx) {
    const { id } = ctx.params;
    const secret = ctx.request.headers['x-cl-secret'];
    if (secret !== process.env.COVERLETTER_PROCESSING_SECRET) return ctx.unauthorized();

    const { error } = ctx.request.body || {};
    await strapi.entityService.update('api::cover-letter.cover-letter', id, {
      data: { status: 'failed' }
    });
    strapi.log.warn(`[cover-letters] ${id} failed: ${error || 'unknown'}`);
    ctx.body = { ok: true };
  }
});
