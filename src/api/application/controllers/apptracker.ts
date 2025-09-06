// src/api/application/controllers/apptracker.ts
// Plain controller (no factories). Owner-scoped using ctx.state.jwtUserId.

const STAGES = ['Saved', 'Phase1', 'Phase2', 'Assessment', 'Interview', 'Rejected', 'Offer'] as const;
type Stage = typeof STAGES[number];

function orderByFromSort(sort: any): Record<string, 'asc' | 'desc'>[] {
  const arr = Array.isArray(sort) ? sort : (sort ? [sort] : []);
  return arr.map((s) => {
    if (typeof s !== 'string') return s as any;
    const [field, dir] = s.split(':');
    return { [field]: (dir || 'asc') as 'asc' | 'desc' };
  });
}

function toData(entity: any) {
  return { id: entity.id, attributes: entity };
}

export default {
  // LIST
  async find(ctx: any) {
    const userId = ctx.state?.jwtUserId;
    if (!userId) return ctx.unauthorized();

    const pagination = (ctx.query?.pagination || {}) as any;
    const page = Number(pagination.page || 1);
    const pageSize = Number(pagination.pageSize || 100);
    const sort = orderByFromSort(ctx.query?.sort || ['deadline:asc', 'nextActionDate:asc']);

    const where = { ...(ctx.query as any)?.filters, owner: userId };

    const [results, total] = await Promise.all([
      strapi.db.query('api::application.application').findMany({
        where,
        orderBy: sort,
        limit: pageSize,
        offset: (page - 1) * pageSize,
      }),
      strapi.db.query('api::application.application').count({ where }),
    ]);

    ctx.body = {
      data: results.map(toData),
      meta: {
        pagination: {
          page,
          pageSize,
          pageCount: Math.ceil(total / pageSize),
          total,
        },
      },
    };
  },

  // GET ONE
  async findOne(ctx: any) {
    const userId = ctx.state?.jwtUserId;
    if (!userId) return ctx.unauthorized();

    const id = Number(ctx.params.id);
    const entity = await strapi.db.query('api::application.application').findOne({
      where: { id, owner: userId },
      populate: { owner: true },
    });
    if (!entity) return ctx.notFound();
    ctx.body = { data: toData(entity) };
  },

  // CREATE
  async create(ctx: any) {
    const userId = ctx.state?.jwtUserId;
    if (!userId) return ctx.unauthorized();

    const body = (ctx.request.body?.data || {}) as any;
    if (body.stage && !STAGES.includes(body.stage)) return ctx.badRequest('Invalid stage');

    const created = await strapi.entityService.create('api::application.application' as any, {
      data: { ...body, owner: userId },
    });

    ctx.body = { data: toData(created) };
  },

  // UPDATE
  async update(ctx: any) {
    const userId = ctx.state?.jwtUserId;
    if (!userId) return ctx.unauthorized();

    const id = Number(ctx.params.id);
    const existing = await strapi.db.query('api::application.application').findOne({
      where: { id },
      populate: { owner: true },
    });
    if (!existing) return ctx.notFound();
    if (existing.owner?.id !== userId) return ctx.forbidden();

    const patch = (ctx.request.body?.data || {}) as any;
    if (patch.owner) delete patch.owner;
    if (patch.stage && !STAGES.includes(patch.stage)) return ctx.badRequest('Invalid stage');

    const updated = await strapi.entityService.update('api::application.application' as any, id, {
      data: patch,
    });

    ctx.body = { data: toData(updated) };
  },

  // DELETE
  async delete(ctx: any) {
    const userId = ctx.state?.jwtUserId;
    if (!userId) return ctx.unauthorized();

    const id = Number(ctx.params.id);
    const existing = await strapi.db.query('api::application.application').findOne({
      where: { id },
      populate: { owner: true },
    });
    if (!existing) return ctx.notFound();
    if (existing.owner?.id !== userId) return ctx.forbidden();

    const deleted = await strapi.entityService.delete('api::application.application' as any, id);
    ctx.body = { data: toData(deleted) };
  },

  // STATS
  async stats(ctx: any) {
    const userId = ctx.state?.jwtUserId;
    if (!userId) return ctx.unauthorized();

    const counts: Record<Stage, number> = {
      Saved: 0, Phase1: 0, Phase2: 0, Assessment: 0, Interview: 0, Rejected: 0, Offer: 0,
    } as any;

    await Promise.all(
      (STAGES as readonly Stage[]).map(async (s) => {
        counts[s] = await strapi.db.query('api::application.application').count({
          where: { owner: userId, stage: s },
        });
      })
    );

    const total = Object.values(counts).reduce((a, b) => a + b, 0);
    const donut = {
      total,
      phase1: counts.Phase1,
      phase2: counts.Phase2,
      assessment: counts.Assessment,
      interview: counts.Interview,
    };

    ctx.body = { counts, donut };
  },

  // WEEKLY
  async weekly(ctx: any) {
    const userId = ctx.state?.jwtUserId;
    if (!userId) return ctx.unauthorized();

    const now = new Date();
    const day = now.getDay();
    const diffToMonday = (day + 6) % 7;
    const start = new Date(now);
    start.setHours(0, 0, 0, 0);
    start.setDate(start.getDate() - diffToMonday);

    const submittedThisWeek = await strapi.db.query('api::application.application').count({
      where: { owner: userId, createdAt: { $gte: start.toISOString() } },
    });

    const verifiedThisWeek = await strapi.db.query('api::application.application').count({
      where: { owner: userId, createdAt: { $gte: start.toISOString() }, verified: true },
    });

    ctx.body = { submittedThisWeek, verifiedThisWeek, weekStartISO: start.toISOString() };
  },

  // TRANSITION
  async transition(ctx: any) {
    const userId = ctx.state?.jwtUserId;
    if (!userId) return ctx.unauthorized();

    const id = Number(ctx.params.id);
    const { stage } = (ctx.request.body || {}) as any;
    if (!stage || !STAGES.includes(stage)) return ctx.badRequest('Invalid or missing stage');

    const existing = await strapi.db.query('api::application.application').findOne({
      where: { id },
      populate: { owner: true },
    });
    if (!existing) return ctx.notFound();
    if (existing.owner?.id !== userId) return ctx.forbidden();

    const updated = await strapi.entityService.update('api::application.application' as any, id, {
      data: { stage },
    });

    ctx.body = { data: toData(updated) };
  },

  // ✅ VERIFY (dev-only, optional; needed because route exists)
  async verify(ctx: any) {
    const userId = ctx.state?.jwtUserId;
    if (!userId) return ctx.unauthorized();

    const secret = (ctx.request.header['x-verify-secret'] || ctx.request.header['X-Verify-Secret']) as string | undefined;
    if (!secret || secret !== process.env.VERIFY_SECRET) return ctx.forbidden('Bad verify secret');

    const id = Number(ctx.params.id);
    const existing = await strapi.db.query('api::application.application').findOne({
      where: { id },
      populate: { owner: true },
    });
    if (!existing) return ctx.notFound();
    if (existing.owner?.id !== userId) return ctx.forbidden();

    const updated = await strapi.entityService.update('api::application.application' as any, id, {
      data: { verified: true },
    });

    ctx.body = { data: toData(updated) };
  },

  // WHOAMI diag
  async whoami(ctx: any) {
    try {
      const authHeader = String(ctx.request.header?.authorization || ctx.request.header?.Authorization || '');
      const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;

      let decodedId: any = null;
      if (token) {
        try {
          let b64 = token.split('.')[1]?.replace(/-/g, '+').replace(/_/g, '/');
          while (b64 && b64.length % 4) b64 += '=';
          const json = b64 ? Buffer.from(b64, 'base64').toString('utf8') : '';
          const payload = json ? JSON.parse(json) : {};
          decodedId = payload?.id ?? payload?.sub ?? payload?._id ?? null;
        } catch {}
      }

      ctx.body = {
        hasAuthHeader: !!authHeader,
        hasBearer: !!token,
        decodedId: decodedId ?? null,
        hasCtxUserId: ctx.state?.jwtUserId ?? null,
      };
    } catch (e: any) {
      ctx.body = { diagError: e?.message || 'whoami_error' };
    }
  },
};
