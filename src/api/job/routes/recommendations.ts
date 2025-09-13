// src/api/job/routes/recommendations.ts
export default {
  routes: [
    {
      method: 'GET',
      path: '/jobs/recommendations', // keep this path (matches your frontend call)
      handler: 'recommendations.find',
      config: {
        auth: false,         // we verify JWT inside the controller
        policies: [],
        middlewares: [],
      },
    },
  ],
};
