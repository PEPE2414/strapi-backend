/**
 * Scheduled Tasks Service
 * 
 * Handles periodic background tasks for the application.
 * Currently manages job cleanup scheduling.
 */

import { jobCleanupService } from './jobCleanup';
import { jobDeduplicationService } from './jobDeduplication';

interface ScheduledTaskConfig {
  name: string;
  interval: number; // in milliseconds
  enabled: boolean;
  lastRun?: Date;
  nextRun?: Date;
}

class ScheduledTasksService {
  private tasks: Map<string, ScheduledTaskConfig> = new Map();
  private intervals: Map<string, NodeJS.Timeout> = new Map();
  private isRunning = false;

  constructor() {
    this.initializeTasks();
  }

  private initializeTasks() {
    // Job cleanup runs daily at 2 AM
    this.tasks.set('jobCleanup', {
      name: 'Job Cleanup',
      interval: 24 * 60 * 60 * 1000, // 24 hours in milliseconds
      enabled: true
    });

    // Job deduplication runs daily at ~2:10 AM
    this.tasks.set('jobDeduplication', {
      name: 'Job Deduplication',
      interval: 24 * 60 * 60 * 1000,
      enabled: true
    });
  }

  /**
   * Start all enabled scheduled tasks
   */
  start(): void {
    if (this.isRunning) {
      console.log('⚠️  Scheduled tasks already running');
      return;
    }

    console.log('🚀 Starting scheduled tasks...');
    this.isRunning = true;

    for (const [taskId, config] of this.tasks) {
      if (config.enabled) {
        this.scheduleTask(taskId, config);
      }
    }

    console.log(`✅ Scheduled ${this.tasks.size} tasks`);
  }

  /**
   * Stop all scheduled tasks
   */
  stop(): void {
    if (!this.isRunning) {
      return;
    }

    console.log('🛑 Stopping scheduled tasks...');
    
    for (const [taskId, interval] of this.intervals) {
      clearInterval(interval);
      console.log(`⏹️  Stopped task: ${taskId}`);
    }

    this.intervals.clear();
    this.isRunning = false;
    console.log('✅ All scheduled tasks stopped');
  }

  /**
   * Schedule a specific task
   */
  private scheduleTask(taskId: string, config: ScheduledTaskConfig): void {
    const runTask = async () => {
      try {
        console.log(`🔄 Running scheduled task: ${config.name}`);
        config.lastRun = new Date();
        
        await this.executeTask(taskId);
        
        // Schedule next run
        config.nextRun = new Date(Date.now() + config.interval);
        console.log(`⏰ Next run scheduled: ${config.nextRun.toISOString()}`);
        
      } catch (error) {
        console.error(`❌ Task ${taskId} failed:`, error);
      }
    };

    // Calculate initial delay to run at 2 AM (or slightly staggered per task)
    const now = new Date();
    const nextRun = new Date(now);
    // Stagger start times to avoid spikes: deduplication starts at 2:10
    const minutes = taskId === 'jobDeduplication' ? 10 : 0;
    nextRun.setHours(2, minutes, 0, 0);
    
    // If it's already past 2 AM today, schedule for tomorrow
    if (nextRun <= now) {
      nextRun.setDate(nextRun.getDate() + 1);
    }
    
    const initialDelay = nextRun.getTime() - now.getTime();
    config.nextRun = nextRun;
    
    console.log(`⏰ Task ${config.name} scheduled to run at ${nextRun.toISOString()}`);
    
    // Set initial timeout
    const initialTimeout = setTimeout(() => {
      runTask();
      // Then set up recurring interval
      const interval = setInterval(runTask, config.interval);
      this.intervals.set(taskId, interval);
    }, initialDelay);
  }

  /**
   * Execute a specific task
   */
  private async executeTask(taskId: string): Promise<void> {
    switch (taskId) {
      case 'jobCleanup':
        const stats = await jobCleanupService.cleanup();
        console.log(`📊 Job cleanup stats:`, {
          totalExpired: stats.totalExpiredJobs,
          referenced: stats.jobsReferencedBySavedJobs,
          deleted: stats.jobsDeleted,
          errors: stats.errors.length
        });
        break;
      case 'jobDeduplication':
        const dStats = await jobDeduplicationService.deduplicate();
        console.log(`📊 Job dedupe stats:`, {
          scanned: dStats.totalJobsScanned,
          unknownRemoved: dStats.unknownCompanyRemoved,
          groups: dStats.duplicateGroupsFound,
          dupDeleted: dStats.jobsDeletedAsDuplicates,
          repointed: dStats.savedJobsRepointed,
          errors: dStats.errors.length,
        });
        break;
        
      default:
        console.warn(`⚠️  Unknown task: ${taskId}`);
    }
  }

  /**
   * Manually trigger a task
   */
  async triggerTask(taskId: string): Promise<any> {
    const config = this.tasks.get(taskId);
    if (!config) {
      throw new Error(`Task ${taskId} not found`);
    }

    console.log(`🔧 Manually triggering task: ${config.name}`);
    config.lastRun = new Date();
    
    return await this.executeTask(taskId);
  }

  /**
   * Get status of all tasks
   */
  getStatus(): Record<string, any> {
    const status: Record<string, any> = {};
    
    for (const [taskId, config] of this.tasks) {
      status[taskId] = {
        name: config.name,
        enabled: config.enabled,
        interval: config.interval,
        lastRun: config.lastRun,
        nextRun: config.nextRun,
        isRunning: this.intervals.has(taskId)
      };
    }
    
    return status;
  }

  /**
   * Enable or disable a task
   */
  setTaskEnabled(taskId: string, enabled: boolean): void {
    const config = this.tasks.get(taskId);
    if (!config) {
      throw new Error(`Task ${taskId} not found`);
    }

    config.enabled = enabled;
    
    if (enabled && this.isRunning) {
      this.scheduleTask(taskId, config);
    } else if (!enabled && this.intervals.has(taskId)) {
      clearInterval(this.intervals.get(taskId)!);
      this.intervals.delete(taskId);
    }
  }
}

// Export singleton instance
export const scheduledTasksService = new ScheduledTasksService();
