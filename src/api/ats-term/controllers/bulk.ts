const UID = 'api::ats-term.ats-term' as const;

export default {
  async ping(ctx: any) {
    ctx.body = { ok: true };
  },

  async bulkUpsert(ctx: any) {
    const secret = ctx.request.headers['x-seed-secret'];
    if (!secret || secret !== process.env.SEED_SECRET) return ctx.unauthorized('Invalid seed secret');

    const body = ctx.request.body || {};
    const items = Array.isArray(body) ? body : body.items;
    if (!Array.isArray(items) || items.length === 0) ctx.throw(400, 'No items');

    const docs = (strapi as any).documents(UID as any);

    const upserts = items.map(async (it: any) => {
      const filters = { phrase: it.phrase, field: it.field ?? null, role: it.role ?? null };

      const existing = await docs.findFirst({ filters } as any);

      if (existing) {
        return docs.update({
          documentId: existing.documentId,
          data: {
            category: it.category,
            weight: it.weight,
            suggestion: it.suggestion,
            variants: Array.isArray(it.variants) ? it.variants : [],
            field: it.field ?? null,
            role: it.role ?? null,
          } as any,
        });
      }

      return docs.create({
        data: {
          phrase: it.phrase,
          category: it.category,
          weight: it.weight,
          suggestion: it.suggestion,
          variants: Array.isArray(it.variants) ? it.variants : [],
          field: it.field ?? null,
          role: it.role ?? null,
        } as any,
      });
    });

    const results = await Promise.all(upserts);
    ctx.body = { ok: true, count: results.length };
  },
};
