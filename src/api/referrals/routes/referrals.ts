// src/api/referrals/routes/referrals.ts
export default {
  routes: [
    {
      method: 'GET',
      path: '/referrals/me',
      handler: 'referrals.me',
      config: {
        auth: {
          scope: ['authenticated']
        }
      }
    },
    {
      method: 'GET',
      path: '/referrals/lookup',
      handler: 'referrals.lookup',
      config: {
        auth: false // Public endpoint
      }
    }
  ]
};
