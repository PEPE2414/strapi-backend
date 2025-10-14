export default {
  routes: [
    {
      method: 'POST',
      path: '/jobs/ingest',
      handler: 'job.ingest',
      config: {
        auth: false,
        policies: [],
        middlewares: []
      }
    },
    {
      method: 'GET',
      path: '/jobs/recommendations',
      handler: 'job.recommendations',
      config: {
        auth: {}, // Enabled - this endpoint requires authentication
        policies: [],
        middlewares: []
      }
    },
    {
      method: 'GET',
      path: '/jobs/test-auth',
      handler: 'job.testAuth',
      config: {
        auth: false,
        policies: [],
        middlewares: []
      }
    }
  ]
};
