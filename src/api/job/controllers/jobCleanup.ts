/**
 * Job Cleanup Controller
 * 
 * Provides endpoints for managing job cleanup operations.
 * Includes manual triggers and monitoring capabilities.
 */

import { jobCleanupService } from '../../../services/jobCleanup';
import { scheduledTasksService } from '../../../services/scheduledTasks';

export default {
  /**
   * Manually trigger job cleanup
   * GET /jobs/cleanup/trigger
   */
  async trigger(ctx: any) {
    try {
      console.log('🔧 Manual job cleanup triggered via API');
      
      const stats = await jobCleanupService.cleanup();
      
      ctx.body = {
        success: true,
        message: 'Job cleanup completed',
        stats: {
          totalExpiredJobs: stats.totalExpiredJobs,
          jobsReferencedBySavedJobs: stats.jobsReferencedBySavedJobs,
          jobsDeleted: stats.jobsDeleted,
          errors: stats.errors.length,
          errorDetails: stats.errors
        },
        timestamp: new Date().toISOString()
      };
      
    } catch (error) {
      console.error('❌ Manual cleanup failed:', error);
      ctx.body = {
        success: false,
        message: 'Job cleanup failed',
        error: error.message,
        timestamp: new Date().toISOString()
      };
      ctx.status = 500;
    }
  },

  /**
   * Get cleanup statistics without performing cleanup
   * GET /jobs/cleanup/stats
   */
  async stats(ctx: any) {
    try {
      const stats = await jobCleanupService.getStats();
      
      ctx.body = {
        success: true,
        stats: {
          expiredJobs: stats.expiredJobs,
          referencedJobs: stats.referencedJobs,
          deletableJobs: stats.expiredJobs - stats.referencedJobs,
          gracePeriodMonths: 3
        },
        timestamp: new Date().toISOString()
      };
      
    } catch (error) {
      console.error('❌ Failed to get cleanup stats:', error);
      ctx.body = {
        success: false,
        message: 'Failed to get cleanup statistics',
        error: error.message,
        timestamp: new Date().toISOString()
      };
      ctx.status = 500;
    }
  },

  /**
   * Get scheduled tasks status
   * GET /jobs/cleanup/schedule
   */
  async schedule(ctx: any) {
    try {
      const status = scheduledTasksService.getStatus();
      
      ctx.body = {
        success: true,
        tasks: status,
        timestamp: new Date().toISOString()
      };
      
    } catch (error) {
      console.error('❌ Failed to get schedule status:', error);
      ctx.body = {
        success: false,
        message: 'Failed to get schedule status',
        error: error.message,
        timestamp: new Date().toISOString()
      };
      ctx.status = 500;
    }
  },

  /**
   * Enable or disable scheduled cleanup
   * POST /jobs/cleanup/schedule
   * Body: { enabled: boolean }
   */
  async updateSchedule(ctx: any) {
    try {
      const { enabled } = ctx.request.body;
      
      if (typeof enabled !== 'boolean') {
        ctx.body = {
          success: false,
          message: 'enabled field must be a boolean'
        };
        ctx.status = 400;
        return;
      }

      scheduledTasksService.setTaskEnabled('jobCleanup', enabled);
      
      ctx.body = {
        success: true,
        message: `Scheduled cleanup ${enabled ? 'enabled' : 'disabled'}`,
        enabled,
        timestamp: new Date().toISOString()
      };
      
    } catch (error) {
      console.error('❌ Failed to update schedule:', error);
      ctx.body = {
        success: false,
        message: 'Failed to update schedule',
        error: error.message,
        timestamp: new Date().toISOString()
      };
      ctx.status = 500;
    }
  }
};
