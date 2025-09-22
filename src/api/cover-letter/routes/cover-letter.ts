export default {
  routes: [
    // Core CRUD routes (make them explicit so Strapi registers them)
    {
      method: 'GET',
      path: '/cover-letters',
      handler: 'cover-letter.find'
    },
    {
      method: 'GET',
      path: '/cover-letters/:id',
      handler: 'cover-letter.findOne'
    },

    // Custom actions
    {
      method: 'POST',
      path: '/cover-letters/generate',
      handler: 'cover-letter.generate'
    },
    {
      method: 'POST',
      path: '/cover-letters/:id/complete',
      handler: 'cover-letter.complete'
    },
    {
      method: 'POST',
      path: '/cover-letters/:id/fail',
      handler: 'cover-letter.fail'
    }
  ]
};
