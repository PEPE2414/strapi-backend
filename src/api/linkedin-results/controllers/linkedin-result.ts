/**
 * linkedin-result controller
 */

import { factories } from '@strapi/strapi';

export default factories.createCoreController(
  'api::linkedin-results.linkedin-result' as any,
  ({ strapi }) => ({
    // Override create to ensure only authenticated users can create
    async create(ctx) {
      // Manual JWT verification since auth: false bypasses built-in auth
      const authHeader = ctx.request.header.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return ctx.unauthorized('Authentication required');
      }
      
      const token = authHeader.slice(7);
      let user = null;
      
      try {
        // Use Strapi's JWT service to verify the token
        const jwtService = strapi.plugin('users-permissions').service('jwt');
        user = await jwtService.verify(token);
      } catch (jwtError) {
        return ctx.unauthorized('Invalid token');
      }
      
      if (!user || !user.id) {
        return ctx.unauthorized('Authentication required');
      }

      // Ensure userId is a number
      const userId = Number(user.id);
      
      if (!userId || !Number.isInteger(userId)) {
        strapi.log.error(`[linkedin-results] Invalid user ID in create: ${user.id} (type: ${typeof user.id})`);
        return ctx.badRequest('Invalid user ID');
      }

      // Attach user info if not provided
      if (!ctx.request.body.data.userId && userId) {
        ctx.request.body.data.userId = userId;
      }
      if (!ctx.request.body.data.userEmail && user.email) {
        ctx.request.body.data.userEmail = user.email;
      }

      // Call default controller
      return super.create(ctx);
    },

    // Override find to restrict to authenticated users only
    async find(ctx) {
      // Manual JWT verification since auth: false bypasses built-in auth
      const authHeader = ctx.request.header.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return ctx.unauthorized('Authentication required');
      }
      
      const token = authHeader.slice(7);
      let user = null;
      
      try {
        // Use Strapi's JWT service to verify the token
        const jwtService = strapi.plugin('users-permissions').service('jwt');
        user = await jwtService.verify(token);
      } catch (jwtError) {
        return ctx.unauthorized('Invalid token');
      }
      
      if (!user || !user.id) {
        return ctx.unauthorized('Authentication required');
      }

      // Ensure userId is a number
      const userId = Number(user.id);
      
      if (!userId || !Number.isInteger(userId)) {
        strapi.log.error(`[linkedin-results] Invalid user ID in find: ${user.id} (type: ${typeof user.id})`);
        return ctx.badRequest('Invalid user ID');
      }

      // Filter results to only show current user's results
      const existingFilters = ctx.query.filters as Record<string, any> || {};
      ctx.query.filters = {
        ...existingFilters,
        userId: userId
      };

      return super.find(ctx);
    },

    // Override findOne to restrict to authenticated users only
    async findOne(ctx) {
      // Manual JWT verification since auth: false bypasses built-in auth
      const authHeader = ctx.request.header.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return ctx.unauthorized('Authentication required');
      }
      
      const token = authHeader.slice(7);
      let user = null;
      
      try {
        // Use Strapi's JWT service to verify the token
        const jwtService = strapi.plugin('users-permissions').service('jwt');
        user = await jwtService.verify(token);
      } catch (jwtError) {
        return ctx.unauthorized('Invalid token');
      }
      
      if (!user || !user.id) {
        return ctx.unauthorized('Authentication required');
      }

      // Ensure userId is a number
      const userId = Number(user.id);
      
      if (!userId || !Number.isInteger(userId)) {
        strapi.log.error(`[linkedin-results] Invalid user ID in findOne: ${user.id} (type: ${typeof user.id})`);
        return ctx.badRequest('Invalid user ID');
      }

      // Get the result and check if it belongs to the user
      const result = await strapi.entityService.findOne('api::linkedin-results.linkedin-result' as any, ctx.params.id, {
        populate: '*'
      }) as any;

      if (!result || result.userId !== userId) {
        return ctx.notFound('Result not found');
      }

      return super.findOne(ctx);
    },
  })
);
