'use strict';
const CATEGORIES = new Set(['good', 'weak', 'bad']);

module.exports = ({ strapi }) => ({
  async bulkUpsert(ctx) {
    const secret = ctx.request.header['x-seed-secret'];
    if (!secret || secret !== process.env.SEED_SECRET) {
      return ctx.unauthorized('Invalid seed secret');
    }

    const body = ctx.request.body;
    const items = Array.isArray(body?.items) ? body.items : (Array.isArray(body) ? body : null);
    if (!items) return ctx.badRequest('Provide an array in body or { items: [...] }');

    let created = 0, updated = 0;

    for (const raw of items) {
      if (!raw?.phrase || !raw?.category || !CATEGORIES.has(raw.category)) continue;

      const phrase = String(raw.phrase).trim();
      const category = String(raw.category).trim();
      const weight = raw.weight ?? (category === 'good' ? 2 : category === 'bad' ? -2 : 1);
      const suggestion = raw.suggestion ?? null;
      const variants = Array.isArray(raw.variants) ? raw.variants : [];
      const field = raw.field ? String(raw.field) : null;
      const role = raw.role ? String(raw.role) : null;

      const found = await strapi.entityService.findMany('api::ats-term.ats-term', {
        filters: {
          phrase: { $eqi: phrase },
          ...(field ? { field: { $eqi: field } } : {}),
          ...(role  ? { role:  { $eqi: role  } } : {}),
        },
        limit: 1,
      });

      const data = { phrase, category, weight, suggestion, variants, field, role };

      if (Array.isArray(found) && found.length) {
        await strapi.entityService.update('api::ats-term.ats-term', found[0].id, { data });
        updated++;
      } else {
        await strapi.entityService.create('api::ats-term.ats-term', { data });
        created++;
      }
    }

    ctx.body = { created, updated, total: created + updated };
  },
});
