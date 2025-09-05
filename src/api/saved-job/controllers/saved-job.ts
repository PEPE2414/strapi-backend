import { factories } from '@strapi/strapi';

export default factories.createCoreController('api::saved-job.saved-job' as any, ({ strapi }) => ({
  async find(ctx) {
    const user = ctx.state.user;
    if (!user) return ctx.unauthorized();

    ctx.query = ctx.query || {};
    const incomingFilters = (ctx.query as any).filters || {};
    (ctx.query as any).filters = { ...incomingFilters, owner: user.id };

    // @ts-ignore
    return await super.find(ctx);
  },

  async findOne(ctx) {
    const user = ctx.state.user;
    if (!user) return ctx.unauthorized();

    // @ts-ignore
    const entity = await super.findOne(ctx);

    // Fallback owner check via raw query if needed
    const id = Number(ctx.params.id);
    const record = await strapi.db.query('api::saved-job.saved-job').findOne({
      where: { id },
      populate: { owner: true }
    });
    if (!record) return ctx.notFound();
    if (record.owner?.id !== user.id) return ctx.forbidden();

    return entity;
  },

  async create(ctx) {
    const user = ctx.state.user;
    if (!user) return ctx.unauthorized();

    const body = ctx.request.body || {};
    body.data = body.data || {};
    body.data.owner = user.id; // force
    ctx.request.body = body;

    // @ts-ignore
    return await super.create(ctx);
  },

  async update(ctx) {
    const user = ctx.state.user;
    if (!user) return ctx.unauthorized();

    const id = Number(ctx.params.id);
    const existing = await strapi.db.query('api::saved-job.saved-job').findOne({
      where: { id },
      populate: { owner: true }
    });
    if (!existing) return ctx.notFound();
    if (existing.owner?.id !== user.id) return ctx.forbidden();

    if (ctx.request.body?.data?.owner) delete ctx.request.body.data.owner;

    // @ts-ignore
    return await super.update(ctx);
  },

  async delete(ctx) {
    const user = ctx.state.user;
    if (!user) return ctx.unauthorized();

    const id = Number(ctx.params.id);
    const existing = await strapi.db.query('api::saved-job.saved-job').findOne({
      where: { id },
      populate: { owner: true }
    });
    if (!existing) return ctx.notFound();
    if (existing.owner?.id !== user.id) return ctx.forbidden();

    // @ts-ignore
    return await super.delete(ctx);
  }
}));
