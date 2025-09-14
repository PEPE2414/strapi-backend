// src/api/job/controllers/recommendations.ts

// NOTE: If your UID differs from api::job.job, change JOB_UID below.
const JOB_UID = 'api::job.job';

type JWTPayload = { id?: number; sub?: number };

// ---------- Normalizer ----------
function normalizeJob(j: any) {
  const title = (j.title || '').trim();
  const company = (j.company || '').trim();
  const location = (j.location || '').trim();
  const description = (j.description || '').trim();

  const jobTypeRaw = (j.job_type || '').trim(); // "Graduate" | "Internship" | "Placement/Year in Industry"
  const startDate = j.start_date ? new Date(j.start_date) : null;
  const endDate = j.end_date ? new Date(j.end_date) : null;
  const salaryRaw = (j.salary || '').trim();
  const visaNotes = (j.visa_notes || '').trim(); // optional in your schema for now
  const relatedDegree = (j.related_degree || '').trim();

  // Job types to array
  const jobTypes: string[] = jobTypeRaw
    ? jobTypeRaw.split(/[\/,]| or /i).map((s: string) => s.trim()).filter(Boolean)
    : [];

  // Remote / Hybrid detection
  const textAll = `${title} ${location} ${description}`.toLowerCase();
  const isRemote = /\bremote\b/i.test(textAll);
  const isHybrid = /\bhybrid\b/i.test(textAll);

  // Salary band from string (ASCII-safe, no '£' in regex)
  function toBand(salary: string): string {
    if (!salary) return 'Unknown';
    const norm = salary.replace(/[, ]/g, '').toLowerCase();
    if (/\b(30k|30000)\b/.test(norm)) return '£30k+';
    if (/\b(25k|25000)\b/.test(norm)) return '£25k+';
    if (/\b(20k|20000)\b/.test(norm)) return '£20k+';
    if (/\b(10k|10000)\b/.test(norm)) return '£10k+';
    return 'Unknown';
  }

  // Work rights bucket from visaNotes
  let workRights: 'any' | 'uk-right' | 'visa-sponsor' | 'unknown' = 'unknown';
  if (visaNotes) {
    const v = visaNotes.toLowerCase();
    if (/\bsponsorship\b/.test(v)) workRights = 'visa-sponsor';
    else if (/\bno sponsorship\b|\bnot sponsor\b/.test(v)) workRights = 'uk-right';
  }

  // Start date bucket
  function startBucket(d: Date | null): string {
    if (!d) return 'Any';
    const now = new Date();
    const diffDays = (d.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
    if (diffDays <= 30) return 'ASAP';
    const m = d.toLocaleString('en-GB', { month: 'short' });
    const y = d.getFullYear();
    return `${m} ${y}`; // e.g., 'Sep 2025'
  }

  // Study fields – basic mapping from related_degree (expand later)
  const studyFields: string[] = [];
  if (relatedDegree) studyFields.push(relatedDegree);

  // Safe deadline
  const deadline: Date | null = j.deadline
    ? new Date(j.deadline)
    : endDate
    ? endDate
    : null;

  return {
    id: j.id,
    title,
    company,
    location,
    description,
    applyURL: j.applyURL || j.apply_url || j.applyLink,
    deadline,
    jobTypes, // ['Graduate','Internship',...]
    isRemote,
    isHybrid,
    salaryBand: toBand(salaryRaw),
    workRights, // 'any'|'uk-right'|'visa-sponsor'|'unknown'
    startDateBucket: startBucket(startDate),
    studyFields,
    industries: Array.isArray(j.industries) ? (j.industries as string[]) : [],
  };
}

// ---------- Scoring ----------
function scoreJob(
  job: ReturnType<typeof normalizeJob>,
  prefs: any,
  weightMap: Record<string, number>,
  explain = false
) {
  const values = prefs?.values || {};
  const reasons: string[] = [];
  let total = 0;

  function add(factor: string, s: number, why?: string) {
    const w = weightMap[factor] || 0;
    total += w * s;
    if (explain && why) reasons.push(`${factor}: ${why} (×${w.toFixed(2)})`);
  }

  // Location
  {
    const picks: string[] = Array.isArray(values['Location']) ? values['Location'] : [];
    let s = 0.5;
    if (picks.length) {
      const lower = picks.map((p) => String(p).toLowerCase());
      const loc = (job.location || '').toLowerCase();
      if (job.isRemote || job.isHybrid) s = 0.8;
      if (lower.some((p) => loc.includes(p))) s = 1;
      else if (!loc) s = 0.5;
      else s = 0.0;
    }
    add(
      'Location',
      s,
      s === 1 ? `matched (${job.location || 'remote/hybrid'})` :
      s === 0.8 ? 'remote/hybrid' :
      s === 0.5 ? 'unknown/neutral' : 'no match'
    );
  }

  // Job type
  {
    const picks: string[] = Array.isArray(values['Job type']) ? values['Job type'] : [];
    let s = 0.5;
    if (picks.length) {
      const a = new Set<string>(job.jobTypes.map((x) => x.toLowerCase()));
      const b = new Set<string>(picks.map((x) => x.toLowerCase()));
      const inter = [...a].filter((x) => b.has(x as string)).length;
      s = picks.length ? inter / picks.length : 0.5;
    }
    add('Job type', s, `${Math.round(s * 100)}% of your types`);
  }

  // Industry
  {
    const picks: string[] = Array.isArray(values['Industry']) ? values['Industry'] : [];
    let s = 0.5;
    if (picks.length) {
      const jobInd: string[] = (job.industries || []).map((x) => String(x).toLowerCase());
      const b = new Set<string>(picks.map((x) => x.toLowerCase()));
      const inter = jobInd.filter((x) => b.has(x)).length;
      s = jobInd.length ? (picks.length ? inter / picks.length : 0.5) : 0.5;
    }
    add('Industry', s, job.industries?.length ? `${Math.round(s * 100)}% overlap` : 'unknown');
  }

  // Salary
  {
    const pref: string = values['Salary'] || 'Any';
    const ladder = ['Any', '£10k+', '£20k+', '£25k+', '£30k+'] as const;
    const jb = job.salaryBand || 'Unknown';
    let s = 0.5;
    if (pref === 'Any') s = jb === 'Unknown' ? 0.5 : 1.0;
    else {
      const jp = ladder.indexOf(jb as any);
      const pp = ladder.indexOf(pref as any);
      s = jp === -1 ? 0.5 : jp >= pp ? 1.0 : 0.0;
    }
    add('Salary', s, `${jb} vs ${pref}`);
  }

  // Work rights
  {
    const pref: string = values['Work rights'] || 'Any';
    let s = 0.7;
    if (pref === 'Any') s = job.workRights === 'unknown' ? 0.7 : 1.0;
    else if (pref === 'Right to work (UK)') {
      s = job.workRights === 'visa-sponsor' ? 0.2 : 1.0;
    } else if (pref === 'Visa sponsorship') {
      if (job.workRights === 'visa-sponsor') s = 1.0;
      else if (job.workRights === 'unknown') s = 0.5;
      else s = 0.2;
    }
    add('Work rights', s, job.workRights);
  }

  // Start date
  {
    const pref: string = values['Start date'] || 'Any';
    const actual = job.startDateBucket || 'Any';
    let s = 0.6;
    if (pref === 'Any') s = 1.0;
    else if (actual === 'Any') s = 0.6;
    else if (actual === pref) s = 1.0;
    else {
      const near = (a: string, b: string) => {
        const pa = a.split(' '); const pb = b.split(' ');
        if (pa.length === 2 && pb.length === 2) {
          const da = new Date(`${pa[1]}-${pa[0]}-01`);
          const db = new Date(`${pb[1]}-${pb[0]}-01`);
          const diff = Math.abs(da.getTime() - db.getTime()) / (1000 * 60 * 60 * 24 * 30);
          return diff <= 1.01;
        }
        return false;
      };
      s = near(actual, pref) ? 0.6 : 0.0;
    }
    add('Start date', s, `${actual} vs ${pref}`);
  }

  // Study field
  {
    const pref: string = values['Study field'] || '';
    let s = 0.6;
    if (pref && (job.studyFields || []).some((f) => f.toLowerCase() === pref.toLowerCase())) s = 1.0;
    add('Study field', s, pref ? `targeted: ${pref}` : 'not set');
  }

  // Keywords (title weighted)
  {
    const kws: string[] = Array.isArray(values['Keywords']) ? values['Keywords'] : [];
    let s = 0.5;
    if (kws.length) {
      const titleText = (job.title || '').toLowerCase();
      const bodyText = (job.description || '').toLowerCase();
      let titleHits = 0, bodyHits = 0;
      kws.forEach((kw) => {
        const k = String(kw || '').trim().toLowerCase();
        if (!k) return;
        const escaped = k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const re = new RegExp(`\\b${escaped}\\b`, 'g');
        titleHits += (titleText.match(re) || []).length;
        bodyHits += (bodyText.match(re) || []).length;
      });
      const raw = 2 * titleHits + bodyHits;
      s = Math.min(1, raw / Math.max(6, kws.length * 2));
    }
    add('Keywords', s, kws.length ? 'hits weighted' : 'none set');
  }

  return { score: total, reasons };
}

// ---------- Weights ----------
function weightsFromRank(rank: string[]) {
  const base = 0.85;
  const entries = (rank || []).map((name, i) => [name, Math.pow(base, i)] as const);
  const sum = entries.reduce((a, [, w]) => a + w, 0) || 1;
  const map: Record<string, number> = {};
  entries.forEach(([name, w]) => (map[name] = w / sum));
  return map;
}

// ---------- Controller ----------
export default {
  async find(ctx: any) {
    // 1) JWT verify
    const authHeader = ctx.request.header.authorization || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
    if (!token) return ctx.unauthorized('Missing Authorization header');

    let userId: number | undefined;
    try {
      const jwtService = (strapi as any).plugin('users-permissions').service('jwt');
      const payload = (await jwtService.verify(token)) as JWTPayload;
      userId = payload?.id ?? payload?.sub;
    } catch {
      return ctx.unauthorized('Invalid token');
    }
    if (!userId) return ctx.unauthorized('Invalid token payload');

    // 2) Fetch user (jobPrefs + packages)
    const user = await (strapi as any).entityService.findOne('plugin::users-permissions.user', userId, {
      fields: ['id', 'jobPrefs', 'packages'],
    });

    const jobPrefs = user?.jobPrefs;
    if (!jobPrefs || !Array.isArray(jobPrefs.rank) || !jobPrefs.rank.length) {
      ctx.body = { data: [], meta: { prefState: 'missing' } };
      return;
    }

    // Optional backend gating (Fast-Track / Effort Free)
    const pkgs: string[] = Array.isArray(user?.packages) ? user.packages : [];
    const hasAccess = pkgs.some((p) =>
      ['fast-track', 'effort-free', 'find-track'].includes(String(p).toLowerCase())
    );
    if (!hasAccess) {
      // Comment this out if you want frontend-only gating
      return ctx.forbidden('Package required');
    }

    // 3) Fetch candidate jobs
    const qLimit = Math.min(Math.max(parseInt(String(ctx.request.query.limit || '50'), 10) || 50, 1), 200);
    const poolMax = Math.min(Math.max(parseInt(String(ctx.request.query.poolMax || '1200'), 10) || 1200, 50), 5000);
    const explain = String(ctx.request.query.explain || 'false') === 'true';

    const nowISO = new Date().toISOString();
    const candidates = await (strapi as any).entityService.findMany(JOB_UID, {
      fields: [
        'title','company','location','description','applyURL','deadline','job_type',
        'salary','start_date','end_date','related_degree','degree_level','visa_notes'
      ],
      filters: {
        $or: [
          { deadline: { $gt: nowISO } },
          { createdAt: { $gt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 60).toISOString() } } // last 60 days
        ],
      },
      sort: ['deadline:asc', 'createdAt:desc'],
      pagination: { page: 1, pageSize: poolMax },
    });

    // 4) Score
    const weightMap = weightsFromRank(jobPrefs.rank as string[]);
    const rows = (candidates || []).map((j: any) => {
      const nj = normalizeJob(j);
      const { score, reasons } = scoreJob(nj, jobPrefs, weightMap, explain);
      return { job: nj, score, reasons };
    });

    // Sink obviously senior roles (safety net)
    rows.forEach((r) => {
      const t = (r.job.title + ' ' + r.job.description).toLowerCase();
      if (/\b(senior|lead|principal|manager)\b/.test(t)) r.score *= 0.4;
    });

    // 5) Sort + slice + respond
    rows.sort((a, b) => b.score - a.score);
    const top = rows.slice(0, qLimit);

    ctx.body = {
      data: top.map((r) => ({
        id: r.job.id,
        title: r.job.title,
        company: r.job.company,
        location: r.job.location,
        applyURL: r.job.applyURL,
        salaryBand: r.job.salaryBand,
        jobTypes: r.job.jobTypes,
        startDateBucket: r.job.startDateBucket,
        workRights: r.job.workRights,
        score: Number(r.score.toFixed(4)),
        ...(explain ? { reasons: r.reasons } : {}),
      })),
      meta: {
        total: rows.length,
        returned: top.length,
        prefState: 'present',
      },
    };
  },
};
