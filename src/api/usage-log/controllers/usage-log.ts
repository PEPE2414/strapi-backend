// src/api/usage-log/controllers/usage-log.ts
export default {
  async find(ctx) {
    try {
      // Get the authenticated user
      const user = ctx.state.user;
      if (!user) {
        return ctx.unauthorized('Authentication required');
      }

      // Build query with forced user scoping (ignore any user filters from client)
      const { query } = ctx;
      const entity = await strapi.entityService.findMany('api::usage-log.usage-log', {
        ...query,
        filters: {
          ...query.filters,
          user: user.id  // force owner scoping for usage logs
        }
      });

      return entity;
    } catch (error) {
      console.error('[usage-log:find] Error:', error);
      return ctx.badRequest('Failed to fetch usage logs');
    }
  },

  async findOne(ctx) {
    try {
      // Get the authenticated user
      const user = ctx.state.user;
      if (!user) {
        return ctx.unauthorized('Authentication required');
      }

      const { id } = ctx.params;
      const entity = await strapi.entityService.findOne('api::usage-log.usage-log', id, {
        populate: '*',
        filters: {
          user: user.id  // force owner scoping for usage logs
        }
      });

      if (!entity) {
        return ctx.notFound('Usage log not found');
      }

      return entity;
    } catch (error) {
      console.error('[usage-log:findOne] Error:', error);
      return ctx.badRequest('Failed to fetch usage log');
    }
  },

  async create(ctx) {
    try {
      // Get the authenticated user
      const user = ctx.state.user;
      if (!user) {
        return ctx.unauthorized('Authentication required');
      }

      const { data } = ctx.request.body;
      
      // Ensure the user field is set to the authenticated user
      const entity = await strapi.entityService.create('api::usage-log.usage-log', {
        data: {
          ...data,
          user: user.id
        }
      });

      return entity;
    } catch (error) {
      console.error('[usage-log:create] Error:', error);
      return ctx.badRequest('Failed to create usage log');
    }
  },

  async update(ctx) {
    try {
      // Get the authenticated user
      const user = ctx.state.user;
      if (!user) {
        return ctx.unauthorized('Authentication required');
      }

      const { id } = ctx.params;
      const { data } = ctx.request.body;

      // First check if the usage log belongs to the user
      const existingEntity = await strapi.entityService.findOne('api::usage-log.usage-log', id, {
        filters: {
          user: user.id  // force owner scoping for usage logs
        }
      });

      if (!existingEntity) {
        return ctx.notFound('Usage log not found');
      }

      const entity = await strapi.entityService.update('api::usage-log.usage-log', id, {
        data
      });

      return entity;
    } catch (error) {
      console.error('[usage-log:update] Error:', error);
      return ctx.badRequest('Failed to update usage log');
    }
  },

  async delete(ctx) {
    try {
      // Get the authenticated user
      const user = ctx.state.user;
      if (!user) {
        return ctx.unauthorized('Authentication required');
      }

      const { id } = ctx.params;

      // First check if the usage log belongs to the user
      const existingEntity = await strapi.entityService.findOne('api::usage-log.usage-log', id, {
        filters: {
          user: user.id  // force owner scoping for usage logs
        }
      });

      if (!existingEntity) {
        return ctx.notFound('Usage log not found');
      }

      const entity = await strapi.entityService.delete('api::usage-log.usage-log', id);

      return entity;
    } catch (error) {
      console.error('[usage-log:delete] Error:', error);
      return ctx.badRequest('Failed to delete usage log');
    }
  }
};
