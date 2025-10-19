/**
 * Error Log Controller
 */

export default {
  async find(ctx) {
    const { query } = ctx;
    
    const entity = await strapi.entityService.findMany('api::error-log.error-log', {
      ...query,
      populate: '*',
    });

    return entity;
  },

  async findOne(ctx) {
    const { id } = ctx.params;
    const { query } = ctx;

    const entity = await strapi.entityService.findOne('api::error-log.error-log', id, {
      ...query,
      populate: '*',
    });

    return entity;
  },

  async create(ctx) {
    const { data } = ctx.request.body;

    const entity = await strapi.entityService.create('api::error-log.error-log', {
      data,
      ...ctx.query,
    });

    return entity;
  },

  async update(ctx) {
    const { id } = ctx.params;
    const { data } = ctx.request.body;

    const entity = await strapi.entityService.update('api::error-log.error-log', id, {
      data,
      ...ctx.query,
    });

    return entity;
  },

  async delete(ctx) {
    const { id } = ctx.params;

    const entity = await strapi.entityService.delete('api::error-log.error-log', id, {
      ...ctx.query,
    });

    return entity;
  },
};
