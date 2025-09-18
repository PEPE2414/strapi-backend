// src/api/outreach-email/controllers/outreach-email.ts
import { factories } from '@strapi/strapi';
import type { UID } from '@strapi/types';

const OUTREACH_UID = 'api::outreach-email.outreach-email' as UID.ContentType;

type EmailBlock = {
  email?: string | null;
  confidence?: number | null;
  message?: string | null;
};

export default factories.createCoreController(OUTREACH_UID, ({ strapi }) => ({
  async me(ctx) {
    const userId = ctx.state.user?.id;
    if (!userId) return ctx.unauthorized('Login required');

    const data = await strapi.entityService.findMany(OUTREACH_UID, {
      filters: { user: userId } as any,
      sort: { createdAt: 'desc' } as any,
      populate: {} as any,
    } as any);

    ctx.body = data;
  },

  async findEmails(ctx) {
    const userId = ctx.state.user?.id;
    if (!userId) return ctx.unauthorized('Login required');
  
    const body = (ctx.request.body ?? {}) as Record<string, unknown>;
    const company = String(body.company ?? '').trim();
    const title = String(body.title ?? '').trim();
    const description = typeof body.description === 'string' ? body.description : '';
    const jobUrl = typeof body.jobUrl === 'string' ? body.jobUrl : '';
    const source = (body.source as string) ?? 'manual';
  
    if (!company || !title) return ctx.badRequest('company and title are required');
  
    const webhookUrl = process.env.OUTREACH_WEBHOOK_URL;
    const secret = process.env.OUTREACH_WEBHOOK_SECRET;
  
    let recruiter: EmailBlock | null = null;
    let manager: EmailBlock | null = null;
  
    const safeUrl = (raw?: string | null) => {
      try { if (!raw) return '(unset)'; const u = new URL(raw); return `${u.origin}${u.pathname}`; }
      catch { return '(invalid URL)'; }
    };
  
    try {
      if (!webhookUrl) throw new Error('Missing OUTREACH_WEBHOOK_URL');
  
      strapi.log.info(`[outreach] webhook → ${safeUrl(webhookUrl)}`);
  
      const callWebhook = async (url: string) => {
        return fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(secret ? { 'x-outreach-secret': secret } : {}),
          },
          body: JSON.stringify({ company, title, description, jobUrl, userId }),
        });
      };
  
      let resp = await callWebhook(webhookUrl);
  
      if (resp.status === 404 && webhookUrl.includes('/webhook-test/')) {
        const prodUrl = webhookUrl.replace('/webhook-test/', '/webhook/');
        strapi.log.warn(`[outreach] 404 on test URL, retrying production URL: ${prodUrl}`);
        resp = await callWebhook(prodUrl);
      }
  
      const rawText = await resp.text();
      strapi.log.info(`[outreach] webhook status ${resp.status}`);
      if (rawText) strapi.log.debug(`[outreach] webhook body (first 500): ${rawText.slice(0, 500)}`);
  
      let json: any = null;
      try { json = JSON.parse(rawText); } catch {}
  
      const asArray = Array.isArray(json?.emails) ? json.emails : [];
      const pick = (role: string) =>
        asArray.find((e: any) => String(e.role || '').toLowerCase() === role) || json?.[role];
  
      const norm = (e: any): EmailBlock | null => {
        if (!e) return null;
        const conf =
          typeof e.confidence === 'number'
            ? e.confidence
            : typeof e.confidence === 'string'
            ? parseFloat(e.confidence)
            : null;
  
        const email =
          typeof e.email === 'string' && e.email.trim() ? e.email.trim() : null;
  
        const message =
          typeof e.message === 'string'
            ? e.message
            : typeof e.content === 'string'
            ? e.content
            : '';
  
        return { email, confidence: Number.isFinite(conf as number) ? conf! : null, message };
      };
  
      recruiter = norm(pick('recruiter'));
      manager   = norm(pick('manager'));
    } catch (err) {
      strapi.log.warn(
        `[outreach] webhook call failed: ${err instanceof Error ? err.message : String(err)} (to ${safeUrl(webhookUrl)})`
      );
    }
  
    const defaultMsg = `Subject: Quick note re: ${title} @ ${company}
  
  Hi {{Name}},
  
  I’m applying for the ${title} role at ${company}. I wanted to introduce myself directly and share why I’m a strong fit. If you’re the right contact, I’d really appreciate any guidance or a quick glance at my application.
  
  Thanks so much,
  [Your Name]
  [Phone] • [LinkedIn]`;
  
    const created = await strapi.entityService.create(OUTREACH_UID, {
      data: {
        user: userId,
        company,
        title,
        description,
        jobUrl,
        source,
        recruiterEmail: recruiter?.email ?? null,
        recruiterConfidence: recruiter?.confidence ?? null,
        recruiterMessage: recruiter?.message || defaultMsg,
        managerEmail: manager?.email ?? null,
        managerConfidence: manager?.confidence ?? null,
        managerMessage: manager?.message || defaultMsg,
      } as any,
    } as any);
  
    ctx.set('x-outreach-webhook', recruiter || manager ? 'ok' : 'fallback');
    ctx.body = created;
  },
}));
