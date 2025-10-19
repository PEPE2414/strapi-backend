/**
 * LinkedIn Results Webhook Controller
 * Handles result uploads from n8n without requiring user authentication
 */

export default {
  async handleLinkedInResults(ctx) {
    // Verify webhook secret if configured
    const expectedSecret = process.env.CL_WEBHOOK_SECRET;
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
      // Check if the content type exists
      const contentType = strapi.contentType('api::linkedin-result.linkedin-result');
      if (!contentType) {
        strapi.log.error('[linkedin-results-webhook] Content type not found: api::linkedin-result.linkedin-result');
        strapi.log.error('[linkedin-results-webhook] Available content types:', Object.keys(strapi.contentTypes));
        return ctx.internalServerError('Content type not found - please restart Strapi to register the new schema');
      }

      // Try using entityService first, fallback to db.query
      let linkedinResult;
      try {
        linkedinResult = await strapi.entityService.create('api::linkedin-result.linkedin-result', {
          data: {
            userId,
            userEmail,
            overallScore: result.overallScore,
            currentScore: result.currentScore || null,
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
      } catch (entityError) {
        strapi.log.warn('[linkedin-results-webhook] EntityService failed, trying db.query:', entityError.message);
        // Fallback to direct database query
        linkedinResult = await strapi.db.query('api::linkedin-result.linkedin-result').create({
          data: {
            userId,
            userEmail,
            overallScore: result.overallScore,
            currentScore: result.currentScore || null,
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
      }

      strapi.log.info(`[linkedin-results-webhook] Created result for user ${userId}: ${linkedinResult.id}`);

      ctx.body = { 
        success: true, 
        resultId: linkedinResult.id,
        message: 'LinkedIn result stored successfully' 
      };
    } catch (err) {
      strapi.log.error('[linkedin-results-webhook] Error creating result:', err);
      strapi.log.error('[linkedin-results-webhook] Error details:', err.message);
      strapi.log.error('[linkedin-results-webhook] Stack trace:', err.stack);
      return ctx.internalServerError('Failed to store LinkedIn result');
    }
  },
};
