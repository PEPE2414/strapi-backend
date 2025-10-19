/**
 * LinkedIn Results Webhook Controller
 * Handles result uploads from n8n without requiring user authentication
 */

export default {
  async handleLinkedInResults(ctx) {
    // Verify webhook secret if configured
    const expectedSecret = process.env.N8N_SHARED_SECRET;
    if (expectedSecret) {
      const providedSecret = ctx.request.headers['x-cl-secret'];
      if (!providedSecret || providedSecret !== expectedSecret) {
        return ctx.unauthorized('Invalid webhook secret');
      }
    }

    const { userId, userEmail, result } = ctx.request.body || {};
    
    // Validate required fields
    if (!userId || !userEmail || !result) {
      return ctx.badRequest('userId, userEmail, and result are required');
    }

    if (!result.overallScore) {
      return ctx.badRequest('result.overallScore is required');
    }

    try {
      // Create the LinkedIn result record
      const linkedinResult = await strapi.entityService.create('api::linkedin-result.linkedin-result', {
        data: {
          userId,
          userEmail,
          overallScore: result.overallScore,
          subscores: result.subscores || null,
          headlineVariants: result.headlineVariants || null,
          about: result.about || null,
          quickWins: result.quickWins || null,
          experienceBullets: result.experienceBullets || null,
          skills: result.skills || null,
          postDrafts: result.postDrafts || null,
          meta: result.meta || null,
          hadImage: result.hadImage || false,
          hadText: result.hadText || false,
          context: result.context || null,
          fullResult: result,
        },
      });

      strapi.log.info(`[linkedin-results-webhook] Created result for user ${userId}: ${linkedinResult.id}`);

      ctx.body = { 
        success: true, 
        resultId: linkedinResult.id,
        message: 'LinkedIn result stored successfully' 
      };
    } catch (err) {
      strapi.log.error('[linkedin-results-webhook] Error creating result:', err);
      return ctx.internalServerError('Failed to store LinkedIn result');
    }
  },
};
