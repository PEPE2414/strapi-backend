// src/api/profile/routes/profile.ts
module.exports = {
  routes: [
    {
      method: 'GET',
      path: '/profile/me',
      handler: 'api::profile.profile.getProfile',
      config: {
        // Public; controller verifies JWT
        policies: [],
        middlewares: [],
      },
    },
    {
      method: 'PUT',
      path: '/profile/me',
      handler: 'api::profile.profile.updateProfile',
      config: {
        // Public; controller verifies JWT
        policies: [],
        middlewares: [],
      },
    },
    {
      method: 'PUT',
      path: '/user/profile',
      handler: 'api::profile.profile.updateProfile',
      config: {
        // Public; controller verifies JWT
        policies: [],
        middlewares: [],
      },
    },
    {
      method: 'GET',
      path: '/profile/cv',
      handler: 'api::profile.profile.getCv',
      config: {
        // Public; controller verifies JWT
        policies: [],
        middlewares: [],
      },
    },
    {
      method: 'POST',
      path: '/profile/cv',
      handler: 'api::profile.profile.linkCv',
      config: {
        // Public; controller verifies JWT
        policies: [],
        middlewares: [],
      },
    },
  ],
};
