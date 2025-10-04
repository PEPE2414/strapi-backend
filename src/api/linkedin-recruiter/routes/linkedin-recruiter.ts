export default {
  type: 'content-api',
  routes: [
    {
      method: 'POST',
      path: '/linkedin-recruiter/search',
      handler: 'linkedin-recruiter.search',
      config: {
        auth: {
          scope: ['authenticated'],
        },
      },
    },
    {
      method: 'GET',
      path: '/linkedin-recruiter/results',
      handler: 'linkedin-recruiter.results',
      config: {
        auth: {
          scope: ['authenticated'],
        },
      },
    },
  ],
};