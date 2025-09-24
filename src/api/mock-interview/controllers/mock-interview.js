// strapi-backend/src/api/mock-interview/controllers/mock-interview.js
'use strict';

/**
 * mock-interview controller
 */

const { createCoreController } = require('@strapi/strapi').factories;

module.exports = createCoreController('api::mock-interview.mock-interview', ({ strapi }) => ({
  async start(ctx) {
    try {
      const { body } = ctx.request;
      
      // Get the webhook URL from environment variables
      const webhookUrl = process.env.MOCKINTERVIEW_WEBHOOK;
      
      if (!webhookUrl) {
        return ctx.badRequest('Mock interview webhook not configured');
      }

      // Call the N8N webhook
      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body)
      });

      if (!response.ok) {
        throw new Error(`Webhook failed: ${response.status} ${response.statusText}`);
      }

      const result = await response.json();
      
      return ctx.send(result);
    } catch (error) {
      console.error('Mock interview start error:', error);
      return ctx.internalServerError('Failed to start mock interview');
    }
  }
}));
