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
        policies: [],
        middlewares: [],
      },
    },
    // Core routes
    {
      method: 'GET',
      path: '/linkedin-optimisations',
      handler: 'linkedin-optimisation.find',
      config: {
        policies: [],
        middlewares: [],
      },
    },
    {
      method: 'GET',
      path: '/linkedin-optimisations/:id',
      handler: 'linkedin-optimisation.findOne',
      config: {
        policies: [],
        middlewares: [],
      },
    },
    {
      method: 'POST',
      path: '/linkedin-optimisations',
      handler: 'linkedin-optimisation.create',
      config: {
        policies: [],
        middlewares: [],
      },
    },
  ],
};

