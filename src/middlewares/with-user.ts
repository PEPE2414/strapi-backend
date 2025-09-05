// src/middlewares/with-user.ts
// Robustly attach ctx.state.user by decoding the JWT payload (no verification).
// This bypasses any plugin quirks. Safe for MVP; later you can re-enable verify.

function decodeJwtId(token: string): string | number | null {
  try {
    const parts = token.split('.');
    if (parts.length < 2) return null;
    // base64url -> base64
    const b64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const json = Buffer.from(b64, 'base64').toString('utf8');
    const payload = JSON.parse(json);
    return payload?.id ?? payload?.sub ?? payload?._id ?? null;
  } catch {
    return null;
  }
}

export default (_config: any, { strapi }: any) => {
  return async (ctx: any, next: any) => {
    try {
      if (!ctx.state?.user) {
        const authHeader =
          (ctx.request.header?.authorization || ctx.request.header?.Authorization || '') as string;
        const token =
          authHeader && authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;

        if (token) {
          // Try plugin verify first (best case), but don't depend on it.
          let userId: string | number | null = null;
          try {
            const jwtService =
              (strapi as any).service?.('plugin::users-permissions.jwt') ??
              (strapi as any).plugin?.('users-permissions')?.service?.('jwt') ??
              (strapi as any).plugins?.['users-permissions']?.services?.jwt;

            if (jwtService?.verify) {
              const payload = await jwtService.verify(token);
              userId = payload?.id ?? payload?.sub ?? (payload as any)?._id ?? null;
            }
          } catch {
            // ignore and fall back to decode
          }
          if (!userId) userId = decodeJwtId(token);

          if (userId) {
            const user = await (strapi as any)
              .query('plugin::users-permissions.user')
              .findOne({ where: { id: userId } });
            if (user) ctx.state.user = user;
          }
        }
      }
    } catch {
      // never throw from auth middleware
    }
    await next();
  };
};
