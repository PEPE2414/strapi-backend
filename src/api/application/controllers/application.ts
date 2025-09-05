import { factories } from '@strapi/strapi';
import { ensureUserOnCtx } from '../../../utils/auth/get-user';


const STAGES = ['Saved', 'Phase1', 'Phase2', 'Assessment', 'Interview', 'Rejected', 'Offer'] as const;
type Stage = typeof STAGES[number];

export default factories.createCoreController('api::application.application' as any, ({ strapi }) => ({
  // ---------- Owner-scoped READ (list) ----------
  async find(ctx) {
    const user = await ensureUserOnCtx(ctx, strapi);
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
    const user = await ensureUserOnCtx(ctx, strapi);
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
    const user = await ensureUserOnCtx(ctx, strapi);
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
    const user = await ensureUserOnCtx(ctx, strapi);
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
    const user = await ensureUserOnCtx(ctx, strapi);
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
    const user = await ensureUserOnCtx(ctx, strapi);
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
    const user = await ensureUserOnCtx(ctx, strapi);
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
      const user = await ensureUserOnCtx(ctx, strapi);
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

      const updated = await strapi.entityService.update(
        'api::application.application' as any,  // ⟵ cast here
        id,
        { data: { stage } }
      );

      ctx.body = { data: updated };
    },

  // ---------- Optional: dev-only verify via header ----------
    async verify(ctx) {
      const user = await ensureUserOnCtx(ctx, strapi);
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

      const updated = await strapi.entityService.update(
        'api::application.application' as any,  // ⟵ cast here
        id,
        { data: { verified: true } }
      );

      ctx.body = { data: updated };
    },
 // Diagnostic: never throws, never 401/403
  async whoami(ctx) {
    try {
      const authHeader = String(ctx.request.header?.authorization || ctx.request.header?.Authorization || '');
      const hasAuthHeader = !!authHeader;
      const bearerToken = hasAuthHeader && authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;

      // Resolve the plugin jwt service (v5-compatible)
      const jwtService =
        (strapi as any).service?.('plugin::users-permissions.jwt') ??
        (strapi as any).plugin?.('users-permissions')?.service?.('jwt') ??
        (strapi as any).plugins?.['users-permissions']?.services?.jwt;

      let verifyOk = false;
      let userId: number | string | null = null;
      let reason: string | null = null;

      if (bearerToken && jwtService?.verify) {
        try {
          const payload = await jwtService.verify(bearerToken);
          userId = (payload?.id ?? payload?.sub ?? (payload as any)?._id) || null;
          verifyOk = !!userId;
        } catch (e: any) {
          reason = e?.message || 'verify_failed';
        }
      } else if (!bearerToken) {
        reason = 'no_bearer_token';
      } else {
        reason = 'jwt_service_unavailable';
      }

      ctx.body = {
        hasAuthHeader,
        verifyOk,
        userId,
        reason,
        // for sanity: report if global middleware already populated ctx.state.user
        hasCtxUser: !!ctx.state?.user,
      };
    } catch (e: any) {
      // absolutely never 500 here
      ctx.body = { diagError: e?.message || 'whoami_unexpected_error' };
    }
  },

}));
