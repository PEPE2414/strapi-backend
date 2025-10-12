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
      // Require authentication
      if (!ctx.state.user) {
        return ctx.unauthorized('You must be authenticated to analyze LinkedIn profiles');
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
          userId: ctx.state.user.id,
          userEmail: ctx.state.user.email,
          profileData,
          context: context || {},
        };

        // Call n8n webhook
        const response = await fetch(webhookUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(process.env.N8N_SHARED_SECRET ? { 'x-cl-secret': process.env.N8N_SHARED_SECRET } : {}),
          },
          body: JSON.stringify(payload),
        });

        if (!response.ok) {
          const errorText = await response.text().catch(() => '');
          strapi.log.error(`[linkedin-optimisation] Webhook failed: ${response.status} ${errorText}`);
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

