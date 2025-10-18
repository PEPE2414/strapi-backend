// strapi-backend/src/api/audio-analysis/controllers/audio-analysis.ts
'use strict';

import { factories } from '@strapi/strapi';

export default factories.createCoreController('api::audio-analysis.audio-analysis', ({ strapi }) => ({
  async processAudio(ctx) {
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

      const { audioData, question, questionIndex, sessionId, prepTimeUsed, answerTimeUsed } = ctx.request.body;
      
      if (!audioData || !question) {
        return ctx.badRequest('audioData and question are required');
      }

      // Get the n8n webhook URL from environment variables
      const webhookUrl = process.env.N8N_AUDIO_ANALYSIS_WEBHOOK;
      const sharedSecret = process.env.N8N_SHARED_SECRET;
      
      if (!webhookUrl) {
        console.error('Audio analysis webhook not configured (N8N_AUDIO_ANALYSIS_WEBHOOK)');
        return ctx.internalServerError('Audio analysis service not configured');
      }

      // Prepare payload for n8n
      const payload = {
        userId: user.id,
        sessionId: sessionId || `practice_${Date.now()}`,
        audioData, // Base64 encoded compressed audio
        question,
        questionIndex: questionIndex || 0,
        prepTimeUsed: prepTimeUsed || 0,
        answerTimeUsed: answerTimeUsed || 0,
        timestamp: new Date().toISOString()
      };

      console.log(`[Audio Analysis] User ${user.id} processing audio for question ${questionIndex}`);

      // Call n8n webhook with timeout
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 60000); // 60 second timeout for audio processing

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
          console.error(`[Audio Analysis] Webhook failed: ${response.status} - ${errorText}`);
          throw new Error(`Webhook returned ${response.status}`);
        }

        const result = await response.json();
        
        // Expected response format from n8n:
        // { 
        //   feedback: "Detailed feedback text",
        //   score: 85,
        //   strengths: ["Clear communication", "Good structure"],
        //   improvements: ["Speak slower", "More specific examples"],
        //   transcript: "User's spoken response",
        //   analysis: { ... }
        // }

        // Save the analysis result (optional - for future reference)
        try {
          await strapi.entityService.create('api::audio-analysis.audio-analysis', {
            data: {
              user: user.id,
              sessionId: payload.sessionId,
              question,
              questionIndex,
              prepTimeUsed,
              answerTimeUsed,
              feedback: result.feedback || '',
              score: result.score || 0,
              strengths: result.strengths || [],
              improvements: result.improvements || [],
              transcript: result.transcript || '',
              analysis: result.analysis || {},
              audioData: audioData.substring(0, 100) + '...', // Store truncated version for reference
              createdAt: new Date()
            }
          });
        } catch (saveError) {
          console.warn('[Audio Analysis] Failed to save analysis result:', saveError.message);
          // Continue anyway - don't fail the request
        }

        return ctx.send({
          feedback: result.feedback || 'Thank you for your response. Keep practicing!',
          score: result.score || 0,
          strengths: result.strengths || [],
          improvements: result.improvements || [],
          transcript: result.transcript || '',
          analysis: result.analysis || {},
          timestamp: new Date().toISOString()
        });

      } catch (fetchError) {
        clearTimeout(timeout);
        
        if (fetchError.name === 'AbortError') {
          console.error('[Audio Analysis] Request timeout');
          return ctx.internalServerError('Request timeout - Audio analysis took too long to process');
        }
        
        throw fetchError;
      }

    } catch (error) {
      console.error('[Audio Analysis] Process audio error:', error);
      return ctx.internalServerError('Failed to process audio analysis');
    }
  },

  // Get analysis history for a user
  async getHistory(ctx) {
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

      const { sessionId } = ctx.query;
      
      // Build query filters
      const filters: any = {
        user: user.id
      };
      
      if (sessionId) {
        filters.sessionId = sessionId;
      }

      // Fetch analysis history
      const analyses = await strapi.entityService.findMany('api::audio-analysis.audio-analysis', {
        filters,
        sort: { createdAt: 'desc' },
        limit: 50,
        populate: ['user']
      });

      return ctx.send({
        analyses: analyses || [],
        count: analyses?.length || 0
      });

    } catch (error) {
      console.error('[Audio Analysis] Get history error:', error);
      return ctx.internalServerError('Failed to retrieve analysis history');
    }
  }
}));
