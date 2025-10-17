// src/api/referrals/routes/referrals.ts
export default {
  routes: [
    {
      method: 'GET',
      path: '/referrals/test',
      handler: 'referrals.test',
      config: {
        auth: false,
        policies: [],
        middlewares: [],
      }
    },
    {
      method: 'GET',
      path: '/referrals/me',
      handler: 'referrals.me',
      config: {
        auth: false, // Bypass permission checks, verify auth in controller
        policies: [],
        middlewares: [],
      }
    },
    {
      method: 'GET',
      path: '/referrals/lookup',
      handler: 'referrals.lookup',
      config: {
        auth: false, // Public endpoint
        policies: [],
        middlewares: [],
      }
    }
  ]
};
