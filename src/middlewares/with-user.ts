// Robustly attach ctx.state.user from the Users & Permissions JWT.
// Works across Strapi v5 variants and gracefully no-ops if anything is missing.
export default (_config: any, { strapi }: any) => {
  return async (ctx: any, next: any) => {
    try {
      if (!ctx.state.user) {
        // 1) Try Authorization header first
        const auth = ctx.request.header?.authorization || ctx.request.header?.Authorization;
        let token: string | null = null;
        if (auth && typeof auth === 'string' && auth.startsWith('Bearer ')) {
          token = auth.slice(7);
        }

        // 2) Resolve the JWT service (v5-safe)
        const jwtService =
          (strapi as any).service?.('plugin::users-permissions.jwt') ??
          (strapi as any).plugin?.('users-permissions')?.service?.('jwt') ??
          (strapi as any).plugins?.['users-permissions']?.services?.jwt;

        // 3) If no header token, try plugin helper (cookie, query, etc.)
        if (!token && jwtService?.getToken) {
          token = await jwtService.getToken(ctx);
        }

        // 4) Verify and fetch the user
        if (token && jwtService?.verify) {
          const payload = await jwtService.verify(token);
          const userId = payload?.id ?? payload?.sub ?? payload?._id;
          if (userId) {
            const user = await (strapi as any)
              .query('plugin::users-permissions.user')
              .findOne({ where: { id: userId } });
            if (user) ctx.state.user = user;
          }
        }
      }
    } catch {
      // swallow invalid/expired tokens; downstream policy will 403 as designed
    }
    await next();
  };
};
