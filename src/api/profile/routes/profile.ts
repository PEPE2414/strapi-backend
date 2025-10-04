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
        auth: false,
        policies: [],
        middlewares: ['global::jwt'],
      },
    },
    {
      method: 'PUT',
      path: '/profile/me',
      handler: 'profile.updateProfile',
      config: {
        auth: false,
        policies: [],
        middlewares: ['global::jwt'],
      },
    },
    {
      method: 'PUT',
      path: '/user/profile',
      handler: 'profile.updateProfile',
      config: {
        auth: false,
        policies: [],
        middlewares: ['global::jwt'],
      },
    },
    {
      method: 'GET',
      path: '/profile/cv',
      handler: 'profile.getCv',
      config: {
        auth: false,
        policies: [],
        middlewares: ['global::jwt'],
      },
    },
    {
      method: 'POST',
      path: '/profile/cv',
      handler: 'profile.linkCv',
      config: {
        auth: false,
        policies: [],
        middlewares: ['global::jwt'],
      },
    },
  ],
};
