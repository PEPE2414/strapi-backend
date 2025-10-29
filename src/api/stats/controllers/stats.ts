/**
 * stats controller
 */

export default ({ strapi }) => ({
  async usersWithSubscriptions(ctx) {
    try {
      // Count users who have at least one package or addon
      const users = await strapi.db.query('plugin::users-permissions.user').findMany({
        select: ['id', 'packages', 'addons'],
      });

      // Filter users who have at least one package or addon
      const usersWithSubscriptions = users.filter(user => {
        const packages = user.packages || [];
        const addons = user.addons || [];
        return packages.length > 0 || addons.length > 0;
      });

      ctx.body = {
        count: usersWithSubscriptions.length,
      };
    } catch (err) {
      ctx.throw(500, err);
    }
  },
});
