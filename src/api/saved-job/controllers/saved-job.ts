import { factories } from '@strapi/strapi';

export default factories.createCoreController('api::saved-job.saved-job' as any, ({ strapi }) => ({

  // LIST (owner scoped)
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

  // GET ONE (owner scoped)
  async findOne(ctx) {
    const userId = ctx.state?.jwtUserId;
    if (!userId) return ctx.unauthorized();

    // @ts-ignore
    const entity = await super.findOne(ctx);

    const id = Number(ctx.params.id);
    const existing = await strapi.db.query('api::saved-job.saved-job').findOne({
      where: { id },
      populate: { owner: true }
    });
    if (!existing) return ctx.notFound();
    if (existing.owner?.id !== userId) return ctx.forbidden();

    return entity;
  },

  // CREATE (force owner)
  async create(ctx) {
    const userId = ctx.state?.jwtUserId;
    if (!userId) return ctx.unauthorized();

    const body = ctx.request.body || {};
    body.data = { ...(body.data || {}), owner: userId };
    ctx.request.body = body;

    // @ts-ignore
    return await super.create(ctx);
  },

  // UPDATE (owner check)
  async update(ctx) {
    const userId = ctx.state?.jwtUserId;
    if (!userId) return ctx.unauthorized();

    const id = Number(ctx.params.id);
    const existing = await strapi.db.query('api::saved-job.saved-job').findOne({
      where: { id },
      populate: { owner: true }
    });
    if (!existing) return ctx.notFound();
    if (existing.owner?.id !== userId) return ctx.forbidden();

    if (ctx.request.body?.data?.owner) delete ctx.request.body.data.owner;

    // @ts-ignore
    return await super.update(ctx);
  },

  // DELETE (owner check)
  async delete(ctx) {
    const userId = ctx.state?.jwtUserId;
    if (!userId) return ctx.unauthorized();

    const id = Number(ctx.params.id);
    const existing = await strapi.db.query('api::saved-job.saved-job').findOne({
      where: { id },
      populate: { owner: true }
    });
    if (!existing) return ctx.notFound();
    if (existing.owner?.id !== userId) return ctx.forbidden();

    // @ts-ignore
    return await super.delete(ctx);
  },

}));
