export default {
  type: 'content-api',
  routes: [
    {
      method: 'GET',
      path: '/saved-jobs',
      handler: 'savedtracker.find',
      config: {
        // Use the users-permissions policy to require a valid JWT
        // and populate ctx.state.user. This works in v5 and doesn't
        // trigger the build error you saw with auth:true.
        policies: ['plugin::users-permissions.isAuthenticated'],
      },
    },
    {
      method: 'GET',
      path: '/saved-jobs/:id',
      handler: 'savedtracker.findOne',
      config: {
        policies: ['plugin::users-permissions.isAuthenticated'],
      },
    },
    {
      method: 'POST',
      path: '/saved-jobs',
      handler: 'savedtracker.create',
      config: {
        policies: ['plugin::users-permissions.isAuthenticated'],
      },
    },
    {
      method: 'PUT',
      path: '/saved-jobs/:id',
      handler: 'savedtracker.update',
      config: {
        policies: ['plugin::users-permissions.isAuthenticated'],
      },
    },
    {
      method: 'DELETE',
      path: '/saved-jobs/:id',
      handler: 'savedtracker.delete',
      config: {
        policies: ['plugin::users-permissions.isAuthenticated'],
      },
    },
  ],
};
