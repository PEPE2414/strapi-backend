/**
 * Job Deduplication Controller
 *
 * Provides endpoints to manually trigger deduplication and view stats.
 */

import { jobDeduplicationService } from '../../../services/jobDeduplication';

const SECRET_HEADER = 'x-seed-secret';

// Constant-time comparison to prevent timing attacks
function constantTimeCompare(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

export default {
  /**
   * Manually trigger job deduplication
   * GET /jobs/dedupe/trigger
   */
  async trigger(ctx: any) {
    // Validate secret header
    const secretHeader = ctx.request.headers[SECRET_HEADER];
    const secret = Array.isArray(secretHeader) ? secretHeader[0] : secretHeader;
    const expectedSecret = process.env.SEED_SECRET || process.env.STRAPI_INGEST_SECRET;
    
    if (!secret || !expectedSecret || !constantTimeCompare(secret, expectedSecret)) {
      strapi.log.warn('Invalid secret provided for deduplication trigger');
      return ctx.unauthorized('Invalid secret');
    }

    try {
      strapi.log.info('🔧 Manual job deduplication triggered via API');

      const stats = await jobDeduplicationService.deduplicate();

      ctx.body = {
        success: true,
        message: 'Job deduplication completed',
        stats: {
          scanned: stats.totalJobsScanned,
          unknownRemoved: stats.unknownCompanyRemoved,
          duplicateGroups: stats.duplicateGroupsFound,
          duplicatesDeleted: stats.jobsDeletedAsDuplicates,
          savedJobsRepointed: stats.savedJobsRepointed,
          errors: stats.errors,
        },
        timestamp: new Date().toISOString(),
      };
    } catch (error: any) {
      strapi.log.error('❌ Manual deduplication failed:', error);
      ctx.body = {
        success: false,
        message: 'Job deduplication failed',
        error: error.message,
        timestamp: new Date().toISOString(),
      };
      ctx.status = 500;
    }
  },
};


