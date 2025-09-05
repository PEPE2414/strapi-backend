export default {
  type: 'content-api', // ✅ make this a content API route set
  routes: [
    {
      method: 'GET',
      path: '/applications',
      handler: 'application.find',
      config: { policies: ['plugin::users-permissions.isAuthenticated'] }
    },
    {
      method: 'GET',
      path: '/applications/:id',
      handler: 'application.findOne',
      config: { policies: ['plugin::users-permissions.isAuthenticated'] }
    },
    {
      method: 'POST',
      path: '/applications',
      handler: 'application.create',
      config: { policies: ['plugin::users-permissions.isAuthenticated'] }
    },
    {
      method: 'PUT',
      path: '/applications/:id',
      handler: 'application.update',
      config: { policies: ['plugin::users-permissions.isAuthenticated'] }
    },
    {
      method: 'DELETE',
      path: '/applications/:id',
      handler: 'application.delete',
      config: { policies: ['plugin::users-permissions.isAuthenticated'] }
    },
    {
      method: 'GET',
      path: '/applications/stats',
      handler: 'application.stats',
      config: { policies: ['plugin::users-permissions.isAuthenticated'] }
    },
    {
      method: 'GET',
      path: '/applications/weekly',
      handler: 'application.weekly',
      config: { policies: ['plugin::users-permissions.isAuthenticated'] }
    },
    {
      method: 'POST',
      path: '/applications/:id/transition',
      handler: 'application.transition',
      config: { policies: ['plugin::users-permissions.isAuthenticated'] }
    },
    {
      method: 'POST',
      path: '/applications/:id/verify',
      handler: 'application.verify',
      config: { policies: ['plugin::users-permissions.isAuthenticated'] }
    }
  ]
};

