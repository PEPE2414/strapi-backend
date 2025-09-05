// src/utils/auth/get-user.ts
function decodeJwtId(token: string): string | number | null {
  try {
    const parts = token.split('.');
    if (parts.length < 2) return null;
    const b64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const json = Buffer.from(b64, 'base64').toString('utf8');
    const payload = JSON.parse(json);
    return payload?.id ?? payload?.sub ?? payload?._id ?? null;
  } catch {
    return null;
  }
}

export async function ensureUserOnCtx(ctx: any, strapi: any) {
  if (ctx.state?.user) return ctx.state.user;
  const authHeader = (ctx.request.header?.authorization || ctx.request.header?.Authorization || '') as string;
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!token) return null;

  let userId: string | number | null = null;

  // Try plugin verify (best effort)
  try {
    const jwtService =
      strapi.service?.('plugin::users-permissions.jwt') ??
      strapi.plugin?.('users-permissions')?.service?.('jwt') ??
      strapi.plugins?.['users-permissions']?.services?.jwt;
    if (jwtService?.verify) {
      const payload = await jwtService.verify(token);
      userId = payload?.id ?? payload?.sub ?? (payload as any)?._id ?? null;
    }
  } catch {
    // ignore
  }

  if (!userId) userId = decodeJwtId(token);
  if (!userId) return null;

  const user = await strapi.query('plugin::users-permissions.user').findOne({ where: { id: userId } });
  if (user) ctx.state.user = user;
  return ctx.state?.user || null;
}
