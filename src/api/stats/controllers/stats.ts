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

      console.log(`Total users found: ${users.length}`);

      // Filter users who have at least one package or addon
      const usersWithSubscriptions = users.filter(user => {
        const packages = user.packages || [];
        const addons = user.addons || [];
        const hasSubscription = packages.length > 0 || addons.length > 0;
        
        // Log some debug info for first few users
        if (users.indexOf(user) < 5) {
          console.log(`User ${user.id}: packages=${JSON.stringify(packages)}, addons=${JSON.stringify(addons)}, hasSubscription=${hasSubscription}`);
        }
        
        return hasSubscription;
      });

      console.log(`Users with subscriptions: ${usersWithSubscriptions.length}`);

      ctx.body = {
        count: usersWithSubscriptions.length,
      };
    } catch (err) {
      console.error('Error in usersWithSubscriptions:', err);
      ctx.throw(500, err);
    }
  },
});
