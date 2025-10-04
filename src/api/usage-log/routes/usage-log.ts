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
        middlewares: [],
      },
    },
    {
      method: 'GET',
      path: '/usage-logs/:id',
      handler: 'usage-log.findOne',
      config: {
        auth: false,
        policies: [],
        middlewares: [],
      },
    },
    {
      method: 'POST',
      path: '/usage-logs',
      handler: 'usage-log.create',
      config: {
        auth: false,
        policies: [],
        middlewares: [],
      },
    },
    {
      method: 'PUT',
      path: '/usage-logs/:id',
      handler: 'usage-log.update',
      config: {
        auth: false,
        policies: [],
        middlewares: [],
      },
    },
    {
      method: 'DELETE',
      path: '/usage-logs/:id',
      handler: 'usage-log.delete',
      config: {
        auth: false,
        policies: [],
        middlewares: [],
      },
    },
  ],
};
