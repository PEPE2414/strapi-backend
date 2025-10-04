export default {
  routes: [
    {
      method: 'POST',
      path: '/linkedin-recruiter/search',
      handler: 'linkedin-recruiter.search',
      config: {
        auth: false,
        policies: [],
        middlewares: [],
      },
    },
    {
      method: 'GET',
      path: '/linkedin-recruiter/results',
      handler: 'linkedin-recruiter.results',
      config: {
        auth: false,
        policies: [],
        middlewares: [],
      },
    },
  ],
};