/**
 * stats router
 */

export default {
  routes: [
    {
      method: 'GET',
      path: '/stats/users-with-subscriptions',
      handler: 'stats.usersWithSubscriptions',
      config: {
        policies: [],
        middlewares: [],
      },
    },
  ],
};
