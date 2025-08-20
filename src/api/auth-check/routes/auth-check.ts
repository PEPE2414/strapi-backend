export default {
  routes: [
    {
      method: 'GET',
      path: '/auth/exists',
      handler: 'auth-check.exists',
      config: { auth: false },
    },
  ],
};
