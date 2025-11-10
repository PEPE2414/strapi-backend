import 'dotenv/config';
import { createStrapi } from '@strapi/strapi';
import { jobIndustryBackfillService } from '../services/jobIndustryBackfill';

async function main() {
  const args = process.argv.slice(2);
  const reclassifyAll = args.includes('--all');

  const app = await createStrapi();
  await app.start();

  try {
    const stats = await jobIndustryBackfillService.backfill({ reclassifyAll });
    console.log('Industry backfill completed:', stats);
  } catch (error) {
    console.error('Industry backfill failed', error);
    process.exitCode = 1;
  } finally {
    await app.destroy();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

