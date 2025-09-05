// Resolve ctx.state.user from JWT (Authorization header or cookie) if missing.
// Use the most compatible Users & Permissions services.
export async function ensureUserOnCtx(ctx: any, strapi: any) {
  if (ctx.state?.user) return ctx.state.user;

  // 1) Header → Bearer token
  const auth = ctx.request.header?.authorization || ctx.request.header?.Authorization;
  let token: string | null = null;
  if (auth && typeof auth === 'string' && auth.startsWith('Bearer ')) token = auth.slice(7);

  // 2) Resolve JWT service (v5-friendly)
  const jwtService =
    strapi.service?.('plugin::users-permissions.jwt') ??
    strapi.plugin?.('users-permissions')?.service?.('jwt') ??
    strapi.plugins?.['users-permissions']?.services?.jwt;

  // 3) If no header token, try plugin helper (cookie/query)
  if (!token && jwtService?.getToken) {
    try { token = await jwtService.getToken(ctx); } catch { /* no-op */ }
  }

  // 4) Verify & fetch user
  if (token && jwtService?.verify) {
    try {
      const payload = await jwtService.verify(token);
      const userId = payload?.id ?? payload?.sub ?? payload?._id;
      if (userId) {
        const user = await strapi.query('plugin::users-permissions.user').findOne({ where: { id: userId } });
        if (user) ctx.state.user = user;
      }
    } catch { /* invalid token -> leave ctx.state.user undefined */ }
  }

  return ctx.state?.user || null;
}
