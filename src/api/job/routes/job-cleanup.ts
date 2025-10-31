export default {
  routes: [
    {
      method: 'GET',
      path: '/jobs/cleanup/trigger',
      handler: 'job-cleanup.trigger',
      config: {
        auth: false, // Allow unauthenticated access for cron jobs
        policies: [],
        middlewares: [],
      },
    },
    {
      method: 'GET',
      path: '/jobs/cleanup/stats',
      handler: 'job-cleanup.stats',
      config: {
        auth: false,
        policies: [],
        middlewares: [],
      },
    },
    {
      method: 'GET',
      path: '/jobs/cleanup/schedule',
      handler: 'job-cleanup.schedule',
      config: {
        auth: false,
        policies: [],
        middlewares: [],
      },
    },
    {
      method: 'POST',
      path: '/jobs/cleanup/schedule',
      handler: 'job-cleanup.updateSchedule',
      config: {
        auth: false,
        policies: [],
        middlewares: [],
      },
    },
  ],
};

