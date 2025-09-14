export default {
  async ping(ctx) {
    ctx.body = { ok: true, now: new Date().toISOString() };
  },
};
