// src/api/savedtracker/controllers/savedtracker.ts
// Plain controller for saved-jobs (no factories). Owner-scoped.

function toData(entity: any) {
  return { id: entity.id, attributes: entity };
}

export default {

  async find(ctx: any) {
    const userId = ctx.state?.user?.id ?? ctx.state?.jwtUserId;
    if (!userId) return ctx.unauthorized();

    const pagination = (ctx.query?.pagination || {}) as any;
    const page = Number(pagination.page || 1);
    const pageSize = Number(pagination.pageSize || 100);
    const sort = (ctx.query?.sort as any) || ['deadline:asc'];

    const where = { ...(ctx.query as any)?.filters, owner: userId };

    const [results, total] = await Promise.all([
      strapi.db.query('api::saved-job.saved-job').findMany({
        where,
        orderBy: (Array.isArray(sort) ? sort : [sort]).map((s: string) => {
          const [field, dir] = s.split(':');
          return { [field]: (dir || 'asc') as 'asc' | 'desc' };
        }),
        limit: pageSize,
        offset: (page - 1) * pageSize,
      }),
      strapi.db.query('api::saved-job.saved-job').count({ where }),
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

  async findOne(ctx: any) {
    const userId = ctx.state?.user?.id ?? ctx.state?.jwtUserId;
    if (!userId) return ctx.unauthorized();

    const id = Number(ctx.params.id);
    const entity = await strapi.db.query('api::saved-job.saved-job').findOne({
      where: { id, owner: userId },
      populate: { owner: true },
    });
    if (!entity) return ctx.notFound();
    ctx.body = { data: toData(entity) };
  },

  async create(ctx: any) {
    const userId = ctx.state?.user?.id ?? ctx.state?.jwtUserId;
    if (!userId) return ctx.unauthorized();

    const body = (ctx.request.body?.data || ctx.request.body || {}) as any;

    const created = await strapi.entityService.create('api::saved-job.saved-job' as any, {
      data: { ...body, owner: userId },
    });

    ctx.body = { data: toData(created) };
  },

  async update(ctx: any) {
    const userId = ctx.state?.user?.id ?? ctx.state?.jwtUserId;
    if (!userId) return ctx.unauthorized();

    const id = Number(ctx.params.id);
    const existing = await strapi.db.query('api::saved-job.saved-job').findOne({
      where: { id },
      populate: { owner: true },
    });
    if (!existing) return ctx.notFound();
    if (existing.owner?.id !== userId) return ctx.forbidden();

    const patch = (ctx.request.body?.data || ctx.request.body || {}) as any;
    if (patch.owner) delete patch.owner;

    const updated = await strapi.entityService.update('api::saved-job.saved-job' as any, id, {
      data: patch,
    });

    ctx.body = { data: toData(updated) };
  },

  async delete(ctx: any) {
    const userId = ctx.state?.user?.id ?? ctx.state?.jwtUserId;
    if (!userId) return ctx.unauthorized();

    const id = Number(ctx.params.id);
    const existing = await strapi.db.query('api::saved-job.saved-job').findOne({
      where: { id },
      populate: { owner: true },
    });
    if (!existing) return ctx.notFound();
    if (existing.owner?.id !== userId) return ctx.forbidden();

    const deleted = await strapi.entityService.delete('api::saved-job.saved-job' as any, id);
    ctx.body = { data: toData(deleted) };
  },

};
