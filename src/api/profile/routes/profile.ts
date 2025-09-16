// src/api/profile/routes/profile.ts
export default {
  routes: [
    {
      method: 'PUT',
      path: '/user/profile',
      handler: 'api::profile.profile.updateProfile',
      // Public; controller verifies JWT
      config: { policies: [], middlewares: [] },
    },
    {
      method: 'GET',
      path: '/profile/cv',
      handler: 'api::profile.profile.getCv',
      // Public; controller verifies JWT
      config: { policies: [], middlewares: [] },
    },
    {
      method: 'POST',
      path: '/profile/cv',
      handler: 'api::profile.profile.linkCv',
      // Public; controller verifies JWT
      config: { policies: [], middlewares: [] },
    },
  ],
};
