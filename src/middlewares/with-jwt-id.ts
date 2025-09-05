// src/middlewares/with-jwt-id.ts
// Decode JWT payload (no verification) and expose id on ctx.state.jwtUserId.
// This avoids plugin/service quirks and never throws.

function decodeJwtId(token: string): string | number | null {
  try {
    const parts = token.split('.');
    if (parts.length < 2) return null;

    // Use Node's base64url support (Node 18+)
    const json = Buffer.from(parts[1], 'base64url').toString('utf8');
    const payload = JSON.parse(json);

    // Strapi U&P uses numeric ids in SQL; accept string or number just in case
    return payload?.id ?? payload?.sub ?? payload?._id ?? null;
  } catch {
    return null;
  }
}

export default (_config: any, _ctxDeps: any) => {
  return async (ctx: any, next: any) => {
    try {
      const authHeader = String(
        ctx.request.header?.authorization || ctx.request.header?.Authorization || ''
      );

      if (authHeader.startsWith('Bearer ')) {
        const token = authHeader.slice(7);
        const uid = decodeJwtId(token);
        if (uid != null) {
          // Normalize to number if possible (postgres generally stores numeric ids)
          const asNum = Number(uid);
          ctx.state.jwtUserId = Number.isFinite(asNum) ? asNum : uid;
        }
      }
    } catch {
      // never throw from middleware
    }
    await next();
  };
};
