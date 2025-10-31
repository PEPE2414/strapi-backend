export default {
  routes: [
    {
      method: 'GET',
      path: '/jobs/dedupe/trigger',
      handler: 'job-deduplication.trigger',
      config: {
        auth: false,
        policies: [],
        middlewares: [],
      },
    },
  ],
};

