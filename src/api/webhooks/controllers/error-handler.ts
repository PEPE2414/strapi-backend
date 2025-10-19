/**
 * Error Handler Webhook Controller
 * Handles error notifications from n8n workflows
 */

export default {
  async handleError(ctx) {
    // Verify webhook secret if configured
    const expectedSecret = process.env.CL_WEBHOOK_SECRET;
    if (expectedSecret) {
      const providedSecret = ctx.request.headers['x-cl-secret'];
      if (!providedSecret || providedSecret !== expectedSecret) {
        return ctx.unauthorized('Invalid webhook secret');
      }
    }

    const { 
      workflowId, 
      workflowName, 
      nodeId, 
      nodeName, 
      errorMessage, 
      errorDetails, 
      timestamp,
      userId,
      userEmail,
      context 
    } = ctx.request.body || {};
    
    // Validate required fields
    if (!workflowId || !errorMessage) {
      return ctx.badRequest('workflowId and errorMessage are required');
    }

    try {
      // Log the error with full context
      strapi.log.error(`[n8n-error-webhook] Workflow Error: ${workflowName || workflowId}`);
      strapi.log.error(`[n8n-error-webhook] Node: ${nodeName || nodeId}`);
      strapi.log.error(`[n8n-error-webhook] Error: ${errorMessage}`);
      if (errorDetails) {
        strapi.log.error(`[n8n-error-webhook] Details: ${JSON.stringify(errorDetails, null, 2)}`);
      }
      if (userId) {
        strapi.log.error(`[n8n-error-webhook] User: ${userEmail || userId}`);
      }
      if (context) {
        strapi.log.error(`[n8n-error-webhook] Context: ${JSON.stringify(context, null, 2)}`);
      }

      // Store error in database for tracking
      const errorRecord = await strapi.db.query('api::error-log.error-log').create({
        data: {
          workflowId,
          workflowName: workflowName || null,
          nodeId: nodeId || null,
          nodeName: nodeName || null,
          errorMessage,
          errorDetails: errorDetails ? JSON.stringify(errorDetails) : null,
          timestamp: timestamp || new Date().toISOString(),
          userId: userId || null,
          userEmail: userEmail || null,
          context: context ? JSON.stringify(context) : null,
          status: 'active'
        },
      });

      strapi.log.info(`[n8n-error-webhook] Error logged with ID: ${errorRecord.id}`);

      ctx.body = { 
        success: true, 
        errorId: errorRecord.id,
        message: 'Error logged successfully' 
      };
    } catch (err) {
      strapi.log.error('[n8n-error-webhook] Error logging error:', err);
      strapi.log.error('[n8n-error-webhook] Error details:', err.message);
      return ctx.internalServerError('Failed to log error');
    }
  },
};
