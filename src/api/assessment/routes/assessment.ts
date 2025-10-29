// src/api/assessment/routes/assessment.ts
export default {
  routes: [
    {
      method: 'POST',
      path: '/assessment/receive-results',
      handler: 'assessment.receiveResults',
      config: {
        auth: false, // n8n will use shared secret
        policies: [],
        middlewares: [],
      },
    },
    {
      method: 'GET',
      path: '/assessment/result/:assessmentId',
      handler: 'assessment.getResult',
      config: {
        auth: false, // Manual JWT verification in controller
        policies: [],
        middlewares: [],
      },
    },
    {
      method: 'GET',
      path: '/assessment/my-results',
      handler: 'assessment.myResults',
      config: {
        auth: false, // Manual JWT verification in controller
        policies: [],
        middlewares: [],
      },
    },
  ],
};

