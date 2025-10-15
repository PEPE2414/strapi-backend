/**
 * Job Cleanup Service
 * 
 * Automatically removes expired jobs from the database to prevent storage bloat.
 * Jobs are deleted 3 months after their application deadline to give users time
 * to access saved job information.
 */

interface CleanupStats {
  totalExpiredJobs: number;
  jobsReferencedBySavedJobs: number;
  jobsDeleted: number;
  errors: string[];
}

export class JobCleanupService {
  private readonly GRACE_PERIOD_MONTHS = 3;

  /**
   * Calculate the cutoff date for job deletion
   * Jobs with applyDeadline before this date are eligible for deletion
   */
  private getCutoffDate(): Date {
    const cutoff = new Date();
    cutoff.setMonth(cutoff.getMonth() - this.GRACE_PERIOD_MONTHS);
    return cutoff;
  }

  /**
   * Find all jobs that are eligible for deletion
   */
  private async findExpiredJobs(): Promise<any[]> {
    const cutoffDate = this.getCutoffDate();
    
    return await strapi.db.query('api::job.job').findMany({
      where: {
        applyDeadline: {
          $lt: cutoffDate.toISOString()
        }
      },
      select: ['id', 'title', 'company', 'applyDeadline', 'hash']
    });
  }

  /**
   * Check if a job is referenced by any saved jobs
   */
  private async isJobReferenced(jobId: string): Promise<boolean> {
    const count = await strapi.db.query('api::saved-job.saved-job').count({
      where: {
        jobId: String(jobId)
      }
    });
    return count > 0;
  }

  /**
   * Delete a job from the database
   */
  private async deleteJob(job: any): Promise<void> {
    await strapi.entityService.delete('api::job.job', job.id);
  }

  /**
   * Perform the cleanup operation
   */
  async cleanup(): Promise<CleanupStats> {
    const stats: CleanupStats = {
      totalExpiredJobs: 0,
      jobsReferencedBySavedJobs: 0,
      jobsDeleted: 0,
      errors: []
    };

    try {
      console.log('🧹 Starting job cleanup process...');
      
      // Find all expired jobs
      const expiredJobs = await this.findExpiredJobs();
      stats.totalExpiredJobs = expiredJobs.length;
      
      console.log(`📊 Found ${expiredJobs.length} expired jobs (older than ${this.GRACE_PERIOD_MONTHS} months)`);

      if (expiredJobs.length === 0) {
        console.log('✅ No expired jobs to clean up');
        return stats;
      }

      // Process each expired job
      for (const job of expiredJobs) {
        try {
          // Check if job is referenced by any saved jobs
          const isReferenced = await this.isJobReferenced(job.id);
          
          if (isReferenced) {
            stats.jobsReferencedBySavedJobs++;
            console.log(`⏭️  Skipping job "${job.title}" at ${job.company?.name} - referenced by saved jobs`);
            continue;
          }

          // Safe to delete
          await this.deleteJob(job);
          stats.jobsDeleted++;
          console.log(`🗑️  Deleted job "${job.title}" at ${job.company?.name} (deadline: ${job.applyDeadline})`);
          
        } catch (error) {
          const errorMsg = `Failed to process job ${job.id}: ${error.message}`;
          stats.errors.push(errorMsg);
          console.error(`❌ ${errorMsg}`);
        }
      }

      console.log(`✅ Cleanup completed: ${stats.jobsDeleted} jobs deleted, ${stats.jobsReferencedBySavedJobs} skipped (referenced)`);
      
    } catch (error) {
      const errorMsg = `Cleanup process failed: ${error.message}`;
      stats.errors.push(errorMsg);
      console.error(`❌ ${errorMsg}`);
    }

    return stats;
  }

  /**
   * Get cleanup statistics without performing cleanup
   */
  async getStats(): Promise<{ expiredJobs: number; referencedJobs: number }> {
    const expiredJobs = await this.findExpiredJobs();
    let referencedJobs = 0;

    for (const job of expiredJobs) {
      const isReferenced = await this.isJobReferenced(job.id);
      if (isReferenced) referencedJobs++;
    }

    return {
      expiredJobs: expiredJobs.length,
      referencedJobs
    };
  }
}

// Export singleton instance
export const jobCleanupService = new JobCleanupService();
