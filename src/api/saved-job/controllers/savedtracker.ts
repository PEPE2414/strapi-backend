// src/api/saved-job/controllers/savedtracker.ts
// Plain controller for saved-jobs (no factories). Owner-scoped, JWT verified in-controller.
import { checkSavedJobsAccess } from '../../../services/trialAccess';

function toData(entity: any) {
  return { id: entity.id, attributes: entity };
}

// Verify JWT (if route is public) and return the current user's id
async function getUserId(ctx: any) {
  // 1) If users-permissions already populated ctx.state.user, use it
  if (ctx.state?.user?.id) return ctx.state.user.id;

  // 2) If you set a custom jwtUserId elsewhere, accept it too
  if (ctx.state?.jwtUserId) return ctx.state.jwtUserId;

  // 3) Otherwise, verify the Bearer token manually
  const auth = ctx.request?.header?.authorization || ctx.request?.headers?.authorization || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;
  if (!token) return null;

  try {
    // Strapi v5 JWT service
    const payload = await (strapi as any)
      .service('plugin::users-permissions.jwt')
      .verify(token);
    // Common keys: id | userId | sub
    return (payload as any)?.id ?? (payload as any)?.userId ?? (payload as any)?.sub ?? null;
  } catch {
    return null;
  }
}

// Normalize pagination & sort coming as nested objects or bracketed query keys
function normalizeQuery(q: any = {}) {
  const qp = q.pagination || {};
  const page  = Number(q['pagination[page]'] ?? q.page ?? qp.page ?? 1);
  const rawPs = q['pagination[pageSize]'] ?? q.pageSize ?? qp.pageSize ?? 100;
  const pageSize = Number(rawPs);

  // sort can be: 'field:dir' | ['field:dir', ...] | default
  let sort = q.sort ?? ['deadline:asc'];
  if (!Array.isArray(sort)) sort = [String(sort)];

  // filters can arrive either in q.filters or as flat keys; prefer q.filters
  const filters = (q.filters && typeof q.filters === 'object') ? q.filters : undefined;

  return { page, pageSize, sort, filters };
}

function buildOrderBy(sortArr: string[]) {
  return sortArr.map((s: string) => {
    const [field, dir] = String(s).split(':');
    return { [field]: ((dir || 'asc') as 'asc' | 'desc') };
  });
}

export default {
  // GET /saved-jobs
  async find(ctx: any) {
    const userId = await getUserId(ctx);
    if (!userId) return ctx.unauthorized();

    const { page, pageSize, sort, filters } = normalizeQuery(ctx.query);
    const where = { ...(filters || {}), owner: userId };

    // If client asks for "all" in one go
    if (pageSize === -1) {
      const results = await (strapi as any).db.query('api::saved-job.saved-job').findMany({
        where,
        orderBy: buildOrderBy(sort),
      });
      ctx.body = {
        data: results.map(toData),
        meta: {
          pagination: {
            page: 1,
            pageSize: results.length,
            pageCount: 1,
            total: results.length,
          },
        },
      };
      return;
    }

    const limit = Math.max(1, Number.isFinite(pageSize) ? pageSize : 100);
    const offset = Math.max(0, (Math.max(1, page) - 1) * limit);

    const [results, total] = await Promise.all([
      (strapi as any).db.query('api::saved-job.saved-job').findMany({
        where,
        orderBy: buildOrderBy(sort),
        limit,
        offset,
      }),
      (strapi as any).db.query('api::saved-job.saved-job').count({ where }),
    ]);

    ctx.body = {
      data: results.map(toData),
      meta: {
        pagination: {
          page: Math.max(1, page),
          pageSize: limit,
          pageCount: Math.max(1, Math.ceil(total / limit)),
          total,
        },
      },
    };
  },

  // GET /saved-jobs/:id
  async findOne(ctx: any) {
    const userId = await getUserId(ctx);
    if (!userId) return ctx.unauthorized();

    const id = Number(ctx.params.id);
    const entity = await (strapi as any).db.query('api::saved-job.saved-job').findOne({
      where: { id, owner: userId },
      populate: { owner: true },
    });
    if (!entity) return ctx.notFound();
    ctx.body = { data: toData(entity) };
  },

  // POST /saved-jobs
  async create(ctx: any) {
    const userId = await getUserId(ctx);
    if (!userId) return ctx.unauthorized();

    // Load latest user data to check trial/plan access
    const freshUser = await strapi.db.query('plugin::users-permissions.user').findOne({
      where: { id: userId },
      select: ['id', 'packages', 'plan', 'trialActive', 'trialEndsAt', 'trialLimits'],
    });

    // Check if user has access using trial helper
    const accessCheck = await checkSavedJobsAccess(freshUser as any, userId);
    if (!accessCheck.hasAccess) {
      if (accessCheck.limit !== undefined && accessCheck.remaining !== undefined) {
        return ctx.throw(402, `You've reached your trial limit of ${accessCheck.limit} saved jobs`);
      }
      return ctx.throw(402, 'No saved jobs access. Upgrade or start a trial to continue.');
    }

    const body = (ctx.request.body?.data || ctx.request.body || {}) as any;
    if (body.owner) delete body.owner;

    const created = await (strapi as any).entityService.create('api::saved-job.saved-job', {
      data: { ...body, owner: userId },
    });

    ctx.body = { data: toData(created) };
  },

  // PUT /saved-jobs/:id
  async update(ctx: any) {
    const userId = await getUserId(ctx);
    if (!userId) return ctx.unauthorized();

    const id = Number(ctx.params.id);
    const existing = await (strapi as any).db.query('api::saved-job.saved-job').findOne({
      where: { id },
      populate: { owner: true },
    });
    if (!existing) return ctx.notFound();
    if (existing.owner?.id !== userId) return ctx.forbidden();

    const patch = (ctx.request.body?.data || ctx.request.body || {}) as any;
    if (patch.owner) delete patch.owner;

    const updated = await (strapi as any).entityService.update('api::saved-job.saved-job', id, {
      data: patch,
    });

    ctx.body = { data: toData(updated) };
  },

  // DELETE /saved-jobs/:id
  async delete(ctx: any) {
    const userId = await getUserId(ctx);
    if (!userId) return ctx.unauthorized();

    const id = Number(ctx.params.id);
    const existing = await (strapi as any).db.query('api::saved-job.saved-job').findOne({
      where: { id },
      populate: { owner: true },
    });
    if (!existing) return ctx.notFound();
    if (existing.owner?.id !== userId) return ctx.forbidden();

    const deleted = await (strapi as any).entityService.delete('api::saved-job.saved-job', id);
    ctx.body = { data: toData(deleted) };
  },
};
