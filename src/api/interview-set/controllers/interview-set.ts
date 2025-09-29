import { factories } from '@strapi/strapi';
import crypto from 'crypto';

export default factories.createCoreController('api::interview-set.interview-set', ({ strapi }) => ({

  async listMine(ctx) {
    const userId = ctx.state.user?.id;
    if(!userId) return ctx.unauthorized();
    const data = await strapi.entityService.findMany('api::interview-set.interview-set', {
      filters: { userId },
      sort: { createdAt: 'DESC' },
      limit: 20
    });
    ctx.body = { data };
  },

  async generate(ctx) {
    const userId = ctx.state.user?.id;
    if(!userId) return ctx.unauthorized();

    const { jobId = null, jobTitle, company, jdText = '' } = ctx.request.body || {};
    if(!jobTitle || !company) return ctx.badRequest('jobTitle and company required');

    // Idempotency hash
    const jdHash = crypto.createHash('sha256').update((jdText || '').trim()).digest('hex');
    const idem = crypto.createHash('sha256').update([userId, jobTitle, company, jdHash].join('|')).digest('hex');

    // Optional: check recent duplicate (last 24h)
    const existing = await strapi.entityService.findMany('api::interview-set.interview-set', {
      filters: { userId, jobTitle, company, jdHash },
      sort: { createdAt: 'DESC' },
      limit: 1
    });
    // Call n8n
    const N8N_URL = process.env.N8N_INTERVIEW_URL; // e.g. https://effort-free.app.n8n.cloud/webhook/interview-generate
    const SECRET = process.env.N8N_SHARED_SECRET;
    if(!N8N_URL || !SECRET) {
      strapi.log.error('Missing N8N_INTERVIEW_URL or N8N_SHARED_SECRET');
      return ctx.internalServerError('Service unavailable');
    }

    const payload = { jobTitle, company, jdText, userId, jobId };
    let out;
    try{
      const r = await fetch(N8N_URL, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-cl-secret': SECRET
        },
        body: JSON.stringify(payload)
      });
      if(!r.ok){
        const txt = await r.text();
        strapi.log.error(`n8n error ${r.status}: ${txt}`);
        return ctx.internalServerError('Generator unavailable');
      }
      out = await r.json(); // { questions: [{ q,a,category }], ... }
    }catch(e){
      strapi.log.error('n8n fetch failed', e);
      return ctx.internalServerError('Generator unreachable');
    }

    const questions = Array.isArray(out?.questions) ? out.questions : [];
    if(questions.length === 0){
      return ctx.internalServerError('No questions generated');
    }

    // Save
    const created = await strapi.entityService.create('api::interview-set.interview-set', {
      data: { userId, jobId, jobTitle, company, jdHash, questions }
    });

    ctx.body = { data: created };
  }

}));
