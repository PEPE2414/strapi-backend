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
        auth: false,
        policies: [],
        middlewares: []
      } 
    }
  ]
};
