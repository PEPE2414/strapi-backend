export default {
  async index(ctx) {
    const cts = Object.keys(strapi.container.get('content-types') || {});
    ctx.body = { ok: true, contentTypes: cts.sort() };
  },
};
