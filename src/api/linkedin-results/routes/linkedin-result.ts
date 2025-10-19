/**
 * linkedin-result router
 */

export default {
  routes: [
    // Core routes
    {
      method: 'GET',
      path: '/linkedin-results',
      handler: 'linkedin-result.find',
      config: {
        auth: false, // Bypass permission checks, verify auth in controller
        policies: [],
        middlewares: [],
      },
    },
    {
      method: 'GET',
      path: '/linkedin-results/:id',
      handler: 'linkedin-result.findOne',
      config: {
        auth: false, // Bypass permission checks, verify auth in controller
        policies: [],
        middlewares: [],
      },
    },
    {
      method: 'POST',
      path: '/linkedin-results',
      handler: 'linkedin-result.create',
      config: {
        auth: false, // Bypass permission checks, verify auth in controller
        policies: [],
        middlewares: [],
      },
    },
  ],
};
