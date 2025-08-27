// src/api/profile/routes/profile.ts
export default {
  routes: [
    {
      method: 'PUT',
      path: '/user/profile',
      handler: 'api::profile.profile.updateProfile',
      // In v5: omit `auth` to require authentication by default.
      // (If you ever need to make it public, you'd use `auth: { required: false }`.)
      config: {
        policies: [],
        middlewares: [],
      },
    },
  ],
};
