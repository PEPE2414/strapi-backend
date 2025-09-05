export async function ensureUserOnCtx(ctx: any, strapi: any) {
  if (ctx.state?.user) return ctx.state.user;

  const auth = ctx.request.header?.authorization || ctx.request.header?.Authorization;
  const token = (auth && typeof auth === 'string' && auth.startsWith('Bearer ')) ? auth.slice(7) : null;

  const jwtService =
    strapi.service?.('plugin::users-permissions.jwt') ??
    strapi.plugin?.('users-permissions')?.service?.('jwt') ??
    strapi.plugins?.['users-permissions']?.services?.jwt;

  if (token && jwtService?.verify) {
    try {
      const payload = await jwtService.verify(token);
      const userId = (payload?.id ?? payload?.sub ?? payload?._id) || null;
      if (userId) {
        const user = await strapi.query('plugin::users-permissions.user').findOne({ where: { id: userId } });
        if (user) {
          ctx.state.user = user;
          return user;
        }
      }
    } catch {
      // invalid/expired token -> fall through
    }
  }
  return null;
}
