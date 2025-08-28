// src/api/auth/routes/exists.ts
export default {
  routes: [
    {
      method: 'GET',
      path: '/auth/exists',
      handler: 'api::auth.exists.exists',
      config: { auth: false }, // public; used before login
    },
  ],
};
