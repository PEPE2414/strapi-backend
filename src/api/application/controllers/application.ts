import { factories } from '@strapi/strapi';

const STAGES = ['Saved', 'Phase1', 'Phase2', 'Assessment', 'Interview', 'Rejected', 'Offer'] as const;
type Stage = typeof STAGES[number];

export default factories.createCoreController('api::application.application' as any, ({ strapi }) => ({

  // ---------- LIST (owner scoped) ----------
  async find(ctx) {
    const userId = ctx.state?.jwtUserId;
    if (!userId) return ctx.unauthorized();

    ctx.query = ctx.query || {};
    const incomingFilters = (ctx.query as any).filters || {};
    (ctx.query as any).filters = { ...incomingFilters, owner: userId };

    // @ts-ignore
    const { data, meta } = await super.find(ctx);
    return { data, meta };
  },

  // ---------- GET ONE (owner scoped) ----------
  async findOne(ctx) {
    const userId = ctx.state?.jwtUserId;
    if (!userId) return ctx.unauthorized();

    // @ts-ignore
    const entity = await super.findOne(ctx);

    const id = Number(ctx.params.id);
    const existing = await strapi.db.query('api::application.application').findOne({
      where: { id },
      populate: { owner: true }
    });
    if (!existing) return ctx.notFound();
    if (existing.owner?.id !== userId) return ctx.forbidden();

    return entity;
  },

  // ---------- CREATE (force owner) ----------
  async create(ctx) {
    const userId = ctx.state?.jwtUserId;
    if (!userId) return ctx.unauthorized();

    const body = ctx.request.body || {};
    body.data = body.data || {};
    body.data.owner = userId;

    if (body.data.stage && !STAGES.includes(body.data.stage)) {
      return ctx.badRequest('Invalid stage');
    }

    ctx.request.body = body;
    // @ts-ignore
    return await super.create(ctx);
  },

  // ---------- UPDATE (owner check) ----------
  async update(ctx) {
    const userId = ctx.state?.jwtUserId;
    if (!userId) return ctx.unauthorized();

    const id = Number(ctx.params.id);
    const existing = await strapi.db.query('api::application.application').findOne({
      where: { id },
      populate: { owner: true }
    });
    if (!existing) return ctx.notFound();
    if (existing.owner?.id !== userId) return ctx.forbidden();

    if (ctx.request.body?.data?.owner) delete ctx.request.body.data.owner;

    const stage = ctx.request.body?.data?.stage;
    if (stage && !STAGES.includes(stage)) return ctx.badRequest('Invalid stage');

    // @ts-ignore
    return await super.update(ctx);
  },

  // ---------- DELETE (owner check) ----------
  async delete(ctx) {
    const userId = ctx.state?.jwtUserId;
    if (!userId) return ctx.unauthorized();

    const id = Number(ctx.params.id);
    const existing = await strapi.db.query('api::application.application').findOne({
      where: { id },
      populate: { owner: true }
    });
    if (!existing) return ctx.notFound();
    if (existing.owner?.id !== userId) return ctx.forbidden();

    // @ts-ignore
    return await super.delete(ctx);
  },

  // ---------- STATS ----------
  async stats(ctx) {
    const userId = ctx.state?.jwtUserId;
    if (!userId) return ctx.unauthorized();

    const counts: Record<Stage, number> = {
      Saved: 0, Phase1: 0, Phase2: 0, Assessment: 0, Interview: 0, Rejected: 0, Offer: 0
    } as any;

    await Promise.all(
      STAGES.map(async (s) => {
        counts[s] = await strapi.db.query('api::application.application').count({
          where: { owner: userId, stage: s }
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

  // ---------- WEEKLY ----------
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
      where: { owner: userId, createdAt: { $gte: start.toISOString() } }
    });

    const verifiedThisWeek = await strapi.db.query('api::application.application').count({
      where: { owner: userId, createdAt: { $gte: start.toISOString() }, verified: true }
    });

    ctx.body = { submittedThisWeek, verifiedThisWeek, weekStartISO: start.toISOString() };
  },

  // ---------- TRANSITION ----------
  async transition(ctx) {
    const userId = ctx.state?.jwtUserId;
    if (!userId) return ctx.unauthorized();

    const id = Number(ctx.params.id);
    const { stage } = ctx.request.body || {};
    if (!stage || !STAGES.includes(stage)) return ctx.badRequest('Invalid or missing stage');

    const existing = await strapi.db.query('api::application.application').findOne({
      where: { id },
      populate: { owner: true }
    });
    if (!existing) return ctx.notFound();
    if (existing.owner?.id !== userId) return ctx.forbidden();

    const updated = await strapi.entityService.update(
      'api::application.application' as any,
      id,
      { data: { stage } }
    );

    ctx.body = { data: updated };
  },

  // ---------- VERIFY (dev-only, optional) ----------
  async verify(ctx) {
    const userId = ctx.state?.jwtUserId;
    if (!userId) return ctx.unauthorized();

    const secret = (ctx.request.header['x-verify-secret'] || ctx.request.header['X-Verify-Secret']) as string | undefined;
    if (!secret || secret !== process.env.VERIFY_SECRET) return ctx.forbidden('Bad verify secret');

    const id = Number(ctx.params.id);
    const existing = await strapi.db.query('api::application.application').findOne({
      where: { id },
      populate: { owner: true }
    });
    if (!existing) return ctx.notFound();
    if (existing.owner?.id !== userId) return ctx.forbidden();

    const updated = await strapi.entityService.update(
      'api::application.application' as any,
      id,
      { data: { verified: true } }
    );

    ctx.body = { data: updated };
  },

  // ---------- DIAG (never throws) ----------
  async whoami(ctx) {
    try {
      const authHeader = String(ctx.request.header?.authorization || ctx.request.header?.Authorization || '');
      const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;

      const decodedId = (() => {
        try {
          if (!token) return null;
          const parts = token.split('.');
          if (parts.length < 2) return null;
          const json = Buffer.from(parts[1], 'base64url').toString('utf8');
          const payload = JSON.parse(json);
          return payload?.id ?? payload?.sub ?? payload?._id ?? null;
        } catch { return null; }
      })();

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

}));
