/**
 * Job Deduplication & Cleanup Service
 *
 * - Removes jobs with unknown company names
 * - Deduplicates jobs using a composite key: (title, company.name, location)
 * - Repoints Saved Jobs (saved-job.jobId) from duplicates to the kept job
 */

interface DeduplicationStats {
  totalJobsScanned: number;
  unknownCompanyRemoved: number;
  duplicateGroupsFound: number;
  jobsDeletedAsDuplicates: number;
  savedJobsRepointed: number;
  errors: string[];
}

type JobRow = {
  id: number | string;
  title: string;
  location: string | null;
  createdAt?: string;
  postedAt?: string | null;
  company?: { name?: string | null } | null;
};

function normalize(value: string | null | undefined): string {
  return (value || '').trim().toLowerCase().replace(/\s+/g, ' ');
}

function buildDedupeKey(job: JobRow): string {
  const titleKey = normalize(job.title);
  const companyName = job.company?.name ?? null;
  const companyKey = normalize(companyName);
  const locationKey = normalize(job.location ?? '');
  return `${titleKey}__${companyKey}__${locationKey}`;
}

async function listJobsBatch(offset: number, limit: number): Promise<JobRow[]> {
  // Strapi v5 query engine supports limit/offset
  return await strapi.db.query('api::job.job').findMany({
    select: ['id', 'title', 'location', 'createdAt', 'postedAt', 'company'],
    orderBy: { createdAt: 'asc' },
    offset,
    limit,
  }) as unknown as JobRow[];
}

async function countJobs(): Promise<number> {
  return await strapi.db.query('api::job.job').count({});
}

async function isSavedJobReferencing(jobId: string): Promise<boolean> {
  const count = await strapi.db.query('api::saved-job.saved-job').count({
    where: { jobId: String(jobId) },
  });
  return count > 0;
}

async function repointSavedJobs(fromJobId: string, toJobId: string): Promise<number> {
  // Use direct connection update for efficiency
  const knex = strapi.db.connection as any;
  const updated = await knex('saved_jobs')
    .update({ jobId: String(toJobId) })
    .where({ jobId: String(fromJobId) });
  return Number(updated) || 0;
}

async function deleteJob(jobId: string | number): Promise<void> {
  await strapi.entityService.delete('api::job.job', jobId);
}

async function removeUnknownCompanyJobs(): Promise<{ removed: number }> {
  // Company is JSON with default { name: 'Unknown' }
  // We consider unknown when company.name is empty/null/'unknown' (case-insensitive)
  const candidates = await strapi.db.query('api::job.job').findMany({
    select: ['id', 'company'],
  }) as unknown as JobRow[];

  let removed = 0;
  for (const job of candidates) {
    const companyName = job.company?.name ?? '';
    const isUnknown = normalize(companyName) === 'unknown' || normalize(companyName) === '';
    if (!isUnknown) continue;

    // If referenced by saved jobs, skip deletion to avoid breaking references
    const referenced = await isSavedJobReferencing(String(job.id));
    if (referenced) continue;

    await deleteJob(job.id);
    removed++;
  }

  return { removed };
}

export class JobDeduplicationService {
  async deduplicate(): Promise<DeduplicationStats> {
    const stats: DeduplicationStats = {
      totalJobsScanned: 0,
      unknownCompanyRemoved: 0,
      duplicateGroupsFound: 0,
      jobsDeletedAsDuplicates: 0,
      savedJobsRepointed: 0,
      errors: [],
    };

    try {
      strapi.log.info('🔎 Starting job deduplication & cleanup...');

      // 1) Remove unknown-company jobs (not referenced by saved jobs)
      const unknownResult = await removeUnknownCompanyJobs();
      stats.unknownCompanyRemoved = unknownResult.removed;

      // 2) Load jobs in batches and group by composite key
      const total = await countJobs();
      stats.totalJobsScanned = total;

      const pageSize = 1000;
      const groups = new Map<string, JobRow[]>();

      for (let offset = 0; offset < total; offset += pageSize) {
        const batch = await listJobsBatch(offset, pageSize);
        for (const job of batch) {
          const key = buildDedupeKey(job);
          if (!groups.has(key)) groups.set(key, []);
          groups.get(key)!.push(job);
        }
      }

      // 3) For groups with >1, keep the newest (by postedAt then createdAt), delete others
      for (const [, jobs] of groups) {
        if (jobs.length <= 1) continue;
        stats.duplicateGroupsFound++;

        const sorted = [...jobs].sort((a, b) => {
          const aPosted = a.postedAt ? new Date(a.postedAt).getTime() : 0;
          const bPosted = b.postedAt ? new Date(b.postedAt).getTime() : 0;
          if (aPosted !== bPosted) return bPosted - aPosted;
          const aCreated = a.createdAt ? new Date(a.createdAt).getTime() : 0;
          const bCreated = b.createdAt ? new Date(b.createdAt).getTime() : 0;
          return bCreated - aCreated;
        });

        const keeper = sorted[0];
        const duplicates = sorted.slice(1);

        for (const dup of duplicates) {
          try {
            const referenced = await isSavedJobReferencing(String(dup.id));
            if (referenced) {
              // Repoint saved jobs to the keeper, then delete
              const repointed = await repointSavedJobs(String(dup.id), String(keeper.id));
              stats.savedJobsRepointed += repointed;
            }

            await deleteJob(dup.id);
            stats.jobsDeletedAsDuplicates++;
          } catch (err: any) {
            const msg = `Failed to process duplicate job ${dup.id}: ${err?.message || String(err)}`;
            stats.errors.push(msg);
            strapi.log.error(msg);
          }
        }
      }

      strapi.log.info(
        `✅ Deduplication done. Unknown removed: ${stats.unknownCompanyRemoved}, ` +
        `duplicate groups: ${stats.duplicateGroupsFound}, duplicates deleted: ${stats.jobsDeletedAsDuplicates}, ` +
        `saved jobs repointed: ${stats.savedJobsRepointed}`
      );
    } catch (error: any) {
      const msg = `Deduplication failed: ${error?.message || String(error)}`;
      stats.errors.push(msg);
      strapi.log.error(msg);
    }

    return stats;
  }
}

export const jobDeduplicationService = new JobDeduplicationService();


