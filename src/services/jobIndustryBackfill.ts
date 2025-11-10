import { classifyIndustry } from '../../jobs-ingest/src/lib/industryClassifier';

interface IndustryBackfillOptions {
  reclassifyAll?: boolean;
  limit?: number;
}

interface IndustryBackfillStats {
  totalJobs: number;
  candidates: number;
  updated: number;
  unchanged: number;
  unclassified: number;
  errors: string[];
}

type JobRecord = {
  id: number;
  title?: string | null;
  descriptionText?: string | null;
  descriptionHtml?: string | null;
  company?: { name?: string };
  source?: string | null;
  jobType?: string | null;
  industry?: string | null;
};

const DEFAULT_BATCH_SIZE = 200;

export class JobIndustryBackfillService {
  private buildWhereClause(reclassifyAll: boolean) {
    if (reclassifyAll) {
      return {};
    }

    return {
      $or: [
        { industry: { $null: true } },
        { industry: { $eq: '' } }
      ]
    };
  }

  private async fetchJobsBatch(
    where: Record<string, unknown>,
    offset: number,
    limit: number
  ): Promise<JobRecord[]> {
    return await strapi.db.query('api::job.job').findMany({
      where,
      select: ['id', 'title', 'descriptionText', 'descriptionHtml', 'company', 'source', 'jobType', 'industry'],
      offset,
      limit,
      orderBy: { createdAt: 'asc' }
    }) as unknown as JobRecord[];
  }

  async backfill(options: IndustryBackfillOptions = {}): Promise<IndustryBackfillStats> {
    const { reclassifyAll = false, limit = DEFAULT_BATCH_SIZE } = options;

    const whereClause = this.buildWhereClause(reclassifyAll);

    const totalJobs = await strapi.db.query('api::job.job').count();
    const candidates = await strapi.db.query('api::job.job').count({ where: whereClause });

    const stats: IndustryBackfillStats = {
      totalJobs,
      candidates,
      updated: 0,
      unchanged: 0,
      unclassified: 0,
      errors: []
    };

    if (candidates === 0) {
      strapi.log.info('🏁 Industry backfill: no jobs to process');
      return stats;
    }

    strapi.log.info(`🏁 Industry backfill starting (${candidates} candidate jobs, reclassifyAll=${reclassifyAll})`);

    for (let offset = 0; offset < candidates; offset += limit) {
      const batch = await this.fetchJobsBatch(whereClause, offset, limit);
      if (batch.length === 0) {
        break;
      }

      for (const job of batch) {
        try {
          const title = job.title ?? '';
          const description = job.descriptionText || job.descriptionHtml || '';
          const companyName = job.company?.name || '';
          const source = job.source || '';
          const hints = [source, job.jobType || '', companyName].filter(Boolean);

          const inferredIndustry = classifyIndustry({
            title,
            description,
            company: companyName,
            hints
          });

          if (!inferredIndustry) {
            stats.unclassified++;
            continue;
          }

          if (!reclassifyAll && job.industry === inferredIndustry) {
            stats.unchanged++;
            continue;
          }

          await strapi.entityService.update('api::job.job', job.id, {
            data: { industry: inferredIndustry }
          });
          stats.updated++;
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          stats.errors.push(`Job ${job.id}: ${message}`);
          strapi.log.error(`❌ Failed to backfill industry for job ${job.id}`, error);
        }
      }
    }

    strapi.log.info(`🏁 Industry backfill completed`, stats);
    return stats;
  }
}

export const jobIndustryBackfillService = new JobIndustryBackfillService();

