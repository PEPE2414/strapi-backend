/**
 * Job Deduplication Controller
 *
 * Provides endpoints to manually trigger deduplication and view stats.
 */

import { jobDeduplicationService } from '../../../services/jobDeduplication';

export default {
  /**
   * Manually trigger job deduplication
   * GET /jobs/dedupe/trigger
   */
  async trigger(ctx: any) {
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


