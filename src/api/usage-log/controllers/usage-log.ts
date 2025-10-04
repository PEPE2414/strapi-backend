// src/api/usage-log/controllers/usage-log.ts

// Helper function for manual JWT verification
async function verifyJWT(ctx) {
  const authHeader = ctx.request.header.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    console.log('[usage-log] No valid Authorization header');
    return null;
  }
  
  const token = authHeader.slice(7);
  let user = null;
  
  try {
    // Use Strapi's JWT service to verify the token
    const jwtService = strapi.plugin('users-permissions').service('jwt');
    user = await jwtService.verify(token);
    console.log('[usage-log] JWT verified, user ID:', user.id);
  } catch (jwtError) {
    console.log('[usage-log] JWT verification failed:', jwtError.message);
    return null;
  }
  
  if (!user || !user.id) {
    console.log('[usage-log] No user found in JWT');
    return null;
  }
  
  return user;
}

export default {
  async find(ctx) {
    try {
      console.log('[usage-log:find] Starting find request');
      console.log('[usage-log:find] ctx.state:', ctx.state);
      console.log('[usage-log:find] ctx.state.user:', ctx.state.user);
      console.log('[usage-log:find] Authorization header:', ctx.request.header.authorization);
      
      // Manual JWT verification since auth: false bypasses built-in auth
      const user = await verifyJWT(ctx);
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
      console.log('[usage-log:findOne] Starting findOne request');
      console.log('[usage-log:findOne] Authorization header:', ctx.request.header.authorization);
      
      // Manual JWT verification since auth: false bypasses built-in auth
      const user = await verifyJWT(ctx);
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
      console.log('[usage-log:create] Starting create request');
      console.log('[usage-log:create] Authorization header:', ctx.request.header.authorization);
      
      // Manual JWT verification since auth: false bypasses built-in auth
      const user = await verifyJWT(ctx);
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
      console.log('[usage-log:update] Starting update request');
      console.log('[usage-log:update] Authorization header:', ctx.request.header.authorization);
      
      // Manual JWT verification since auth: false bypasses built-in auth
      const user = await verifyJWT(ctx);
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
      console.log('[usage-log:delete] Starting delete request');
      console.log('[usage-log:delete] Authorization header:', ctx.request.header.authorization);
      
      // Manual JWT verification since auth: false bypasses built-in auth
      const user = await verifyJWT(ctx);
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
