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
        auth: false, // Bypass permission checks, verify auth in controller
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
        auth: false, // Bypass permission checks, verify auth in controller
        policies: [],
        middlewares: [],
      },
    },
    {
      method: 'GET',
      path: '/linkedin-optimisations/:id',
      handler: 'linkedin-optimisation.findOne',
      config: {
        auth: false, // Bypass permission checks, verify auth in controller
        policies: [],
        middlewares: [],
      },
    },
    {
      method: 'POST',
      path: '/linkedin-optimisations',
      handler: 'linkedin-optimisation.create',
      config: {
        auth: false, // Bypass permission checks, verify auth in controller
        policies: [],
        middlewares: [],
      },
    },
  ],
};

