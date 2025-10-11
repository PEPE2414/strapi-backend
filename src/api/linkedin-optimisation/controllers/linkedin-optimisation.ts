/**
 * linkedin-optimisation controller
 */

import { factories } from '@strapi/strapi';

export default factories.createCoreController(
  'api::linkedin-optimisation.linkedin-optimisation' as any,
  ({ strapi }) => ({
    // Override create to ensure only authenticated users can log
    async create(ctx) {
      // Require authentication
      if (!ctx.state.user) {
        return ctx.unauthorized('You must be authenticated to create a log entry');
      }

      // Attach user email if not provided
      if (!ctx.request.body.data.userEmail && ctx.state.user.email) {
        ctx.request.body.data.userEmail = ctx.state.user.email;
      }

      // Call default controller
      return super.create(ctx);
    },

    // Override find to restrict to admins only
    async find(ctx) {
      if (!ctx.state.user || ctx.state.user.role?.type !== 'admin') {
        return ctx.unauthorized('Only admins can view logs');
      }
      return super.find(ctx);
    },

    // Override findOne to restrict to admins only
    async findOne(ctx) {
      if (!ctx.state.user || ctx.state.user.role?.type !== 'admin') {
        return ctx.unauthorized('Only admins can view logs');
      }
      return super.findOne(ctx);
    },
  })
);

