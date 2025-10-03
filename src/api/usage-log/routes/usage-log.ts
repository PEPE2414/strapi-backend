// src/api/usage-log/routes/usage-log.ts
export default {
  routes: [
    {
      method: 'GET',
      path: '/usage-logs',
      handler: 'usage-log.find',
      config: {
        policies: ['global::is-authenticated'],
        middlewares: [],
      },
    },
    {
      method: 'GET',
      path: '/usage-logs/:id',
      handler: 'usage-log.findOne',
      config: {
        policies: ['global::is-authenticated'],
        middlewares: [],
      },
    },
    {
      method: 'POST',
      path: '/usage-logs',
      handler: 'usage-log.create',
      config: {
        policies: ['global::is-authenticated'],
        middlewares: [],
      },
    },
    {
      method: 'PUT',
      path: '/usage-logs/:id',
      handler: 'usage-log.update',
      config: {
        policies: ['global::is-authenticated'],
        middlewares: [],
      },
    },
    {
      method: 'DELETE',
      path: '/usage-logs/:id',
      handler: 'usage-log.delete',
      config: {
        policies: ['global::is-authenticated'],
        middlewares: [],
      },
    },
  ],
};
