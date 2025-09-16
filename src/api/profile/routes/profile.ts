// src/api/profile/routes/profile.ts
export default {
  routes: [
    {
      method: 'PUT',
      path: '/user/profile',
      handler: 'api::profile.profile.updateProfile',
      // Keep this public; the controller self-verifies JWT
      config: {
        auth: false,
        policies: [],
        middlewares: [],
      },
    },
    {
      method: 'POST',
      path: '/profile/cv',
      handler: 'api::profile.profile.linkCv',
      // Public route; controller verifies JWT itself
      config: { policies: [], middlewares: [] },
    },
  ],
};
