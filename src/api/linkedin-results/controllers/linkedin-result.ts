/**
 * linkedin-result controller
 */

import { factories } from '@strapi/strapi';

export default factories.createCoreController(
  'api::linkedin-result.linkedin-result' as any,
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

      // Attach user info if not provided
      if (!ctx.request.body.data.userId && user.id) {
        ctx.request.body.data.userId = user.id;
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

      // Filter results to only show current user's results
      ctx.query.filters = {
        ...ctx.query.filters,
        userId: user.id
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

      // Get the result and check if it belongs to the user
      const result = await strapi.entityService.findOne('api::linkedin-result.linkedin-result', ctx.params.id, {
        populate: '*'
      });

      if (!result || result.userId !== user.id) {
        return ctx.notFound('Result not found');
      }

      return super.findOne(ctx);
    },
  })
);
