/**
 * Scheduled Tasks Service
 * 
 * Handles periodic background tasks for the application.
 * Currently manages job cleanup scheduling.
 */

import { jobCleanupService } from './jobCleanup';
import { jobDeduplicationService } from './jobDeduplication';
import { jobLinkCheckerService } from './jobLinkChecker';
import { jobIndustryBackfillService } from './jobIndustryBackfill';

interface ScheduledTaskConfig {
  name: string;
  interval: number; // in milliseconds
  enabled: boolean;
  targetHour: number;
  targetMinute: number;
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
    // Job cleanup runs daily at 12:00 (Europe/London)
    this.tasks.set('jobCleanup', {
      name: 'Job Cleanup',
      interval: 24 * 60 * 60 * 1000,
      enabled: true,
      targetHour: 12,
      targetMinute: 0
    });

    // Job deduplication runs daily at 12:10 (Europe/London)
    this.tasks.set('jobDeduplication', {
      name: 'Job Deduplication',
      interval: 24 * 60 * 60 * 1000,
      enabled: true,
      targetHour: 12,
      targetMinute: 10
    });

    // Job link checker runs daily at 23:50 (Europe/London)
    this.tasks.set('jobLinkCheck', {
      name: 'Job Link Verification',
      interval: 24 * 60 * 60 * 1000,
      enabled: true,
      targetHour: 23,
      targetMinute: 50
    });

    // Job industry backfill runs daily at 03:15 (Europe/London)
    this.tasks.set('jobIndustryBackfill', {
      name: 'Job Industry Backfill',
      interval: 24 * 60 * 60 * 1000,
      enabled: true,
      targetHour: 3,
      targetMinute: 15
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

    const computeInitialDelayForLondon = (targetHour: number, targetMinute: number): { delayMs: number; nextRun: Date } => {
      const now = new Date();
      let candidate = new Date(now.getTime() + 1000); // start searching from the next second

      const fmt = new Intl.DateTimeFormat('en-GB', {
        timeZone: 'Europe/London',
        hour12: false,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      });

      const getHM = (d: Date): { h: number; m: number } => {
        const parts = fmt.formatToParts(d);
        const h = Number(parts.find(p => p.type === 'hour')?.value || '0');
        const m = Number(parts.find(p => p.type === 'minute')?.value || '0');
        return { h, m };
      };

      // Find the next time in real milliseconds when London time equals targetHour:targetMinute
      // We iterate minute by minute to handle DST transitions (23/25-hour days)
      let attempts = 0;
      while (attempts < 2880) { // up to 2 days
        const { h, m } = getHM(candidate);
        if (h === targetHour && m === targetMinute) {
          const delayMs = Math.max(0, candidate.getTime() - now.getTime());
          return { delayMs, nextRun: candidate };
        }
        candidate = new Date(candidate.getTime() + 60 * 1000);
        attempts++;
      }
      // Fallback: 24 hours from now
      return { delayMs: 24 * 60 * 60 * 1000, nextRun: new Date(now.getTime() + 24 * 60 * 60 * 1000) };
    };

    const { delayMs: initialDelay, nextRun } = computeInitialDelayForLondon(config.targetHour, config.targetMinute);

    config.nextRun = nextRun;
    console.log(`⏰ Task ${config.name} scheduled to run at ${nextRun.toISOString()} (Europe/London ${config.targetHour.toString().padStart(2, '0')}:${config.targetMinute.toString().padStart(2, '0')})`);
    
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
      case 'jobLinkCheck':
        const linkStats = await jobLinkCheckerService.run();
        console.log(`📊 Job link check stats:`, {
          checked: linkStats.checked,
          expired: linkStats.expired,
          active: linkStats.active,
          errors: linkStats.errors.length
        });
        break;
      case 'jobIndustryBackfill':
        const industryStats = await jobIndustryBackfillService.backfill();
        console.log(`📊 Job industry backfill stats:`, industryStats);
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
