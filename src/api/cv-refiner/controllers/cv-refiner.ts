import type { Context } from 'koa';

async function extractTextFromFileId(fileId: number): Promise<string> {
  const f = await strapi.entityService.findOne('plugin::upload.file', fileId);
  if (!f) throw new Error('file_not_found');

  const mime = String(f.mime || '').toLowerCase();
  const ext = String(f.ext || '').toLowerCase();

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
      const path = url.startsWith('http') ? new URL(url).pathname : url;
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
    // @ts-ignore
    const bytes = await out.Body?.transformToByteArray();
    if (bytes) buf = Buffer.from(bytes);
  } catch (e: any) {
    strapi.log.warn('[cv-refiner] S3 fetch failed, fallback to HTTP: ' + e?.message);
  }

  if (!buf) {
    const url = String(f.url || '');
    if (!url.startsWith('http')) throw new Error('no_absolute_url_for_http_fetch');
    const res = await fetch(url);
    const ab = await res.arrayBuffer();
    buf = Buffer.from(ab);
  }

  let text = '';
  try {
    if (ext === '.pdf' || mime === 'application/pdf' || mime === 'application/x-pdf') {
      const pdfMod = await import('pdf-parse');
      const pdfParse: any = (pdfMod as any).default || (pdfMod as any);
      const out = await pdfParse(buf);
      text = (out?.text || '').trim();
    } else if (ext === '.docx' || mime === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
      const mmMod = await import('mammoth');
      const mammoth: any = (mmMod as any).default || (mmMod as any);
      const out = await mammoth.extractRawText({ buffer: buf });
      text = (out?.value || '').trim();
    }
  } catch (e: any) {
    strapi.log.warn('[cv-refiner] extraction error: ' + e?.message);
  }
  return text || '';
}

