import { factories } from '@strapi/strapi';
import type { UID } from '@strapi/types';

const OUTREACH_UID = 'api::outreach-email.outreach-email' as UID.ContentType;

export default factories.createCoreController(OUTREACH_UID, ({ strapi }) => ({
  async me(ctx) {
    const userId = ctx.state.user?.id;
    if (!userId) return ctx.unauthorized('Login required');

    const data = await strapi.entityService.findMany(OUTREACH_UID, {
      filters: { user: userId },
      sort: { createdAt: 'desc' },
      populate: {}
    });

    ctx.body = data;
  },

  async findEmails(ctx) {
    const userId = ctx.state.user?.id;
    if (!userId) return ctx.unauthorized('Login required');

    const { company, title, description = '', jobUrl = '', source = 'manual' } = ctx.request.body || {};
    if (!company || !title) return ctx.badRequest('company and title are required');

    const webhookUrl = process.env.OUTREACH_WEBHOOK_URL;
    const secret = process.env.OUTREACH_WEBHOOK_SECRET;

    let recruiter: { email?: string; confidence?: number | null; message?: string } | null = null;
    let manager:   { email?: string; confidence?: number | null; message?: string } | null = null;

    try {
      if (!webhookUrl) throw new Error('Missing OUTREACH_WEBHOOK_URL');

      const resp = await fetch(webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(secret ? { 'x-outreach-secret': secret } : {})
        },
        body: JSON.stringify({ company, title, description, jobUrl, userId })
      });

      let json: any = null;
      try { json = await resp.json(); } catch {}

      const asArray = Array.isArray(json?.emails) ? json.emails : [];
      const pick = (role: string) => asArray.find((e: any) => (e.role || '').toLowerCase() === role) || json?.[role];
      const norm = (e: any) => e ? ({
        email: e.email || '',
        confidence: typeof e.confidence === 'number' ? e.confidence :
                    (typeof e.confidence === 'string' ? parseFloat(e.confidence) : null),
        message: e.message || e.content || ''
      }) : null;

      recruiter = norm(pick('recruiter'));
      manager   = norm(pick('manager'));

    } catch (err) {
      strapi.log.warn(`[outreach] webhook call failed: ${err instanceof Error ? err.message : String(err)}`);
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
        company, title, description, jobUrl, source,
        recruiterEmail: recruiter?.email || '',
        recruiterConfidence: recruiter?.confidence ?? null,
        recruiterMessage: recruiter?.message || defaultMsg,
        managerEmail: manager?.email || '',
        managerConfidence: manager?.confidence ?? null,
        managerMessage: manager?.message || defaultMsg
      }
    });

    ctx.body = created;
  }
}));
