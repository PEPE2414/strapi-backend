/**
 * Error Log Routes
 */

export default {
  routes: [
    {
      method: 'GET',
      path: '/error-logs',
      handler: 'error-log.find',
      config: {
        policies: [],
        middlewares: [],
      },
    },
    {
      method: 'GET',
      path: '/error-logs/:id',
      handler: 'error-log.findOne',
      config: {
        policies: [],
        middlewares: [],
      },
    },
    {
      method: 'POST',
      path: '/error-logs',
      handler: 'error-log.create',
      config: {
        policies: [],
        middlewares: [],
      },
    },
    {
      method: 'PUT',
      path: '/error-logs/:id',
      handler: 'error-log.update',
      config: {
        policies: [],
        middlewares: [],
      },
    },
    {
      method: 'DELETE',
      path: '/error-logs/:id',
      handler: 'error-log.delete',
      config: {
        policies: [],
        middlewares: [],
      },
    },
  ],
};