export default {
  async refine(ctx: Context) {
    // Manual JWT verification (auth: false bypasses built-in auth)
    const authHeader = ctx.request.header.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return ctx.unauthorized('Authentication required');
    }
    
    const token = authHeader.slice(7);
    let auth = null;
    
    try {
      const jwtService = strapi.plugin('users-permissions').service('jwt');
      auth = await jwtService.verify(token);
    } catch (jwtError) {
      return ctx.unauthorized('Invalid token');
    }
    
    if (!auth || !auth.id) {
      return ctx.unauthorized('Authentication required');
    }

    const body = ctx.request.body || {};
    const source = String(body.source || 'paste');
    const industry = String(body.industry || '');
    const subrole = String(body.subrole || '');
    const tangible = String(body.tangible || '');
    const structure = String(body.structure || '');
    const sections = body.sections || {};
    const preferConcise = Boolean(body.preferConcise);
    const quantify = Boolean(body.quantify);
    const showDiff = Boolean(body.showDiff !== false); // default true
    const coverLetterFileIds = Array.isArray(body.coverLetterFileIds) ? body.coverLetterFileIds.filter((id: any) => typeof id === 'number' && id > 0) : [];

    let cvText: string | undefined = undefined;
    let cvSections: any = undefined;

    if (source === 'upload') {
      const fileId = Number(body.fileId);
      if (!fileId) return ctx.badRequest('fileId required for upload source');
      cvText = await extractTextFromFileId(fileId);
      if (!cvText) return ctx.badRequest('No extractable text in uploaded file');
    } else {
      // Paste source: accept separate sections
      const email = String(body.email || '').trim();
      const linkedIn = String(body.linkedIn || '').trim();
      const phone = String(body.phone || '').trim();
      const summary = String(body.summary || '').trim();
      const experience = String(body.experience || '').trim();
      const education = String(body.education || '').trim();
      const skills = String(body.skills || '').trim();
      const otherDetails = String(body.otherDetails || '').trim();

      // Check if at least one section has content
      const hasContent = email || linkedIn || phone || summary || experience || education || skills || otherDetails;
      if (!hasContent) {
        return ctx.badRequest('At least one CV section is required');
      }

      // Store sections separately for webhook
      cvSections = {
        email: email || undefined,
        linkedIn: linkedIn || undefined,
        phone: phone || undefined,
        summary: summary || undefined,
        experience: experience || undefined,
        education: education || undefined,
        skills: skills || undefined,
        otherDetails: otherDetails || undefined,
      };
    }

    const webhook = process.env.CV_N8N_WEBHOOK_URL;
    if (!webhook) return ctx.badRequest('Webhook not configured');

    try {
      // Create pending record on user.cvRefineResults
      const requestId = Math.random().toString(36).slice(2) + Date.now();
      try {
        const me = await strapi.entityService.findOne('plugin::users-permissions.user', auth.id, { fields: ['id', 'cvRefineResults'] });
        const list = Array.isArray((me as any)?.cvRefineResults) ? (me as any).cvRefineResults : [];
        const item = { id: requestId, status: 'pending', createdAt: new Date().toISOString(), industry, subrole };
        await strapi.entityService.update('plugin::users-permissions.user', auth.id, { data: { cvRefineResults: [...list, item] } });
      } catch (e: any) {
        strapi.log.warn('[cv-refiner] failed to create pending entry: ' + e?.message);
      }

      // Prepare webhook payload - send cvText for upload, cvSections for paste
      const webhookPayload: any = {
        userId: auth.id,
        requestId,
        industry,
        subrole,
        tangible,
        structure,
        sections,
        preferConcise,
        quantify,
        showDiff,
        meta: {
          source: source,
          userEmail: auth.email,
          callbackUrl: (process.env.PUBLIC_API_URL || process.env.API_URL || '') + '/api/cv-refiner/complete',
          callbackSecret: process.env.CV_REFINE_WEBHOOK_SECRET || ''
        }
      };

      if (source === 'upload') {
        webhookPayload.cvText = cvText;
      } else {
        webhookPayload.cvSections = cvSections;
      }

      // Extract text from cover letter files if provided
      if (coverLetterFileIds.length > 0) {
        webhookPayload.coverLetterFileIds = coverLetterFileIds;
        try {
          const coverLetterTexts: string[] = [];
          for (const fileId of coverLetterFileIds) {
            try {
              const text = await extractTextFromFileId(fileId);
              if (text) {
                coverLetterTexts.push(text);
              }
            } catch (e: any) {
              strapi.log.warn(`[cv-refiner] Failed to extract text from cover letter file ${fileId}: ${e?.message}`);
            }
          }
          if (coverLetterTexts.length > 0) {
            webhookPayload.coverLetterTexts = coverLetterTexts;
          }
        } catch (e: any) {
          strapi.log.warn(`[cv-refiner] Failed to extract cover letter texts: ${e?.message}`);
        }
      }

      const res = await fetch(webhook, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(webhookPayload),
      });
      const ok = res.ok;
      let payload: any = null;
      try { payload = await res.json(); } catch { payload = { status: res.status }; }
      ctx.body = { ok, data: { requestId, ...payload } };
    } catch (e: any) {
      strapi.log.error('[cv-refiner] webhook call failed: ' + e?.message);
      ctx.throw(500, 'Webhook call failed');
    }
  },
  async me(ctx: Context) {
    // Manual JWT verification (auth: false bypasses built-in auth)
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
    
    const me = await strapi.entityService.findOne('plugin::users-permissions.user', user.id, { fields: ['id', 'cvRefineResults'] });
    const list = Array.isArray((me as any)?.cvRefineResults) ? (me as any).cvRefineResults : [];
    ctx.body = { results: list };
  },
  async complete(ctx: Context) {
    const secret = ctx.request.headers['x-cl-secret'] || ctx.request.headers['x-webhook-secret'] || ctx.request.query.secret || (ctx.request.body && (ctx.request.body.secret || ctx.request.body.meta?.callbackSecret));
    if (!secret || String(secret) !== String(process.env.CV_REFINE_WEBHOOK_SECRET || '')) {
      return ctx.unauthorized('Invalid secret');
    }
    const b = ctx.request.body || {};
    const userId = Number(b.userId);
    const requestId = String(b.requestId || '');
    if (!userId || !requestId) return ctx.badRequest('userId and requestId required');

    const me = await strapi.entityService.findOne('plugin::users-permissions.user', userId, { fields: ['id', 'cvRefineResults'] });
    const list = Array.isArray((me as any)?.cvRefineResults) ? (me as any).cvRefineResults : [];
    const updated = list.map((it: any) => it.id === requestId ? { ...it, status: 'ready', completedAt: new Date().toISOString(), content: b.content || b.result || {}, summary: b.summary || '', keywordsMatched: b.keywordsMatched || 0, edits: b.edits || 0 } : it);
    await strapi.entityService.update('plugin::users-permissions.user', userId, { data: { cvRefineResults: updated } });
    ctx.body = { ok: true };
  }
};


