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
        policies: ['is-authenticated'],
        middlewares: [],
      },
    },
    {
      method: 'PUT',
      path: '/profile/me',
      handler: 'profile.updateProfile',
      config: {
        policies: ['is-authenticated'],
        middlewares: [],
      },
    },
    {
      method: 'PUT',
      path: '/user/profile',
      handler: 'profile.updateProfile',
      config: {
        policies: ['is-authenticated'],
        middlewares: [],
      },
    },
    {
      method: 'GET',
      path: '/profile/cv',
      handler: 'profile.getCv',
      config: {
        policies: ['is-authenticated'],
        middlewares: [],
      },
    },
    {
      method: 'POST',
      path: '/profile/cv',
      handler: 'profile.linkCv',
      config: {
        policies: ['is-authenticated'],
        middlewares: [],
      },
    },
  ],
};
