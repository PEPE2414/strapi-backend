import { factories } from '@strapi/strapi';
import crypto from 'node:crypto';

const SECRET_HEADER = 'x-seed-secret';

// Constant-time comparison to prevent timing attacks
function constantTimeCompare(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

function slugify(input: string) {
  return input.toLowerCase().replace(/&/g,' and ').replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'').slice(0,80);
}

export default factories.createCoreController('api::job.job', ({ strapi }) => ({
  async ingest(ctx) {
    const secretHeader = ctx.request.headers[SECRET_HEADER];
    const secret = Array.isArray(secretHeader) ? secretHeader[0] : secretHeader;
    const expectedSecret = process.env.SEED_SECRET || process.env.STRAPI_INGEST_SECRET;
    
    // Debug logging (safe - don't log actual secrets)
    console.log('Auth debug:', {
      hasSecretHeader: !!secretHeader,
      secretLength: secret?.length || 0,
      hasExpectedSecret: !!expectedSecret,
      expectedSecretLength: expectedSecret?.length || 0,
      secretHeaderName: SECRET_HEADER,
      timestamp: new Date().toISOString()
    });
    
    // Validate secret with constant-time comparison
    if (!secret || !expectedSecret || !constantTimeCompare(secret, expectedSecret)) {
      console.warn('Invalid ingest secret provided');
      return ctx.unauthorized('Invalid secret');
    }
    
    const items = ctx.request.body?.data || [];
    if (!Array.isArray(items)) return ctx.badRequest('data must be array');
    
    // Safe logging - don't log sensitive data
    console.log(`Job ingest request: ${items.length} items from ${ctx.request.ip}`);

    let count = 0;
    for (const inJob of items) {
      if (!inJob.hash) continue;

      // ensure slug exists (defensive)
      let slug = inJob.slug;
      if (!slug) {
        const companyName = inJob.company?.name || 'Unknown';
        const base = slugify(`${inJob.title}-${companyName}-${inJob.location || ''}`);
        slug = `${base}-${inJob.hash.slice(0,8)}`;
      }

            // Use raw query to avoid TypeScript issues with hash field
            const existing = await strapi.db.query('api::job.job').findMany({
              where: { hash: inJob.hash },
              limit: 1
            });

      const data = {
        ...inJob,
        slug
      };

      if (existing?.length) {
        console.log(`📝 Updating existing job: ${inJob.title} at ${inJob.company?.name}`);
        await strapi.entityService.update('api::job.job', existing[0].id, { data });
      } else {
        console.log(`✨ Creating new job: ${inJob.title} at ${inJob.company?.name}`);
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

    console.log('[recommendations] User preferences:', user.preferences);
    console.log('[recommendations] User CV analysis:', user.cvAnalysis);
    
    const prefs = user.preferences || {};
    const hard = prefs.hardFilters || {};
    const priorities = prefs.priorities || {};
    const cvAnalysis = user.cvAnalysis || null;

    console.log('[recommendations] Hard filters:', hard);
    console.log('[recommendations] Priorities:', priorities);
    console.log('[recommendations] CV analysis available:', !!cvAnalysis);

    // DB prefilter: only fresh jobs with optional hard filters
    const filters: any = { };
    if (hard.countries?.length) filters.location = { $containsi: hard.countries[0] }; // simple example
    // Remove the deadline filter as it's causing issues - filter by applyDeadline instead
    if (prefs.onlyActive !== false) {
      filters.$or = [
        { applyDeadline: { $null: true } }, 
        { applyDeadline: { $gte: new Date().toISOString() } }
      ];
    }

    console.log('[recommendations] Filters:', JSON.stringify(filters));

    const candidates = await strapi.entityService.findMany('api::job.job', {
      filters,
      sort: { createdAt: 'desc' },
      limit: 400
    });

    console.log('[recommendations] Found candidates:', candidates.length);

    const W = normalise(priorities);
    const scored = candidates.map((j:any) => ({ job: j, score: score(j, W, prefs, cvAnalysis) }))
      .sort((a,b)=>b.score - a.score)
      .slice(0, 60)
      .map(x=>({ ...x.job, _score: Math.round(x.score) }));

    console.log('[recommendations] Returning scored jobs:', scored.length);

    ctx.body = { items: scored };
  },

  // Test endpoint to verify authentication setup
  async testAuth(ctx) {
    const secretHeader = ctx.request.headers[SECRET_HEADER];
    const secret = Array.isArray(secretHeader) ? secretHeader[0] : secretHeader;
    const expectedSecret = process.env.SEED_SECRET || process.env.STRAPI_INGEST_SECRET;
    
    ctx.body = {
      status: 'ok',
      auth: {
        hasSecretHeader: !!secretHeader,
        secretLength: secret?.length || 0,
        hasExpectedSecret: !!expectedSecret,
        expectedSecretLength: expectedSecret?.length || 0,
        secretHeaderName: SECRET_HEADER,
        matches: secret && expectedSecret ? constantTimeCompare(secret, expectedSecret) : false
      }
    };
  }
}));

function normalise(p: any) {
  const keys = ['jobType','salary','location','degreeMatch','skillsMatch','experienceMatch','startDate','recency','remoteType'];
  const base: Record<string, number> = {};
  let sum = 0;
  for (const k of keys) { const v = Math.max(0, Math.min(3, Number(p?.[k] ?? 1))); base[k]=v; sum+=v; }
  const out: Record<string, number> = {};
  for (const k of keys) out[k] = sum ? base[k]/sum : (k==='recency'?1:0);
  return out;
}

function score(j:any, W:any, prefs:any, cvAnalysis?: any) {
  // Get user's preferred job types as lowercase array
  const preferredJobTypes = prefs.hardFilters?.targetJobTypes 
    ? (Array.isArray(prefs.hardFilters.targetJobTypes) 
        ? prefs.hardFilters.targetJobTypes.map((t: string) => t.toLowerCase())
        : [String(prefs.hardFilters.targetJobTypes).toLowerCase()])
    : prefs.targetJobType 
      ? [String(prefs.targetJobType).toLowerCase()]
      : [];
  
  // Calculate job type match (case-insensitive)
  const jobTypeLower = String(j.jobType || '').toLowerCase();
  let jobTypeScore = 0.5; // default
  
  if (preferredJobTypes.length > 0) {
    if (preferredJobTypes.includes(jobTypeLower)) {
      jobTypeScore = 1.0; // Perfect match
    } else if (jobTypeLower === 'other') {
      jobTypeScore = 0; // Don't recommend "other" jobs
    } else {
      jobTypeScore = 0.3; // Partial match
    }
  }

  // Enhanced skills matching with CV analysis
  const skillsToMatch = cvAnalysis?.skills?.length > 0 ? cvAnalysis.skills : prefs.skillsWanted;
  const skillsMatchScore = overlapWithConfidence(j.skills, skillsToMatch, cvAnalysis?.confidence);
  
  // Experience level filtering using CV analysis
  const experienceMatchScore = cvAnalysis ? getExperienceMatchScore(j, cvAnalysis.experienceLevel) : 0.5;
  
  const S = {
    jobType: jobTypeScore,
    salary: j.salary?.min ? Math.min(1, (j.salary.min / 45000)) : 0.3,
    location: prefs.locationHome ? (j.location?.toLowerCase().includes(prefs.locationHome.city?.toLowerCase()) ? 1 : 0.5) : 0.5,
    degreeMatch: overlap(j.relatedDegree, prefs.mustIncludeDegrees),
    skillsMatch: skillsMatchScore,
    experienceMatch: experienceMatchScore,
    startDate: j.startDate ? timeSoon(j.startDate) : 0.5,
    recency: j.postedAt ? timeDecay(j.postedAt) : 0.5,
    remoteType: j.remoteType && prefs.remoteType ? (j.remoteType===prefs.remoteType?1:0.3) : 0.5
  };
  return 100 * Object.entries(W).reduce((acc,[k,w]) => acc + (w as number)*(S as any)[k], 0);
}

function overlap(a?: string[], b?: string[]) {
  if (!a?.length || !b?.length) return 0.4;
  const setB = new Set(b.map(x=>x.toLowerCase()));
  const inter = a.filter(x=>setB.has(x.toLowerCase())).length;
  return inter ? Math.min(1, inter / Math.max(1,a.length)) : 0.2;
}

function overlapWithConfidence(a?: string[], b?: string[], confidence?: number) {
  const baseScore = overlap(a, b);
  if (!confidence || confidence <= 0) return baseScore;
  
  // Boost score based on CV analysis confidence (up to 1.2x multiplier)
  const confidenceBoost = 1 + (confidence * 0.2);
  return Math.min(1, baseScore * confidenceBoost);
}

function getExperienceMatchScore(job: any, userExperienceLevel: string): number {
  // Map job experience requirements to experience levels
  const jobExperience = String(job.experience || '').toLowerCase();
  const jobTitle = String(job.title || '').toLowerCase();
  
  // Determine expected experience level for the job
  let expectedLevel = 'unknown';
  
  if (jobExperience.includes('senior') || jobExperience.includes('lead') || jobExperience.includes('5+') || jobExperience.includes('7+')) {
    expectedLevel = 'senior';
  } else if (jobExperience.includes('mid') || jobExperience.includes('3+') || jobExperience.includes('4+')) {
    expectedLevel = 'mid';
  } else if (jobExperience.includes('junior') || jobExperience.includes('entry') || jobExperience.includes('1+') || jobExperience.includes('2+')) {
    expectedLevel = 'junior';
  } else if (jobExperience.includes('intern') || jobExperience.includes('student') || jobExperience.includes('graduate')) {
    expectedLevel = 'intern';
  } else if (jobTitle.includes('senior') || jobTitle.includes('lead') || jobTitle.includes('principal')) {
    expectedLevel = 'senior';
  } else if (jobTitle.includes('junior') || jobTitle.includes('entry') || jobTitle.includes('graduate')) {
    expectedLevel = 'junior';
  } else if (jobTitle.includes('intern')) {
    expectedLevel = 'intern';
  }
  
  // Score based on experience match
  if (expectedLevel === 'unknown' || userExperienceLevel === 'unknown') {
    return 0.5; // Neutral score if we can't determine
  }
  
  // Experience level hierarchy for matching
  const levels = ['intern', 'junior', 'mid', 'senior'];
  const userLevelIndex = levels.indexOf(userExperienceLevel);
  const expectedLevelIndex = levels.indexOf(expectedLevel);
  
  if (userLevelIndex === -1 || expectedLevelIndex === -1) return 0.5;
  
  const levelDiff = Math.abs(userLevelIndex - expectedLevelIndex);
  
  // Perfect match
  if (levelDiff === 0) return 1.0;
  
  // One level difference (e.g., junior applying for mid-level)
  if (levelDiff === 1) return 0.7;
  
  // Two levels difference
  if (levelDiff === 2) return 0.4;
  
  // Three levels difference (e.g., intern applying for senior)
  return 0.1;
}

function timeDecay(iso: string) { const days = (Date.now()-new Date(iso).getTime())/(1000*3600*24); return Math.exp(-days/21); }
function timeSoon(iso: string) { const days = (new Date(iso).getTime()-Date.now())/(1000*3600*24); return days<0?0.3: Math.exp(-Math.max(0,days)/60); }
