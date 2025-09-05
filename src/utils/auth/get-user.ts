import type { Context } from 'koa';

// Robustly resolve ctx.state.user from Authorization header or cookies.
// Falls back to manual JWT verify using process.env.JWT_SECRET if plugin service isn't cooperating.
export async function ensureUserOnCtx(ctx: Context & { state: any; request: any }, strapi: any) {
  if (ctx.state?.user) return ctx.state.user;

  // 1) Pull Bearer token from header if present
  const auth = (ctx.request.header?.authorization || ctx.request.header?.Authorization) as string | undefined;
  let token: string | null = null;
  if (auth && auth.startsWith('Bearer ')) token = auth.slice(7);

  // 2) Get plugin JWT service (v5-friendly)
  const jwtService =
    strapi.service?.('plugin::users-permissions.jwt') ??
    strapi.plugin?.('users-permissions')?.service?.('jwt') ??
    strapi.plugins?.['users-permissions']?.services?.jwt;

  // 3) If no header token, try plugin helper (cookie/query param)
  if (!token && jwtService?.getToken) {
    try { token = await jwtService.getToken(ctx); } catch { /* ignore */ }
  }

  // 4) Try plugin verify first
  let userId: number | string | null = null;
  if (token && jwtService?.verify) {
    try {
      const payload = await jwtService.verify(token);
      userId = (payload?.id ?? payload?.sub ?? (payload as any)?._id) || null;
    } catch {
      // ignore; we'll try the manual fallback below
    }
  }

  // 5) Manual fallback using process.env.JWT_SECRET
  if (!userId && token && process.env.JWT_SECRET) {
    try {
      // Lazy import to avoid type deps
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const jwt = require('jsonwebtoken');
      const payload = jwt.verify(token, process.env.JWT_SECRET);
      userId = (payload?.id ?? payload?.sub ?? (payload as any)?._id) || null;
    } catch {
      // bad token or wrong secret
    }
  }

  // 6) Load user if we resolved an id
  if (userId) {
    try {
      const user = await strapi.query('plugin::users-permissions.user').findOne({ where: { id: userId } });
      if (user) {
        ctx.state.user = user;
        return user;
      }
    } catch {
      // ignore
    }
  }

  return null;
}
