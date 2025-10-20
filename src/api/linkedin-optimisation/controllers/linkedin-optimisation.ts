/**
 * linkedin-optimisation controller
 */

import { factories } from '@strapi/strapi';

export default factories.createCoreController(
  'api::linkedin-optimisation.linkedin-optimisation' as any,
  ({ strapi }) => ({
    /**
     * POST /api/linkedin-optimisations/generate
     * Securely proxies LinkedIn profile analysis to n8n webhook
     */
    async generate(ctx) {
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

      const { profileData, context } = ctx.request.body || {};
      
      // Validate required fields
      if (!profileData) {
        return ctx.badRequest('profileData is required');
      }

      try {
        // Get webhook URL from environment
        const webhookUrl = process.env.N8N_LINKEDIN_WEBHOOK_URL;
        if (!webhookUrl) {
          strapi.log.error('[linkedin-optimisation] N8N_LINKEDIN_WEBHOOK_URL not configured');
          return ctx.internalServerError('LinkedIn optimization service not configured');
        }

        // Prepare payload for n8n
        const payload = {
          userId: user.id,
          userEmail: user.email,
          profileData,
          context: context || {},
        };

        strapi.log.info(`[linkedin-optimisation] Calling webhook: ${webhookUrl}`);
        strapi.log.info(`[linkedin-optimisation] Payload:`, JSON.stringify(payload, null, 2));

        // Call n8n webhook
        const response = await fetch(webhookUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(process.env.CL_WEBHOOK_SECRET ? { 'x-cl-secret': process.env.CL_WEBHOOK_SECRET } : {}),
          },
          body: JSON.stringify(payload),
        });

        if (!response.ok) {
          const errorText = await response.text().catch(() => '');
          strapi.log.error(`[linkedin-optimisation] Webhook failed: ${response.status} ${response.statusText}`);
          strapi.log.error(`[linkedin-optimisation] Webhook URL: ${webhookUrl}`);
          strapi.log.error(`[linkedin-optimisation] Response body: ${errorText}`);
          strapi.log.error(`[linkedin-optimisation] Request payload:`, JSON.stringify(payload, null, 2));
          return ctx.internalServerError('LinkedIn optimization service failed');
        }

        const result = await response.json();
        
        // Return the result to frontend
        ctx.body = result;
      } catch (err) {
        strapi.log.error('[linkedin-optimisation] Error calling webhook:', err);
        return ctx.internalServerError('Failed to analyze LinkedIn profile');
      }
    },

    // Override create to ensure only authenticated users can log
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

      // Attach user email if not provided
      if (!ctx.request.body.data.userEmail && user.email) {
        ctx.request.body.data.userEmail = user.email;
      }
      // Note: user relationship will be added after migration is applied

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

      // Filter results by user email (fallback until migration is applied)
      const existingFilters = ctx.query.filters as Record<string, any> || {};
      ctx.query = {
        ...ctx.query,
        filters: {
          ...existingFilters,
          userEmail: user.email,
        },
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

      // First get the result to check ownership
      const result = await strapi.entityService.findOne('api::linkedin-optimisation.linkedin-optimisation' as any, ctx.params.id, {
        populate: '*',
      });

      if (!result) {
        return ctx.notFound('Result not found');
      }

      // Check if the result belongs to the authenticated user
      if ((result as any).userEmail !== user.email) {
        return ctx.forbidden('Access denied');
      }

      return super.findOne(ctx);
    },
  })
);

