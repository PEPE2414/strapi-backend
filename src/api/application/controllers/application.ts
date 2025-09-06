import { factories } from '@strapi/strapi';

const STAGES = ['Saved', 'Phase1', 'Phase2', 'Assessment', 'Interview', 'Rejected', 'Offer'] as const;
type Stage = typeof STAGES[number];

function toData(entity: any) {
  return { id: entity.id, attributes: entity };
}

export default factories.createCoreController('api::application.application' as any, ({ strapi }) => ({

  // LIST (owner scoped)
  async find(ctx) {
    const userId = ctx.state?.jwtUserId;
    if (!userId) return ctx.unauthorized();

    const { page = 1, pageSize = 100 } = (ctx.query?.pagination as any) || {};
    const sort = (ctx.query?.sort as any) || ['deadline:asc', 'nextActionDate:asc'];

    const where = { ...(ctx.query as any)?.filters, owner: userId };

    const [results, total] = await Promise.all([
      strapi.db.query('api::application.application').findMany({
        where,
        orderBy: Array.isArray(sort)
          ? sort.map((s: string) => {
              const [field, dir] = s.split(':');
              return { [field]: (dir || 'asc') as 'asc' | 'desc' };
            })
          : undefined,
        limit: Number(pageSize),
        offset: (Number(page) - 1) * Number(pageSize),
      }),
      strapi.db.query('api::application.application').count({ where }),
    ]);

    ctx.body = {
      data: results.map(toData),
      meta: {
        pagination: {
          page: Number(page),
          pageSize: Number(pageSize),
          pageCount: Math.max(1, Math.ceil(total / Number(pageSize || 1))),
          total,
        },
      },
    };
  },

  // GET ONE (owner scoped)
  async findOne(ctx) {
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

  // CREATE (force owner)
  async create(ctx) {
    const userId = ctx.state?.jwtUserId;
    if (!userId) return ctx.unauthorized();

    const body = (ctx.request.body?.data || {}) as any;
    if (body.stage && !STAGES.includes(body.stage)) return ctx.badRequest('Invalid stage');

    const created = await strapi.entityService.create('api::application.application' as any, {
      data: { ...body, owner: userId },
    });

    ctx.body = { data: toData(created) };
  },

  // UPDATE (owner check)
  async update(ctx) {
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

    const updated = await strapi.entityService.update('api::application.application' as any, id, { data: patch });
    ctx.body = { data: toData(updated) };
  },

  // DELETE (owner check)
  async delete(ctx) {
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
  async stats(ctx) {
    const userId = ctx.state?.jwtUserId;
    if (!userId) return ctx.unauthorized();

    const counts: Record<Stage, number> = {
      Saved: 0,
      Phase1: 0,
      Phase2: 0,
      Assessment: 0,
      Interview: 0,
      Rejected: 0,
      Offer: 0,
    } as any;

    await Promise.all(
      STAGES.map(async (s) => {
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
  async weekly(ctx) {
    const userId = ctx.state?.jwtUserId;
    if (!userId) return ctx.unauthorized();

    const now = new Date();
    const day = now.getDay(); // 0=Sun..6=Sat
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
  async transition(ctx) {
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

    const updated = await strapi.entityService.update('api::application.application' as any, id, { data: { stage } });
    ctx.body = { data: toData(updated) };
  },

  // VERIFY (dev-only, optional)
  async verify(ctx) {
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

    const updated = await strapi.entityService.update('api::application.application' as any, id, { data: { verified: true } });
    ctx.body = { data: toData(updated) };
  },

  // DIAG (never throws)
  async whoami(ctx) {
    try {
      const authHeader = String(ctx.request.header?.authorization || ctx.request.header?.Authorization || '');
      const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
      let decodedId: any = null;
      if (token) {
        try {
          const parts = token.split('.');
          if (parts.length >= 2) {
            let b64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
            while (b64.length % 4) b64 += '=';
            const json = Buffer.from(b64, 'base64').toString('utf8');
            const payload = JSON.parse(json);
            decodedId = payload?.id ?? payload?.sub ?? payload?._id ?? null;
          }
        } catch {}
      }
      ctx.body = {
        hasAuthHeader: !!authHeader,
        hasBearer: !!token,
        decodedId,
        hasCtxUserId: ctx.state?.jwtUserId ?? null,
      };
    } catch (e: any) {
      ctx.body = { diagError: e?.message || 'whoami_error' };
    }
  },

}));
