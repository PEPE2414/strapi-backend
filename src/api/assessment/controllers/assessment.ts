// src/api/assessment/controllers/assessment.ts
import { factories } from '@strapi/strapi';

const ASSESSMENT_UID = 'api::assessment.assessment' as any;

export default factories.createCoreController(ASSESSMENT_UID, ({ strapi }) => ({
  /**
   * Submit long-form assessment to n8n via backend (uses Railway env vars)
   * Frontend posts here; backend forwards to N8N webhook with shared secret
   */
  async submitLongform(ctx) {
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

      const webhookUrl = process.env.N8N_ASSESSMENT_WEBHOOK_URL;
      if (!webhookUrl) {
        strapi.log.error('[Assessment] N8N_ASSESSMENT_WEBHOOK_URL is not set');
        return ctx.internalServerError('Webhook not configured');
      }

      const sharedSecret = process.env.N8N_SHARED_SECRET;
      const body = ctx.request.body || {};

      // Enrich with backend-known userId if missing
      const enrichedPayload = {
        ...body,
        userId: body?.userId ?? Number(user?.id ?? null),
      };

      const res = await fetch(webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(sharedSecret ? { 'x-cl-secret': sharedSecret } : {}),
        },
        body: JSON.stringify(enrichedPayload),
      });

      if (!res.ok) {
        const text = await res.text().catch(() => '');
        strapi.log.error(`[Assessment] n8n forward failed: ${res.status} ${text}`);
        return ctx.internalServerError('Failed to submit assessment');
      }

      const data = await res.json().catch(() => ({ success: true }));
      return ctx.send({ success: true, forwarded: true, data });
    } catch (error) {
      strapi.log.error('[Assessment] Error submitting longform:', error);
      return ctx.internalServerError('Failed to submit assessment');
    }
  },
  /**
   * Allow n8n to POST assessment results back
   * This endpoint accepts results from n8n workflow after processing
   */
  async receiveResults(ctx) {
    try {
      const body = ctx.request.body as any;
      const { assessmentId, userId, feedback, score, status } = body;

      // Verify assessmentId and userId are provided
      if (!assessmentId) {
        return ctx.badRequest('assessmentId is required');
      }

      if (!userId) {
        return ctx.badRequest('userId is required');
      }

      // Optional: Verify shared secret from n8n
      const sharedSecret = process.env.N8N_SHARED_SECRET;
      const providedSecret = ctx.request.headers['x-cl-secret'];
      if (sharedSecret && providedSecret !== sharedSecret) {
        strapi.log.warn('[Assessment] Unauthorized result submission attempt');
        return ctx.unauthorized('Invalid secret');
      }

      // Find existing assessment by assessmentId
      const existingAssessment = await strapi.entityService.findMany(ASSESSMENT_UID, {
        filters: { assessmentId } as any,
        limit: 1,
      } as any);

      let result;
      if (existingAssessment && existingAssessment.length > 0) {
        // Update existing assessment
        result = await strapi.entityService.update(
          ASSESSMENT_UID,
          existingAssessment[0].id,
          {
            data: {
              feedback: feedback || null,
              score: score || null,
              status: status || 'completed',
              completedAt: new Date().toISOString(),
            } as any,
          }
        );
      } else {
        // Create new assessment result
        result = await strapi.entityService.create(ASSESSMENT_UID, {
          data: {
            assessmentId,
            user: userId,
            feedback: feedback || null,
            score: score || null,
            status: status || 'completed',
            completedAt: new Date().toISOString(),
          } as any,
        });
      }

      strapi.log.info(`[Assessment] Received results for assessment ${assessmentId}, user ${userId}`);
      return ctx.send({ success: true, assessmentId, id: result.id });
    } catch (error) {
      strapi.log.error('[Assessment] Error receiving results:', error);
      return ctx.internalServerError('Failed to save assessment results');
    }
  },

  /**
   * Get assessment results by assessmentId (requires authentication)
   */
  async getResult(ctx) {
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

      const { assessmentId } = ctx.params;

      if (!assessmentId) {
        return ctx.badRequest('assessmentId is required');
      }

      // Find assessment
      const assessment = await strapi.entityService.findMany(ASSESSMENT_UID, {
        filters: { assessmentId } as any,
        populate: ['user'] as any,
        limit: 1,
      } as any);

      if (!assessment || assessment.length === 0) {
        return ctx.notFound('Assessment not found');
      }

      const assessmentData = assessment[0] as any;

      // Verify ownership - only the user who took the assessment can see results
      const assessmentUserId = (assessmentData.user as any)?.id || assessmentData.userId;
      if (Number(assessmentUserId) !== Number(user.id)) {
        return ctx.forbidden('You do not have access to this assessment');
      }

      return ctx.send({
        assessmentId: assessmentData.assessmentId,
        feedback: assessmentData.feedback,
        score: assessmentData.score,
        status: assessmentData.status,
        completedAt: assessmentData.completedAt,
        createdAt: assessmentData.createdAt,
      });
    } catch (error) {
      strapi.log.error('[Assessment] Error getting result:', error);
      return ctx.internalServerError('Failed to retrieve assessment result');
    }
  },

  /**
   * Get all assessment results for the authenticated user
   */
  async myResults(ctx) {
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

      const userId = Number(user.id);

      // Get all assessments for this user
      const assessments = await strapi.entityService.findMany(ASSESSMENT_UID, {
        filters: { user: userId } as any,
        sort: { createdAt: 'desc' } as any,
        populate: [] as any,
      } as any);

      return ctx.send(assessments.map((a: any) => ({
        assessmentId: a.assessmentId,
        feedback: a.feedback,
        score: a.score,
        status: a.status,
        completedAt: a.completedAt,
        createdAt: a.createdAt,
      })));
    } catch (error) {
      strapi.log.error('[Assessment] Error getting my results:', error);
      return ctx.internalServerError('Failed to retrieve assessment results');
    }
  },
}));

