import { factories } from '@strapi/strapi';
import crypto from 'node:crypto';

const SECRET_HEADER = 'x-seed-secret';

function slugify(input: string) {
  return input.toLowerCase().replace(/&/g,' and ').replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'').slice(0,80);
}

export default factories.createCoreController('api::job.job', ({ strapi }) => ({
  async ingest(ctx) {
    const secret = ctx.request.header(SECRET_HEADER);
    if (!secret || secret !== process.env.SEED_SECRET && secret !== process.env.STRAPI_INGEST_SECRET) {
      return ctx.unauthorized('Invalid secret');
    }
    const items = ctx.request.body?.data || [];
    if (!Array.isArray(items)) return ctx.badRequest('data must be array');

    let count = 0;
    for (const inJob of items) {
      if (!inJob.hash) continue;

      // ensure slug exists (defensive)
      let slug = inJob.slug;
      if (!slug) {
        const base = slugify(`${inJob.title}-${inJob.company?.name || ''}-${inJob.location || ''}`);
        slug = `${base}-${inJob.hash.slice(0,8)}`;
      }

      const existing = await strapi.entityService.findMany('api::job.job', {
        filters: { hash: inJob.hash },
        limit: 1
      });

      const data = {
        ...inJob,
        slug
      };

      if (existing?.length) {
        await strapi.entityService.update('api::job.job', existing[0].id, { data });
      } else {
        await strapi.entityService.create('api::job.job', { data });
      }
      count++;
    }
    ctx.body = { ok: true, count };
  },

  // Simple per-user recommendations (weights on user.preferences)
  async recommendations(ctx) {
    const user = ctx.state.user;
    if (!user) return ctx.unauthorized();

    const prefs = user.preferences || {};
    const hard = prefs.hardFilters || {};
    const priorities = prefs.priorities || {};

    // DB prefilter: only fresh jobs with optional hard filters
    const filters: any = { };
    if (hard.countries?.length) filters.location = { $containsi: hard.countries[0] }; // simple example
    if (prefs.onlyActive !== false) filters.$or = [{ deadline: { $null: true } }, { deadline: { $gte: new Date() } }];

    const candidates = await strapi.entityService.findMany('api::job.job', {
      filters,
      sort: { postedAt: 'desc' },
      limit: 400
    });

    const W = normalise(priorities);
    const scored = candidates.map((j:any) => ({ job: j, score: score(j, W, prefs) }))
      .sort((a,b)=>b.score - a.score)
      .slice(0, 60)
      .map(x=>({ ...x.job, _score: Math.round(x.score) }));

    ctx.body = { items: scored };
  }
}));

function normalise(p: any) {
  const keys = ['jobType','salary','location','degreeMatch','skillsMatch','startDate','recency','remoteType'];
  const base: Record<string, number> = {};
  let sum = 0;
  for (const k of keys) { const v = Math.max(0, Math.min(3, Number(p?.[k] ?? 1))); base[k]=v; sum+=v; }
  const out: Record<string, number> = {};
  for (const k of keys) out[k] = sum ? base[k]/sum : (k==='recency'?1:0);
  return out;
}

function score(j:any, W:any, prefs:any) {
  const S = {
    jobType: j.jobType === prefs.targetJobType ? 1 : j.jobType==='other'?0:0.5,
    salary: j.salary?.min ? Math.min(1, (j.salary.min / 45000)) : 0.3,
    location: prefs.locationHome ? (j.location?.toLowerCase().includes(prefs.locationHome.city?.toLowerCase()) ? 1 : 0.5) : 0.5,
    degreeMatch: overlap(j.relatedDegree, prefs.mustIncludeDegrees),
    skillsMatch: overlap(j.skills, prefs.skillsWanted),
    startDate: j.startDate ? timeSoon(j.startDate) : 0.5,
    recency: j.postedAt ? timeDecay(j.postedAt) : 0.5,
    remoteType: j.remoteType && prefs.remoteType ? (j.remoteType===prefs.remoteType?1:0.3) : 0.5
  };
  return 100 * Object.entries(W).reduce((acc,[k,w]) => acc + w*(S as any)[k], 0);
}

function overlap(a?: string[], b?: string[]) {
  if (!a?.length || !b?.length) return 0.4;
  const setB = new Set(b.map(x=>x.toLowerCase()));
  const inter = a.filter(x=>setB.has(x.toLowerCase())).length;
  return inter ? Math.min(1, inter / Math.max(1,a.length)) : 0.2;
}
function timeDecay(iso: string) { const days = (Date.now()-new Date(iso).getTime())/(1000*3600*24); return Math.exp(-days/21); }
function timeSoon(iso: string) { const days = (new Date(iso).getTime()-Date.now())/(1000*3600*24); return days<0?0.3: Math.exp(-Math.max(0,days)/60); }
