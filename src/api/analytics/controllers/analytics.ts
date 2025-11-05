// src/api/analytics/controllers/analytics.ts

export default {
  /**
   * Get usage metrics for the current user
   */
  async getMyUsage(ctx) {
    try {
      // Manual JWT verification
      const authHeader = ctx.request.header.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return ctx.unauthorized('Authentication required');
      }
      
      const token = authHeader.slice(7);
      let user = null;
      
      try {
        const jwtService = strapi.plugin('users-permissions').service('jwt');
        user = await jwtService.verify(token);
      } catch (jwtError) {
        return ctx.unauthorized('Invalid token');
      }

      const userId = user.id.toString();
      const usageMetrics = await strapi.service('api::analytics.analytics').getUserUsageMetrics(userId);

      ctx.body = {
        data: usageMetrics
      };
    } catch (error) {
      console.error('Error getting usage metrics:', error);
      ctx.internalServerError('Failed to get usage metrics');
    }
  },

  /**
   * Get comprehensive analytics for the current user
   */
  async getMyAnalytics(ctx) {
    try {
      // Manual JWT verification
      const authHeader = ctx.request.header.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return ctx.unauthorized('Authentication required');
      }
      
      const token = authHeader.slice(7);
      let user = null;
      
      try {
        const jwtService = strapi.plugin('users-permissions').service('jwt');
        user = await jwtService.verify(token);
      } catch (jwtError) {
        return ctx.unauthorized('Invalid token');
      }

      const userId = user.id.toString();
      const analytics = await strapi.service('api::analytics.analytics').getUserAnalytics(userId);

      ctx.body = {
        data: analytics
      };
    } catch (error) {
      console.error('Error getting analytics:', error);
      ctx.internalServerError('Failed to get analytics');
    }
  },

  /**
   * Get churn metrics (admin only)
   */
  async getChurnMetrics(ctx) {
    try {
      // Manual JWT verification
      const authHeader = ctx.request.header.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return ctx.unauthorized('Authentication required');
      }
      
      const token = authHeader.slice(7);
      let user = null;
      
      try {
        const jwtService = strapi.plugin('users-permissions').service('jwt');
        user = await jwtService.verify(token);
      } catch (jwtError) {
        return ctx.unauthorized('Invalid token');
      }

      // TODO: Add admin check here
      // For now, allow any authenticated user to view churn metrics
      
      const period = ctx.query.period || 'month';
      const validPeriods = ['day', 'week', 'month'];
      if (!validPeriods.includes(period)) {
        return ctx.badRequest('Invalid period. Must be: day, week, or month');
      }

      const churnMetrics = await strapi.service('api::analytics.analytics').getChurnMetrics(period);

      ctx.body = {
        data: churnMetrics
      };
    } catch (error) {
      console.error('Error getting churn metrics:', error);
      ctx.internalServerError('Failed to get churn metrics');
    }
  }
};

