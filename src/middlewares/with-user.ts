// Ensures ctx.state.user is set when a valid Bearer token is present.
// Safe no-op if token is missing/invalid.
export default (config: any, { strapi }: any) => {
  return async (ctx: any, next: any) => {
    try {
      if (!ctx.state.user) {
        const auth = ctx.request.header?.authorization || ctx.request.header?.Authorization;
        if (auth && typeof auth === 'string' && auth.startsWith('Bearer ')) {
          const token = auth.slice(7);
          const jwtService = (strapi as any).plugin('users-permissions').service('jwt');
          const payload = await jwtService.verify(token);
          if (payload?.id) {
            const user = await (strapi as any)
              .query('plugin::users-permissions.user')
              .findOne({ where: { id: payload.id } });
            if (user) ctx.state.user = user;
          }
        }
      }
    } catch {
      // ignore: invalid token or plugin unavailable
    }
    await next();
  };
};
