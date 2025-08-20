export default {
  routes: [
    {
      method: 'POST',
      path: '/auth/google-one-tap',
      handler: 'one-tap.login',
      config: { auth: false }, // public endpoint
    },
  ],
};
