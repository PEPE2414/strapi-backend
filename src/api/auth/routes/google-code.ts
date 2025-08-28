// src/api/auth/routes/google-code.ts
export default {
  routes: [
    {
      method: 'POST',
      path: '/auth/google-oauth-code',
      handler: 'api::auth.google-code.googleCode',
      config: { auth: false }, // public: exchanges Google code for JWT
    },
  ],
};
