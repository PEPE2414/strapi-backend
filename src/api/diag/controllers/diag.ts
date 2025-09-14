function decodeJwtId(token: string): string | number | null {
  try {
    const parts = token.split('.');
    if (parts.length < 2) return null;
    // base64url -> base64 with padding
    let b64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    while (b64.length % 4) b64 += '=';
    const json = Buffer.from(b64, 'base64').toString('utf8');
    const payload = JSON.parse(json);
    return payload?.id ?? payload?.sub ?? payload?._id ?? null;
  } catch {
    return null;
  }
}

export default {
  async whoami(ctx: any) {
    try {
      const authHeader = String(ctx.request.header?.authorization || ctx.request.header?.Authorization || '');
      const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
      const decodedId = token ? decodeJwtId(token) : null;
      ctx.body = { hasAuthHeader: !!authHeader, hasBearer: !!token, decodedId };
    } catch (e: any) {
      // absolutely never throw
      ctx.body = { diagError: e?.message || 'diag_error' };
    }
  }
};
