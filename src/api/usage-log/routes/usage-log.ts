// src/api/usage-log/routes/usage-log.ts
export default {
  routes: [
    {
      method: 'GET',
      path: '/usage-logs',
      handler: 'usage-log.find',
      config: {
        policies: ['plugin::users-permissions.isAuthenticated'],
        middlewares: [],
      },
    },
    {
      method: 'GET',
      path: '/usage-logs/:id',
      handler: 'usage-log.findOne',
      config: {
        policies: ['plugin::users-permissions.isAuthenticated'],
        middlewares: [],
      },
    },
    {
      method: 'POST',
      path: '/usage-logs',
      handler: 'usage-log.create',
      config: {
        policies: ['plugin::users-permissions.isAuthenticated'],
        middlewares: [],
      },
    },
    {
      method: 'PUT',
      path: '/usage-logs/:id',
      handler: 'usage-log.update',
      config: {
        policies: ['plugin::users-permissions.isAuthenticated'],
        middlewares: [],
      },
    },
    {
      method: 'DELETE',
      path: '/usage-logs/:id',
      handler: 'usage-log.delete',
      config: {
        policies: ['plugin::users-permissions.isAuthenticated'],
        middlewares: [],
      },
    },
  ],
};
