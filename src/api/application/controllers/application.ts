import { factories } from '@strapi/strapi';

const STAGES = ['Saved', 'Phase1', 'Phase2', 'Assessment', 'Interview', 'Rejected', 'Offer'] as const;
type Stage = typeof STAGES[number];

export default factories.createCoreController('api::application.application', ({ strapi }) => ({
  // ---------- Owner-scoped READ (list) ----------
  async find(ctx) {
    const user = ctx.state.user;
    if (!user) return ctx.unauthorized();

    // Inject owner filter while preserving incoming filters
    ctx.query = ctx.query || {};
    const incomingFilters = (ctx.query as any).filters || {};
    (ctx.query as any).filters = { ...incomingFilters, owner: user.id };

    // Delegate to core controller with modified query
    // @ts-ignore super is provided by Strapi factory
    const { data, meta } = await super.find(ctx);
    return { data, meta };
  },

  // ---------- Owner-scoped READ (single) ----------
  async findOne(ctx) {
    const user = ctx.state.user;
    if (!user) return ctx.unauthorized();

    // @ts-ignore
    const entity = await super.findOne(ctx);
    const ownerId = (entity?.data?.attributes as any)?.owner?.data?.id;

    // Strapi core populate for relations on single may vary; enforce via raw lookup if needed:
    if (!ownerId) {
      const id = ctx.params.id;
      const record = await strapi.db.query('api::application.application').findOne({
        where: { id: Number(id) },
        populate: { owner: true }
      });
      if (!record || record.owner?.id !== user.id) return ctx.forbidden();
      return entity;
    }

    if (ownerId !== user.id) return ctx.forbidden();
    return entity;
  },

  // ---------- CREATE (force owner = current user) ----------
  async create(ctx) {
    const user = ctx.state.user;
    if (!user) return ctx.unauthorized();

    const body = ctx.request.body || {};
    body.data = body.data || {};
    // Always set owner to current user
    body.data.owner = user.id;

    // Optional: ignore stage if invalid
    if (body.data.stage && !STAGES.includes(body.data.stage)) {
      return ctx.badRequest('Invalid stage');
    }

    ctx.request.body = body;

    // @ts-ignore
    return await super.create(ctx);
  },

  // ---------- UPDATE (check owner) ----------
  async update(ctx) {
    const user = ctx.state.user;
    if (!user) return ctx.unauthorized();

    const id = ctx.params.id;
    const existing = await strapi.db.query('api::application.application').findOne({
      where: { id: Number(id) },
      populate: { owner: true }
    });
    if (!existing) return ctx.notFound();
    if (existing.owner?.id !== user.id) return ctx.forbidden();

    // Never allow changing owner manually
    if (ctx.request.body?.data?.owner) delete ctx.request.body.data.owner;

    // Validate stage
    const stage = ctx.request.body?.data?.stage;
    if (stage && !STAGES.includes(stage)) return ctx.badRequest('Invalid stage');

    // @ts-ignore
    return await super.update(ctx);
  },

  // ---------- DELETE (check owner) ----------
  async delete(ctx) {
    const user = ctx.state.user;
    if (!user) return ctx.unauthorized();

    const id = ctx.params.id;
    const existing = await strapi.db.query('api::application.application').findOne({
      where: { id: Number(id) },
      populate: { owner: true }
    });
    if (!existing) return ctx.notFound();
    if (existing.owner?.id !== user.id) return ctx.forbidden();

    // @ts-ignore
    return await super.delete(ctx);
  },

  // ---------- Custom: stats ----------
  async stats(ctx) {
    const user = ctx.state.user;
    if (!user) return ctx.unauthorized();

    const counts: Record<Stage, number> = {
      Saved: 0, Phase1: 0, Phase2: 0, Assessment: 0, Interview: 0, Rejected: 0, Offer: 0
    } as any;

    // count per stage
    await Promise.all(
      STAGES.map(async (s) => {
        counts[s] = await strapi.db.query('api::application.application').count({
          where: { owner: user.id, stage: s }
        });
      })
    );

    const total = Object.values(counts).reduce((a, b) => a + b, 0);

    // Donut-friendly mapping for your UI
    const donut = {
      total,
      phase1: counts.Phase1,
      phase2: counts.Phase2,
      assessment: counts.Assessment,
      interview: counts.Interview
    };

    ctx.body = { counts, donut };
  },

  // ---------- Custom: weekly ----------
  async weekly(ctx) {
    const user = ctx.state.user;
    if (!user) return ctx.unauthorized();

    // Start of current week (Monday 00:00) in server time
    const now = new Date();
    const day = now.getDay(); // 0=Sun..6=Sat
    const diffToMonday = (day + 6) % 7; // days since Monday
    const start = new Date(now);
    start.setHours(0, 0, 0, 0);
    start.setDate(start.getDate() - diffToMonday);

    const submittedThisWeek = await strapi.db.query('api::application.application').count({
      where: {
        owner: user.id,
        createdAt: { $gte: start.toISOString() }
      }
    });

    const verifiedThisWeek = await strapi.db.query('api::application.application').count({
      where: {
        owner: user.id,
        createdAt: { $gte: start.toISOString() },
        verified: true
      }
    });

    ctx.body = { submittedThisWeek, verifiedThisWeek, weekStartISO: start.toISOString() };
  },

  // ---------- Custom: transition ----------
  async transition(ctx) {
    const user = ctx.state.user;
    if (!user) return ctx.unauthorized();

    const id = Number(ctx.params.id);
    const { stage } = ctx.request.body || {};
    if (!stage || !STAGES.includes(stage)) return ctx.badRequest('Invalid or missing stage');

    const existing = await strapi.db.query('api::application.application').findOne({
      where: { id },
      populate: { owner: true }
    });
    if (!existing) return ctx.notFound();
    if (existing.owner?.id !== user.id) return ctx.forbidden();

    const updated = await strapi.entityService.update('api::application.application', id, {
      data: { stage }
    });

    ctx.body = { data: updated };
  },

  // ---------- Optional: dev-only verify via header ----------
  async verify(ctx) {
    const user = ctx.state.user;
    if (!user) return ctx.unauthorized();

    const secret = ctx.request.header['x-verify-secret'] || ctx.request.header['X-Verify-Secret'];
    if (!secret || secret !== process.env.VERIFY_SECRET) return ctx.forbidden('Bad verify secret');

    const id = Number(ctx.params.id);
    const existing = await strapi.db.query('api::application.application').findOne({
      where: { id },
      populate: { owner: true }
    });
    if (!existing) return ctx.notFound();
    if (existing.owner?.id !== user.id) return ctx.forbidden();

    const updated = await strapi.entityService.update('api::application.application', id, {
      data: { verified: true }
    });

    ctx.body = { data: updated };
  }
}));
