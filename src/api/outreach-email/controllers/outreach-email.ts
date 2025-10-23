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
    
    // Ensure userId is a number
    const userId = Number(user.id);
    
    if (!userId || !Number.isInteger(userId)) {
      strapi.log.error(`[outreach-email] Invalid user ID in me: ${user.id} (type: ${typeof user.id})`);
      return ctx.badRequest('Invalid user ID');
    }

    const data = await strapi.entityService.findMany(OUTREACH_UID, {
      filters: { user: userId } as any,
      sort: { createdAt: 'desc' } as any,
      populate: {} as any,
    } as any);

    ctx.body = data;
  },

  async findEmails(ctx) {
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
    
    // Ensure userId is a number
    const userId = Number(user.id);
    
    if (!userId || !Number.isInteger(userId)) {
      strapi.log.error(`[outreach-email] Invalid user ID in findEmails: ${user.id} (type: ${typeof user.id})`);
      return ctx.badRequest('Invalid user ID');
    }

    const body = (ctx.request.body ?? {}) as Record<string, unknown>;
    const company = String(body.company ?? '').trim();
    const title = String(body.title ?? '').trim();
    const description = typeof body.description === 'string' ? body.description : '';
    const jobUrl = typeof body.jobUrl === 'string' ? body.jobUrl : '';
    const location = typeof body.location === 'string' ? body.location : '';
    const jobType = typeof body.jobType === 'string' ? body.jobType : '';
    const source = (body.source as string) ?? 'manual';

    // Debug logging
    strapi.log.info(`[outreach-email] Received webhook data:`, JSON.stringify({
      company,
      title,
      location,
      jobType,
      source,
      rawBody: body
    }, null, 2));

    if (!company || !title) return ctx.badRequest('company and title are required');

    // Webhook URLs: primary + optional fallback (ALT)
    const urls = [
      (process.env.OUTREACH_WEBHOOK_URL ?? '').trim(),
      (process.env.OUTREACH_WEBHOOK_URL_ALT ?? '').trim(),
    ].filter(Boolean);

    const secret = process.env.OUTREACH_WEBHOOK_SECRET;

    let recruiter: EmailBlock | null = null;
    let manager:   EmailBlock | null = null;

    const safeUrl = (raw?: string | null) => {
      try {
        if (!raw) return '(unset)';
        const u = new URL(raw);
        return `${u.origin}${u.pathname}`;
      } catch {
        return '(invalid URL)';
      }
    };

    // Fetch user data to include in webhook
    let userData = null;
    try {
      userData = await strapi.entityService.findOne('plugin::users-permissions.user', userId, {
        fields: ['preferredName', 'fullName', 'university', 'course'],
      } as any);
      strapi.log.info(`[outreach-email] Fetched user data for userId ${userId}:`, {
        preferredName: userData?.preferredName,
        fullName: userData?.fullName,
        university: userData?.university,
        course: userData?.course
      });
    } catch (userError) {
      strapi.log.warn(`[outreach-email] Failed to fetch user data for userId ${userId}:`, userError);
    }

    const callWebhook = async (url: string) =>
      fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(secret ? { 'x-outreach-secret': secret } : {}),
        },
        body: JSON.stringify({ 
          company, 
          title, 
          description, 
          jobUrl, 
          location, 
          jobType, 
          userId,
          fullName: userData?.fullName || null,
          university: userData?.university || null,
          course: userData?.course || null
        }),
      });

    try {
      if (!urls.length) throw new Error('Missing OUTREACH_WEBHOOK_URL');

      let parsed: any = null;

      for (const url of urls) {
        strapi.log.info(`[outreach] webhook try → ${safeUrl(url)}`);
        let resp = await callWebhook(url);

        // If someone accidentally points to a /webhook-test/ URL, try swapping to /webhook/ once.
        if (resp.status === 404 && url.includes('/webhook-test/')) {
          const prodUrl = url.replace('/webhook-test/', '/webhook/');
          strapi.log.warn(`[outreach] 404 on test URL, retrying production URL: ${prodUrl}`);
          resp = await callWebhook(prodUrl);
        }

        const rawText = await resp.text();
        strapi.log.info(`[outreach] webhook status ${resp.status} for ${safeUrl(url)}`);
        if (rawText) strapi.log.debug(`[outreach] webhook body (first 500): ${rawText.slice(0, 500)}`);

        if (resp.ok) {
          try { parsed = rawText ? JSON.parse(rawText) : null; } catch { parsed = null; }
          break; // success → stop trying other URLs
        }
      }

      if (parsed) {
        const asArray = Array.isArray(parsed?.emails) ? parsed.emails : [];
        const pick = (role: string) =>
          asArray.find((e: any) => String(e.role || '').toLowerCase() === role) || parsed?.[role];

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
      }
    } catch (err) {
      strapi.log.warn(
        `[outreach] webhook call failed: ${err instanceof Error ? err.message : String(err)}`
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
        location,
        jobType,
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
