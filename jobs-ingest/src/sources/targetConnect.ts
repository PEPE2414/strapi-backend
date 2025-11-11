import { CanonicalJob } from '../types';
import { classifyJobType, isRelevantJobType, isUKJob, toISO, cleanJobDescription } from '../lib/normalize';
import { generateJobHash } from '../lib/jobHash';

type TargetConnectFeed = {
  university: string;
  url: string;
};

type TargetConnectJob = {
  id?: string | number;
  title?: string;
  jobTitle?: string;
  name?: string;
  organisation?: { name?: string };
  organization?: { name?: string };
  company?: { name?: string } | string;
  description?: string;
  summary?: string;
  details?: string;
  applyUrl?: string;
  applicationUrl?: string;
  url?: string;
  locations?: Array<{ name?: string }>;
  location?: { name?: string } | string;
  city?: string;
  closingDate?: string;
  closing_date?: string;
  deadline?: string;
  createdAt?: string;
  created_at?: string;
  posted?: string;
  publishDate?: string;
  postedDate?: string;
  published_at?: string;
};

const TARGETCONNECT_FEEDS: TargetConnectFeed[] = [
  { university: 'Bath', url: 'https://bath.targetconnect.net/api/jobs/public-feed' },
  { university: 'Bristol', url: 'https://bristol.targetconnect.net/api/jobs/public-feed' },
  { university: 'UCL', url: 'https://ucl.targetconnect.net/api/jobs/public-feed' },
  { university: 'Exeter', url: 'https://exeter.targetconnect.net/api/jobs/public-feed' },
  { university: 'Nottingham', url: 'https://nottingham.targetconnect.net/api/jobs/public-feed' },
  { university: 'Loughborough', url: 'https://lboro.targetconnect.net/api/jobs/public-feed' },
  { university: 'Durham', url: 'https://durham.targetconnect.net/api/jobs/public-feed' },
  { university: 'Southampton', url: 'https://southampton.targetconnect.net/api/jobs/public-feed' },
  { university: 'Lancaster', url: 'https://lancaster.targetconnect.net/api/jobs/public-feed' },
  { university: 'Reading', url: 'https://reading.targetconnect.net/api/jobs/public-feed' },
  { university: 'Leicester', url: 'https://le.ac.uk/targetconnect/api/jobs/public-feed' },
  { university: 'Kent', url: 'https://kent.targetconnect.net/api/jobs/public-feed' },
  { university: 'Birmingham', url: 'https://birmingham.targetconnect.net/api/jobs/public-feed' },
  { university: 'Nottingham Trent', url: 'https://ntu.targetconnect.net/api/jobs/public-feed' },
  { university: 'Newcastle', url: 'https://ncl.targetconnect.net/api/jobs/public-feed' },
  { university: "Queen Mary London", url: 'https://qmul.targetconnect.net/api/jobs/public-feed' },
  { university: 'Portsmouth', url: 'https://port.ac.uk/targetconnect/api/jobs/public-feed' },
  { university: 'Essex', url: 'https://essex.targetconnect.net/api/jobs/public-feed' },
  { university: 'Surrey', url: 'https://surrey.targetconnect.net/api/jobs/public-feed' },
  { university: 'Cardiff', url: 'https://cardiff.targetconnect.net/api/jobs/public-feed' },
  { university: 'Swansea', url: 'https://swansea.targetconnect.net/api/jobs/public-feed' },
  { university: 'Aberystwyth', url: 'https://aberystwyth.targetconnect.net/api/jobs/public-feed' },
  { university: 'Ulster', url: 'https://ulster.targetconnect.net/api/jobs/public-feed' },
  { university: "Queen's Belfast", url: 'https://qub.targetconnect.net/api/jobs/public-feed' },
  { university: 'Huddersfield', url: 'https://hud.targetconnect.net/api/jobs/public-feed' },
  { university: 'Sheffield Hallam', url: 'https://shu.targetconnect.net/api/jobs/public-feed' },
  { university: 'York', url: 'https://york.targetconnect.net/api/jobs/public-feed' },
  { university: 'Leeds', url: 'https://leeds.targetconnect.net/api/jobs/public-feed' },
  { university: 'Liverpool', url: 'https://liverpool.targetconnect.net/api/jobs/public-feed' },
  { university: 'Manchester Metropolitan', url: 'https://mmu.targetconnect.net/api/jobs/public-feed' },
  { university: 'Coventry', url: 'https://coventry.targetconnect.net/api/jobs/public-feed' },
  { university: 'Keele', url: 'https://keele.targetconnect.net/api/jobs/public-feed' },
  { university: 'Hull', url: 'https://hull.targetconnect.net/api/jobs/public-feed' },
  { university: 'Stirling', url: 'https://stir.ac.uk/targetconnect/api/jobs/public-feed' },
  { university: 'Strathclyde', url: 'https://strath.ac.uk/targetconnect/api/jobs/public-feed' },
  { university: 'Dundee', url: 'https://dundee.targetconnect.net/api/jobs/public-feed' },
  { university: 'Aberdeen', url: 'https://abdn.targetconnect.net/api/jobs/public-feed' },
  { university: 'Heriot-Watt', url: 'https://hw.ac.uk/targetconnect/api/jobs/public-feed' },
  { university: 'St Andrews', url: 'https://standrews.targetconnect.net/api/jobs/public-feed' }
];

