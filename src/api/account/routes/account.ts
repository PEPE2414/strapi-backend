// backend/src/api/account/routes/account.ts
export default {
  routes: [
    {
      method: 'PUT',
      path: '/account/me',
      handler: 'account.updateMe',
      config: {
        auth: false, // Bypass permission checks, verify auth in controller
        policies: [],
        middlewares: [],
      },
    },
    {
      method: 'POST',
      path: '/account/start-trial',
      handler: 'account.startTrial',
      config: {
        auth: false, // Bypass permission checks, verify auth in controller
        policies: [],
        middlewares: [],
      },
    },
  ],
};
