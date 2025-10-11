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
  },

  // Real-time chat endpoint for bidirectional mock interview
  async chat(ctx) {
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

    try {
      const { sessionId, message, jobTitle, company, conversationHistory = [] } = ctx.request.body;
      
      if (!sessionId || !message) {
        return ctx.badRequest('sessionId and message are required');
      }

      // Get the webhook URL from environment variables
      const webhookUrl = process.env.N8N_MOCK_INTERVIEW_WEBHOOK || process.env.MOCKINTERVIEW_WEBHOOK;
      const sharedSecret = process.env.N8N_SHARED_SECRET;
      
      if (!webhookUrl) {
        console.error('Mock interview webhook not configured (N8N_MOCK_INTERVIEW_WEBHOOK)');
        return ctx.internalServerError('Mock interview service not configured');
      }

      // Prepare payload for n8n
      const payload = {
        userId: user.id,
        sessionId,
        message,
        jobTitle: jobTitle || 'General Interview',
        company: company || 'Practice Company',
        conversationHistory: conversationHistory.slice(-10), // Last 10 messages for context
        timestamp: new Date().toISOString()
      };

      console.log(`[Mock Interview] User ${user.id} sending message in session ${sessionId}`);

      // Call n8n webhook with timeout
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 30000); // 30 second timeout

      try {
        const response = await fetch(webhookUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(sharedSecret ? { 'x-cl-secret': sharedSecret } : {})
          },
          body: JSON.stringify(payload),
          signal: controller.signal
        });

        clearTimeout(timeout);

        if (!response.ok) {
          const errorText = await response.text();
          console.error(`[Mock Interview] Webhook failed: ${response.status} - ${errorText}`);
          throw new Error(`Webhook returned ${response.status}`);
        }

        const result = await response.json();
        
        // Expected response format from n8n:
        // { response: "AI response text", followUpQuestion: "Optional next question" }
        
        // Save message to conversation history (optional - can be stored in session)
        try {
          await strapi.entityService.update('api::mock-interview.mock-interview', sessionId, {
            data: {
              conversationHistory: [
                ...conversationHistory,
                { role: 'user', content: message, timestamp: new Date().toISOString() },
                { role: 'assistant', content: result.response || result.message, timestamp: new Date().toISOString() }
              ]
            }
          });
        } catch (updateError) {
          console.warn('[Mock Interview] Failed to update conversation history:', updateError.message);
          // Continue anyway - don't fail the request
        }

        return ctx.send({
          response: result.response || result.message || 'I understand. Could you elaborate more on that?',
          followUpQuestion: result.followUpQuestion || null,
          timestamp: new Date().toISOString()
        });

      } catch (fetchError) {
        clearTimeout(timeout);
        
        if (fetchError.name === 'AbortError') {
          console.error('[Mock Interview] Request timeout');
          return ctx.internalServerError('Request timeout - AI service took too long to respond');
        }
        
        throw fetchError;
      }

    } catch (error) {
      console.error('[Mock Interview] Chat error:', error);
      return ctx.internalServerError('Failed to process mock interview message');
    }
  },

  // Get conversation history for a session
  async getHistory(ctx) {
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

    try {
      const { sessionId } = ctx.params;
      
      if (!sessionId) {
        return ctx.badRequest('sessionId is required');
      }

      // Fetch session data
      const session = await strapi.entityService.findOne('api::mock-interview.mock-interview', sessionId, {
        populate: ['user']
      });

      if (!session) {
        return ctx.notFound('Session not found');
      }

      // Verify ownership
      if (session.user?.id !== user.id && session.userId !== user.id) {
        return ctx.forbidden('You do not have access to this session');
      }

      return ctx.send({
        sessionId,
        conversationHistory: session.conversationHistory || [],
        jobTitle: session.jobTitle,
        company: session.company,
        createdAt: session.createdAt
      });

    } catch (error) {
      console.error('[Mock Interview] Get history error:', error);
      return ctx.internalServerError('Failed to retrieve conversation history');
    }
  }
}));
