// src/api/usage-log/routes/usage-log.ts
export default {
  routes: [
    {
      method: 'GET',
      path: '/usage-logs',
      handler: 'usage-log.find',
      config: {
        auth: false,
        policies: [],
        middlewares: ['global::jwt'],
      },
    },
    {
      method: 'GET',
      path: '/usage-logs/:id',
      handler: 'usage-log.findOne',
      config: {
        auth: false,
        policies: [],
        middlewares: ['global::jwt'],
      },
    },
    {
      method: 'POST',
      path: '/usage-logs',
      handler: 'usage-log.create',
      config: {
        auth: false,
        policies: [],
        middlewares: ['global::jwt'],
      },
    },
    {
      method: 'PUT',
      path: '/usage-logs/:id',
      handler: 'usage-log.update',
      config: {
        auth: false,
        policies: [],
        middlewares: ['global::jwt'],
      },
    },
    {
      method: 'DELETE',
      path: '/usage-logs/:id',
      handler: 'usage-log.delete',
      config: {
        auth: false,
        policies: [],
        middlewares: ['global::jwt'],
      },
    },
  ],
};
