// src/api/auth/routes/google-one-tap.ts
export default {
  routes: [
    {
      method: 'POST',
      path: '/auth/google-one-tap',
      handler: 'api::auth.google-one-tap.googleOneTap',
      config: { auth: false },
    },
  ],
};