export async function scrapeTargetConnectFeeds(): Promise<CanonicalJob[]> {
  const collected: CanonicalJob[] = [];

  for (const feed of TARGETCONNECT_FEEDS) {
    try {
      const response = await fetch(feed.url, { method: 'GET' });
      if (!response.ok) {
        console.warn(`⚠️  TargetConnect feed failed (${feed.university}): ${response.status} ${response.statusText}`);
        continue;
      }

      let data: any;
      try {
        data = await response.json();
      } catch (error) {
        console.warn(`⚠️  TargetConnect feed not JSON (${feed.university})`);
        continue;
      }

      const jobs = extractTargetConnectJobs(data);
      if (jobs.length === 0) {
        console.log(`  📄 TargetConnect feed ${feed.university} returned no jobs`);
        continue;
      }

      console.log(`  📦 TargetConnect ${feed.university}: ${jobs.length} jobs`);

      for (const job of jobs) {
        const canonical = convertTargetConnectJob(job, feed);
        if (!canonical) continue;

        const text = `${canonical.title} ${canonical.descriptionText || canonical.descriptionHtml || ''} ${canonical.location || ''}`;
        if (!isRelevantJobType(text)) continue;
        if (!isUKJob(text)) continue;

        collected.push(canonical);
      }
    } catch (error) {
      console.warn(`⚠️  Error fetching TargetConnect feed ${feed.university}:`, error instanceof Error ? error.message : String(error));
    }
  }

  console.log(`✅ TargetConnect feeds collected ${collected.length} jobs`);
  return collected;
}

function extractTargetConnectJobs(payload: any): TargetConnectJob[] {
  if (!payload) return [];
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload.jobs)) return payload.jobs;
  if (Array.isArray(payload.data?.jobs)) return payload.data.jobs;
  if (Array.isArray(payload.results)) return payload.results;
  return [];
}

function convertTargetConnectJob(job: TargetConnectJob, feed: TargetConnectFeed): CanonicalJob | null {
  const title = job.title || job.jobTitle || job.name;
  const company =
    (typeof job.company === 'string' ? job.company : job.company?.name) ||
    job.organisation?.name ||
    job.organization?.name ||
    'Unknown Company';
  const applyUrl = job.applyUrl || job.applicationUrl || job.url;
  if (!title || !applyUrl) {
    return null;
  }

  const location =
    (Array.isArray(job.locations) && job.locations.length > 0 && job.locations[0]?.name) ||
    (typeof job.location === 'string' ? job.location : job.location?.name) ||
    job.city ||
    'United Kingdom';

  const description = job.description || job.summary || job.details || '';
  const cleanDescription = cleanJobDescription(description);
  const jobType = classifyJobType(`${title} ${cleanDescription}`);
  if (jobType === 'other') {
    return null;
  }

  const postedAt = toISO(job.createdAt || job.created_at || job.posted || job.publishDate || job.postedDate);
  const applyDeadline = toISO(job.closingDate || job.closing_date || job.deadline);

  const hash = generateJobHash({
    title,
    company,
    applyUrl,
    location,
    postedAt
  });

  return {
    source: `targetconnect:${feed.university.toLowerCase().replace(/\s+/g, '-')}`,
    sourceUrl: feed.url,
    title,
    company: { name: company },
    location,
    applyUrl,
    jobType,
    descriptionText: cleanDescription,
    postedAt,
    applyDeadline,
    slug: generateSlug(title, company),
    hash
  };
}

function generateSlug(title: string, company: string): string {
  return `${title}-${company}`.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80);
}


