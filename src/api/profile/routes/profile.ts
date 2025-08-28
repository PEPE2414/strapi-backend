// src/api/profile/routes/profile.ts
export default {
  routes: [
    {
      method: 'PUT',
      path: '/user/profile',
      handler: 'api::profile.profile.updateProfile',
      // Make it public at the router level; we verify JWT inside the controller.
      config: {
        auth: false,
        policies: [],
        middlewares: [],
      },
    },
  ],
};
