export default {
  async index(ctx: any) {
    // At runtime this exists, but TS doesn't know. Cast to any.
    const cts = Object.keys(((strapi as any).container?.get?.('content-types')) || {});
    ctx.body = { ok: true, contentTypes: cts.sort() };
  },
};
