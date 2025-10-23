// src/api/outreach-email/controllers/outreach-email.ts
import { factories } from '@strapi/strapi';
import type { UID } from '@strapi/types';

const OUTREACH_UID = 'api::outreach-email.outreach-email' as UID.ContentType;

type EmailBlock = {
  email?: string | null;
  confidence?: number | null;
  message?: string | null;
  linkedinUrl?: string | null;
  linkedinConfidence?: number | null;
  linkedinMessage?: string | null;
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

    // Generate unique ID for this request
    const requestId = `outreach_${userId}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const callWebhook = async (url: string) =>
      fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(secret ? { 'x-outreach-secret': secret } : {}),
        },
        body: JSON.stringify({ 
          requestId,
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
          
          // Email data
          const emailConf =
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

          // LinkedIn data
          const linkedinUrl =
            typeof e['LinkedIn URL'] === 'string' && e['LinkedIn URL'].trim() 
              ? e['LinkedIn URL'].trim() 
              : null;

          const linkedinConf =
            typeof e.linkedinConfidence === 'number'
              ? e.linkedinConfidence
              : typeof e.linkedinConfidence === 'string'
              ? parseFloat(e.linkedinConfidence)
              : null;

          const linkedinMessage =
            typeof e.linkedinMessage === 'string'
              ? e.linkedinMessage
              : '';

          return { 
            email, 
            confidence: Number.isFinite(emailConf as number) ? emailConf! : null, 
            message,
            linkedinUrl,
            linkedinConfidence: Number.isFinite(linkedinConf as number) ? linkedinConf! : null,
            linkedinMessage
          };
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
        requestId,
        company,
        title,
        description,
        jobUrl,
        location,
        jobType,
        source,
        // Email data
        recruiterEmail: recruiter?.email ?? null,
        recruiterConfidence: recruiter?.confidence ?? null,
        recruiterMessage: recruiter?.message || defaultMsg,
        managerEmail: manager?.email ?? null,
        managerConfidence: manager?.confidence ?? null,
        managerMessage: manager?.message || defaultMsg,
        // LinkedIn data
        recruiterLinkedInUrl: recruiter?.linkedinUrl ?? null,
        recruiterLinkedInConfidence: recruiter?.linkedinConfidence ?? null,
        recruiterLinkedInMessage: recruiter?.linkedinMessage || '',
        managerLinkedInUrl: manager?.linkedinUrl ?? null,
        managerLinkedInConfidence: manager?.linkedinConfidence ?? null,
        managerLinkedInMessage: manager?.linkedinMessage || '',
      } as any,
    } as any);

    ctx.set('x-outreach-webhook', recruiter || manager ? 'ok' : 'fallback');
    ctx.body = created;
  },

  async uploadResults(ctx) {
    const body = (ctx.request.body ?? {}) as Record<string, unknown>;
    const requestId = String(body.requestId ?? '').trim();
    
    if (!requestId) {
      return ctx.badRequest('requestId is required');
    }

    strapi.log.info(`[outreach-email] Received results upload for requestId: ${requestId}`);

    // Find the existing record by requestId
    const existingRecord = await strapi.entityService.findMany(OUTREACH_UID, {
      filters: { requestId } as any,
      limit: 1,
    } as any);

    if (!existingRecord || existingRecord.length === 0) {
      strapi.log.warn(`[outreach-email] No record found for requestId: ${requestId}`);
      return ctx.notFound('No record found for this request ID');
    }

    const record = existingRecord[0];
    const recordId = record.id;

    // Parse the results from n8n
    const recruiter = body.recruiter as any;
    const manager = body.manager as any;

    const norm = (e: any): EmailBlock | null => {
      if (!e) return null;
      
      // Email data
      const emailConf =
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

      // LinkedIn data
      const linkedinUrl =
        typeof e['LinkedIn URL'] === 'string' && e['LinkedIn URL'].trim() 
          ? e['LinkedIn URL'].trim() 
          : null;

      const linkedinConf =
        typeof e.linkedinConfidence === 'number'
          ? e.linkedinConfidence
          : typeof e.linkedinConfidence === 'string'
          ? parseFloat(e.linkedinConfidence)
          : null;

      const linkedinMessage =
        typeof e.linkedinMessage === 'string'
          ? e.linkedinMessage
          : '';

      return { 
        email, 
        confidence: Number.isFinite(emailConf as number) ? emailConf! : null, 
        message,
        linkedinUrl,
        linkedinConfidence: Number.isFinite(linkedinConf as number) ? linkedinConf! : null,
        linkedinMessage
      };
    };

    const recruiterData = norm(recruiter);
    const managerData = norm(manager);

    // Update the record with the new data
    const updated = await strapi.entityService.update(OUTREACH_UID, recordId, {
      data: {
        // Email data
        recruiterEmail: recruiterData?.email ?? null,
        recruiterConfidence: recruiterData?.confidence ?? null,
        recruiterMessage: recruiterData?.message || (record as any).recruiterMessage,
        managerEmail: managerData?.email ?? null,
        managerConfidence: managerData?.confidence ?? null,
        managerMessage: managerData?.message || (record as any).managerMessage,
        // LinkedIn data
        recruiterLinkedInUrl: recruiterData?.linkedinUrl ?? null,
        recruiterLinkedInConfidence: recruiterData?.linkedinConfidence ?? null,
        recruiterLinkedInMessage: recruiterData?.linkedinMessage || '',
        managerLinkedInUrl: managerData?.linkedinUrl ?? null,
        managerLinkedInConfidence: managerData?.linkedinConfidence ?? null,
        managerLinkedInMessage: managerData?.linkedinMessage || '',
      } as any,
    } as any);

    strapi.log.info(`[outreach-email] Updated record ${recordId} with results for requestId: ${requestId}`);
    
    ctx.body = { success: true, recordId };
  },
}));
