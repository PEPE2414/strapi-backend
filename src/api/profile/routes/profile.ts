// src/api/profile/routes/profile.ts
export default {
  routes: [
    {
      method: 'GET',
      path: '/profile/test',
      handler: 'profile.test',
      config: {
        policies: [],
        middlewares: [],
      },
    },
    {
      method: 'GET',
      path: '/profile/me',
      handler: 'profile.getProfile',
      config: {
        auth: true,
        policies: [],
        middlewares: [],
      },
    },
    {
      method: 'PUT',
      path: '/profile/me',
      handler: 'profile.updateProfile',
      config: {
        auth: true,
        policies: [],
        middlewares: [],
      },
    },
    {
      method: 'PUT',
      path: '/user/profile',
      handler: 'profile.updateProfile',
      config: {
        auth: true,
        policies: [],
        middlewares: [],
      },
    },
    {
      method: 'GET',
      path: '/profile/cv',
      handler: 'profile.getCv',
      config: {
        auth: true,
        policies: [],
        middlewares: [],
      },
    },
    {
      method: 'POST',
      path: '/profile/cv',
      handler: 'profile.linkCv',
      config: {
        auth: true,
        policies: [],
        middlewares: [],
      },
    },
  ],
};
