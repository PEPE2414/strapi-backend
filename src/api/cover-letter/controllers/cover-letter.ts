// src/api/cover-letter/controllers/cover-letter.ts
import { errors } from '@strapi/utils';
const { UnauthorizedError, NotFoundError, ValidationError } = errors;

const sanitizeFile = (f: any) =>
  f
    ? { id: f.id, name: f.name, url: f.url, size: f.size, mime: f.mime, updatedAt: f.updatedAt }
    : null;

const sanitize = (e: any) => {
  if (!e) return null;
  const a = e; // entityService returns plain objects
  return {
    id: a.id,
    title: a.title,
    company: a.company,
    description: a.description,
    source: a.source,
    status: a.status,
    savedJobId: a.savedJobId || null,
    file: sanitizeFile(a.file),
    user: a.user ? { id: a.user.id, email: a.user.email } : null,
    createdAt: a.createdAt,
    updatedAt: a.updatedAt,
  };
};

export default {
  // GET /api/cover-letters  (current user's)
  async find(ctx) {
    const user = ctx.state.user;
    if (!user) throw new UnauthorizedError();

    const rows = await strapi.entityService.findMany('api::cover-letter.cover-letter', {
      filters: { user: user.id },
      sort: { createdAt: 'desc' },
      populate: { file: true, user: true },
    });

    ctx.body = { data: rows.map(sanitize) };
  },

  // GET /api/cover-letters/:id (owner only)
  async findOne(ctx) {
    const user = ctx.state.user;
    if (!user) throw new UnauthorizedError();

    const id = Number(ctx.params.id);
    const row = await strapi.entityService.findOne('api::cover-letter.cover-letter', id, {
      populate: { file: true, user: true },
    });
    if (!row || row.user?.id !== user.id) throw new NotFoundError();
    ctx.body = { data: sanitize(row) };
  },

  // POST /api/cover-letters/generate  (creates pending + optional webhook forward)
  async generate(ctx) {
    const user = ctx.state.user;
    if (!user) throw new UnauthorizedError();

    const { title, company, description, source = 'manual', savedJobId } = ctx.request.body || {};
    if (!title || !company || !description) throw new ValidationError('Missing title/company/description');

    // Create pending entry
    const created = await strapi.entityService.create('api::cover-letter.cover-letter', {
      data: {
        title: String(title).trim(),
        company: String(company).trim(),
        description: String(description).trim(),
        source,
        status: 'pending',
        savedJobId: savedJobId ? String(savedJobId) : null,
        user: user.id,
      },
      populate: { file: true, user: true },
    });

    // Optional: forward to external webhook (n8n/zap/etc)
    const url = process.env.COVERLETTER_WEBHOOK_URL;
    const secret = process.env.COVERLETTER_WEBHOOK_SECRET;
    if (url) {
      try {
        // include helpful context for n8n
        const me = await strapi.entityService.findOne('plugin::users-permissions.user', user.id, {
          populate: { cvFile: true },
        });

        await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(secret ? { 'x-cl-secret': secret } : {}),
          },
          body: JSON.stringify({
            coverLetterId: created.id,
            userId: user.id,
            title: created.title,
            company: created.company,
            description: created.description,
            source: created.source,
            savedJobId: created.savedJobId || null,
            // optional extras for your flow:
            cvUrl: me?.cvFile?.url || null,
            points: Array.isArray(me?.coverLetterPoints) ? me.coverLetterPoints : [],
          }),
        });
      } catch (e) {
        // Don’t fail the request; user can still see “pending”
        strapi.log.warn(`[cover-letter.generate] webhook forward failed: ${e}`);
      }
    }

    ctx.body = { data: sanitize(created) };
  },

  // POST /api/cover-letters/:id/complete
  // Accepts either:
  //  - secret header x-cl-secret === COVERLETTER_WEBHOOK_SECRET  (n8n/server)
  //  - OR authenticated user who owns the record
  // Body: { status: 'ready'|'failed', fileId?: number, title?: string, company?: string }
  async complete(ctx) {
    const secret = ctx.request.headers['x-cl-secret'];
    const serverOK = secret && process.env.COVERLETTER_WEBHOOK_SECRET && secret === process.env.COVERLETTER_WEBHOOK_SECRET;

    let userId: number | null = null;
    if (!serverOK) {
      const user = ctx.state.user;
      if (!user) throw new UnauthorizedError();
      userId = user.id;
    }

    const id = Number(ctx.params.id);
    const row = await strapi.entityService.findOne('api::cover-letter.cover-letter', id, {
      populate: { file: true, user: true },
    });
    if (!row) throw new NotFoundError();
    if (!serverOK && row.user?.id !== userId) throw new UnauthorizedError();

    const { status, fileId, title, company } = ctx.request.body || {};
    if (!status || !['ready', 'failed', 'pending'].includes(status)) {
      throw new ValidationError('Invalid status');
    }

    // If fileId provided, make sure it exists
    if (fileId) {
      const f = await strapi.entityService.findOne('plugin::upload.file', Number(fileId));
      if (!f) throw new ValidationError('fileId not found');
    }

    const updated = await strapi.entityService.update('api::cover-letter.cover-letter', id, {
      data: {
        status,
        ...(fileId ? { file: Number(fileId) } : {}),
        ...(title ? { title: String(title).trim() } : {}),
        ...(company ? { company: String(company).trim() } : {}),
      },
      populate: { file: true, user: true },
    });

    ctx.body = { data: sanitize(updated) };
  },
};
