/**
 * linkedin-optimisation router
 */

export default {
  routes: [
    // Custom generate endpoint
    {
      method: 'POST',
      path: '/linkedin-optimisations/generate',
      handler: 'linkedin-optimisation.generate',
      config: {
        policies: ['plugin::users-permissions.isAuthenticated'],
        middlewares: [],
      },
    },
    // Core routes
    {
      method: 'GET',
      path: '/linkedin-optimisations',
      handler: 'linkedin-optimisation.find',
      config: {
        policies: ['plugin::users-permissions.isAuthenticated'],
        middlewares: [],
      },
    },
    {
      method: 'GET',
      path: '/linkedin-optimisations/:id',
      handler: 'linkedin-optimisation.findOne',
      config: {
        policies: ['plugin::users-permissions.isAuthenticated'],
        middlewares: [],
      },
    },
    {
      method: 'POST',
      path: '/linkedin-optimisations',
      handler: 'linkedin-optimisation.create',
      config: {
        policies: ['plugin::users-permissions.isAuthenticated'],
        middlewares: [],
      },
    },
  ],
};

