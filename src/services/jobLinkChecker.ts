import Bottleneck from 'bottleneck';
import { checkJobApplyLink } from '../utils/jobLinkCheck';

interface JobLinkCheckStats {
  checked: number;
  expired: number;
  active: number;
  errors: string[];
}

interface JobRecord {
  id: number;
  title: string;
  applyUrl: string | null;
  location?: string | null;
  isExpired?: boolean | null;
  lastCheckedAt?: string | null;
}

export class JobLinkCheckerService {
  private readonly pageSize = Number(process.env.JOB_LINK_CHECK_PAGE_SIZE || 100);
  private readonly maxJobsPerRun = Number(process.env.JOB_LINK_CHECK_LIMIT || 500);
  private readonly recheckHours = Number(process.env.JOB_LINK_CHECK_INTERVAL_HOURS || 24);
  private readonly concurrency = Number(process.env.JOB_LINK_CHECK_CONCURRENCY || 8);
  private readonly timeoutMs = Number(process.env.JOB_LINK_CHECK_TIMEOUT_MS || 10000);

  private limiter = new Bottleneck({
    maxConcurrent: this.concurrency,
    minTime: 100
  });

  async run(): Promise<JobLinkCheckStats> {
    const stats: JobLinkCheckStats = {
      checked: 0,
      expired: 0,
      active: 0,
      errors: []
    };

    try {
      strapi.log.info('🔍 Starting scheduled job link verification...');
      const cutoffIso = new Date(Date.now() - this.recheckHours * 3600 * 1000).toISOString();

      let offset = 0;
      let processed = 0;

      while (processed < this.maxJobsPerRun) {
        const limit = Math.min(this.pageSize, this.maxJobsPerRun - processed);
        const batch = await this.fetchJobBatch(offset, limit, cutoffIso);
        if (!batch.length) break;

        for (const job of batch) {
          await this.limiter.schedule(async () => {
            const result = await this.checkAndUpdate(job);
            stats.checked += 1;
            if (result === 'expired') {
              stats.expired += 1;
            } else if (result === 'active') {
              stats.active += 1;
            } else if (result) {
              stats.errors.push(result);
            }
          });
        }

        offset += batch.length;
        processed += batch.length;

        if (batch.length < limit) break;
      }

      strapi.log.info('📊 Job link verification stats', stats);
      return stats;
    } catch (error) {
      const message = error instanceof Error ? error.stack || error.message : String(error);
      strapi.log.error('❌ Job link verification failed', message);
      stats.errors.push(message);
      return stats;
    }
  }

  private async fetchJobBatch(start: number, limit: number, cutoffIso: string): Promise<JobRecord[]> {
    const filters = {
      $and: [
        { isExpired: { $ne: true } },
        {
          $or: [
            { lastCheckedAt: { $null: true } },
            { lastCheckedAt: { $lte: cutoffIso } }
          ]
        }
      ]
    };

    const jobs = (await strapi.entityService.findMany('api::job.job', {
      fields: ['id', 'title', 'applyUrl', 'location', 'isExpired', 'lastCheckedAt'],
      filters,
      sort: { lastCheckedAt: 'asc' },
      start,
      limit
    })) as JobRecord[];

    return jobs;
  }

  private async checkAndUpdate(job: JobRecord): Promise<'expired' | 'active' | string | null> {
    if (!job.applyUrl) {
      await this.updateJob(job.id, true);
      return 'expired';
    }

    const result = await checkJobApplyLink(job.applyUrl, { timeoutMs: this.timeoutMs });

    try {
      await this.updateJob(job.id, result.expired);
      return result.expired ? 'expired' : 'active';
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      strapi.log.warn(`⚠️ Failed to update job ${job.id}: ${message}`);
      return message;
    }
  }

  private async updateJob(jobId: number, expired: boolean): Promise<void> {
    await strapi.entityService.update('api::job.job', jobId, {
      data: {
        isExpired: expired,
        lastCheckedAt: new Date().toISOString()
      }
    });
  }
}

export const jobLinkCheckerService = new JobLinkCheckerService();

