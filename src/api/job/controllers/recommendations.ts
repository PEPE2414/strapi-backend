// backend/src/api/job/controllers/recommendations.ts
type JWTPayload = { id?: number; sub?: number };

const JOB_UID = 'api::job.job'; // <-- CHANGE ME if your UID differs

// Light normalizer from your scrapes to features the matcher expects.
function normalizeJob(j: any) {
  const title = (j.title || '').trim();
  const company = (j.company || '').trim();
  const location = (j.location || '').trim();
  const description = (j.description || '').trim();
  const jobTypeRaw = (j.job_type || '').trim(); // e.g., "Graduate" | "Internship" | "Placement/Year in Industry"
  const startDate = j.start_date ? new Date(j.start_date) : null;
  const endDate = j.end_date ? new Date(j.end_date) : null;
  const salaryRaw = (j.salary || '').trim();
  const visaNotes = (j.visa_notes || '').trim(); // NEW (optional) – add to your job schema when ready
  const relatedDegree = (j.related_degree || '').trim();
  const degreeLevel = (j.degree_level || '').trim();

  // job types -> array
  const jobTypes = jobTypeRaw
    ? jobTypeRaw.split(/[\/,]| or /i).map((s: string) => s.trim()).filter(Boolean)
    : [];

  // detect remote / hybrid from location/title/description keywords
  const text = `${title} ${location} ${description}`.toLowerCase();
  const isRemote = /\bremote\b/.test(text);
  const isHybrid = /\bhybrid\b/.test(text);

  // Salary band from string
  function toBand(s: string): string {
    if (!s) return 'Unknown';
    const s£ = s.replace(/[, ]/g, '').toLowerCase();
    if (/\b(30k|£30|30000)\b/.test(s£)) return '£30k+';
    if (/\b(25k|£25|25000)\b/.test(s£)) return '£25k+';
    if (/\b(20k|£20|20000)\b/.test(s£)) return '£20k+';
    if (/\b(10k|£10|10000)\b/.test(s£)) return '£10k+';
    return 'Unknown';
  }

  // Work rights bucket
  // `visaNotes` could be 'sponsorship available', 'no sponsorship', etc.
  let workRights: 'any' | 'uk-right' | 'visa-sponsor' | 'unknown' = 'unknown';
  if (visaNotes) {
    const v = visaNotes.toLowerCase();
    if (/\bsponsorship\b/.test(v)) workRights = 'visa-sponsor';
    else if (/\bno sponsorship\b|\bnot sponsor/i.test(v)) workRights = 'uk-right';
  }

  // Start date bucket (month buckets, ASAP if within 30 days)
  function startBucket(d: Date | null): string {
    if (!d) return 'Any';
    const now = new Date();
    const diffDays = (d.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
    if (diffDays <= 30) return 'ASAP';
    const m = d.toLocaleString('en-GB', { month: 'short' });
    const y = d.getFullYear();
    return `${m} ${y}`; // e.g., 'Sep 2025'
  }

  // Study fields – map from your fields
  const studyFields: string[] = [];
  if (relatedDegree) studyFields.push(relatedDegree);
  // degreeLevel not used for matching, but you can keep it for the UI.

  return {
    id: j.id,
    title,
    company,
    location,
    description,
    applyURL: j.applyURL || j.apply_url || j.applyLink,
    deadline: endDate || j.deadline ? new Date(j.deadline || endDate) : null,
    jobTypes,               // ['Graduate','Internship',...]
    isRemote,
    isHybrid,
    salaryBand: toBand(salaryRaw),  // 'Any' | '£10k+' | '£20k+' | '£25k+' | '£30k+' | 'Unknown'
    workRights,             // 'any'|'uk-right'|'visa-sponsor'|'unknown'
    startDateBucket: startBucket(startDate), // 'ASAP' | 'Sep 2025' | 'Any' ...
    studyFields,            // from related_degree
    // industry not present yet in your scrape; matcher will treat unknown neutrally
    industries: Array.isArray(j.industries) ? j.industries : [],
  };
}

// factor-by-factor scoring (explainable)
function scoreJob(job: any, prefs: any, weightMap: Record<string, number>, explain = false) {
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
    const picks = values['Location'] || [];
    let s = 0.5; // neutral for unknown/empty prefs
    if (Array.isArray(picks) && picks.length) {
      const lower = picks.map((p: string) => p.toLowerCase());
      const loc = (job.location || '').toLowerCase();
      if (job.isRemote || job.isHybrid) s = 0.8;
      if (lower.some((p: string) => loc.includes(p))) s = 1;
      else if (!loc) s = 0.5;
      else s = 0.0;
    }
    add('Location', s, s === 1 ? `matched (${job.location || 'remote/hybrid'})` :
                              s === 0.8 ? 'remote/hybrid' :
                              s === 0.5 ? 'unknown/neutral' : 'no match');
  }

  // Job type
  {
    const picks = values['Job type'] || [];
    let s = 0.5;
    if (Array.isArray(picks) && picks.length) {
      const a = new Set(job.jobTypes.map((x: string) => x.toLowerCase()));
      const b = new Set(picks.map((x: string) => x.toLowerCase()));
      const inter = [...a].filter((x) => b.has(x)).length;
      s = picks.length ? inter / picks.length : 0.5;
    }
    add('Job type', s, `${(s * 100).toFixed(0)}% of your types`);
  }

  // Industry
  {
    const picks = values['Industry'] || [];
    let s = 0.5;
    if (Array.isArray(picks) && picks.length) {
      const jobInd = (job.industries || []).map((x: string) => x.toLowerCase());
      const b = new Set(picks.map((x: string) => x.toLowerCase()));
      const inter = jobInd.filter((x: string) => b.has(x)).length;
      if (!jobInd.length) s = 0.5; // unknown -> neutral
      else s = picks.length ? inter / picks.length : 0.5;
    }
    add('Industry', s, job.industries?.length ? `${(s * 100).toFixed(0)}% overlap` : 'unknown');
  }

  // Salary
  {
    const pref = values['Salary'] || 'Any';
    const ladder = ['Any', '£10k+', '£20k+', '£25k+', '£30k+'];
    const jb = job.salaryBand || 'Unknown';
    let s = 0.5;
    if (pref === 'Any') s = jb === 'Unknown' ? 0.5 : 1.0;
    else {
      const jp = ladder.indexOf(jb);
      const pp = ladder.indexOf(pref);
      if (jp === -1) s = 0.5;
      else s = jp >= pp ? 1.0 : 0.0;
    }
    add('Salary', s, `${jb} vs ${pref}`);
  }

  // Work rights
  {
    const pref = values['Work rights'] || 'Any';
    let s = 0.7; // neutral-ish
    if (pref === 'Any') s = job.workRights === 'unknown' ? 0.7 : 1.0;
    else if (pref === 'Right to work (UK)') {
      // if job explicitly says only sponsorship -> incompatible
      s = job.workRights === 'visa-sponsor' ? 0.2 : 1.0;
    } else if (pref === 'Visa sponsorship') {
      if (job.workRights === 'visa-sponsor') s = 1.0;
      else if (job.workRights === 'unknown') s = 0.5;
      else s = 0.2;
    }
    add('Work rights', s, `${job.workRights}`);
  }

  // Start date
  {
    const pref = values['Start date'] || 'Any';
    const actual = job.startDateBucket || 'Any';
    let s = 0.6;
    if (pref === 'Any') s = 1.0;
    else if (actual === 'Any') s = 0.6;
    else if (actual === pref) s = 1.0;
    else {
      // "near" month gets 0.6
      const near = (a: string, b: string) => {
        const pa = a.split(' '); const pb = b.split(' ');
        if (pa.length === 2 && pb.length === 2) {
          const da = new Date(pa[1] + '-' + pa[0] + '-01');
          const db = new Date(pb[1] + '-' + pb[0] + '-01');
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
    const pref = values['Study field'] || '';
    let s = 0.6;
    if (!pref) s = 0.6;
    else if ((job.studyFields || []).some((f: string) => f.toLowerCase() === pref.toLowerCase())) s = 1.0;
    else s = 0.6; // adjacent mapping can be added later
    add('Study field', s, pref ? `targeted: ${pref}` : 'not set');
  }

  // Keywords
  {
    const kws: string[] = Array.isArray(values['Keywords']) ? values['Keywords'] : [];
    let s = 0.5;
    if (kws.length) {
      const text = (job.title + '\n' + job.description).toLowerCase();
      const titleText = (job.title || '').toLowerCase();
      let titleHits = 0, bodyHits = 0;
      kws.forEach((kw) => {
        const k = (kw || '').trim().toLowerCase();
        if (!k) return;
        const re = new RegExp(`\\b${k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'g');
        titleHits += (titleText.match(re) || []).length;
        bodyHits += ((job.description || '').toLowerCase().match(re) || []).length;
      });
      const raw = 2 * titleHits + bodyHits;
      s = Math.min(1, raw / Math.max(6, kws.length * 2)); // cap
    }
    add('Keywords', s, kws.length ? `hits weighted` : 'none set');
  }

  return { score: total, reasons };
}

// weights from rank with exponential decay; normalized to sum=1
function weightsFromRank(rank: string[]) {
  const base = 0.85;
  const entries = (rank || []).map((name, i) => [name, Math.pow(base, i)] as const);
  const sum = entries.reduce((a, [, w]) => a + w, 0) || 1;
  const map: Record<string, number> = {};
  entries.forEach(([name, w]) => (map[name] = w / sum));
  return map;
}

export default {
  async find(ctx) {
    // --- 1) JWT verify
    const auth = ctx.request.header.authorization || '';
    const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;
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

    // --- 2) Fetch user (jobPrefs + packages for gating)
    const user = await (strapi as any).entityService.findOne('plugin::users-permissions.user', userId, {
      fields: ['id', 'username', 'email', 'jobPrefs', 'packages'],
    });

    const jobPrefs = user?.jobPrefs;
    if (!jobPrefs || !Array.isArray(jobPrefs.rank) || !jobPrefs.rank.length) {
      ctx.body = { data: [], meta: { prefState: 'missing' } };
      return;
    }

    // Optional package gate (Fast-Track & Effort Free). Keep this if you want hard backend gating.
    const pkgs: string[] = Array.isArray(user?.packages) ? user.packages : [];
    const hasAccess = pkgs.some((p) =>
      ['fast-track', 'effort-free', 'find-track'].includes(String(p).toLowerCase())
    );
    if (!hasAccess) {
      // comment out if you prefer frontend-only gating
      return ctx.forbidden('Package required');
    }

    // --- 3) Query candidate jobs (pool)
    const qLimit = Math.min(Math.max(parseInt(String(ctx.request.query.limit || '50'), 10) || 50, 1), 200);
    const poolMax = Math.min(Math.max(parseInt(String(ctx.request.query.poolMax || '1200'), 10) || 1200, 50), 5000);
    const explain = String(ctx.request.query.explain || 'false') === 'true';

    // Prefer active listings: future deadline OR recent createdAt (fallback)
    const nowISO = new Date().toISOString();
    const candidates = await (strapi as any).entityService.findMany(JOB_UID, {
      // Select only fields we need
      fields: [
        'title','company','location','description','applyURL','deadline','job_type',
        'salary','start_date','end_date','related_degree','degree_level','visa_notes'
      ],
      filters: {
        $or: [
          { deadline: { $gt: nowISO } },
          { createdAt: { $gt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 60).toISOString() } } // last 60d
        ],
      },
      sort: ['deadline:asc', 'createdAt:desc'],
      pagination: { page: 1, pageSize: poolMax },
    });

    // --- 4) Score
    const weightMap = weightsFromRank(jobPrefs.rank);
    const rows = (candidates || []).map((j: any) => {
      const nj = normalizeJob(j);
      const { score, reasons } = scoreJob(nj, jobPrefs, weightMap, explain);
      return { job: nj, score, reasons };
    });

    // Optional small negative to sink obviously senior roles (safety net)
    rows.forEach((r) => {
      const t = (r.job.title + ' ' + r.job.description).toLowerCase();
      if (/\b(senior|lead|principal|manager)\b/.test(t)) r.score *= 0.4;
    });

    // --- 5) Sort + slice + respond
    rows.sort((a: any, b: any) => b.score - a.score);
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
