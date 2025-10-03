// src/api/profile/routes/profile.ts
export default {
  routes: [
    {
      method: 'GET',
      path: '/profile/me',
      handler: 'api::profile.profile.getProfile',
      config: {
        auth: {
          scope: ['authenticated'],
        },
      },
    },
    {
      method: 'PUT',
      path: '/profile/me',
      handler: 'api::profile.profile.updateProfile',
      config: {
        auth: {
          scope: ['authenticated'],
        },
      },
    },
    {
      method: 'PUT',
      path: '/user/profile',
      handler: 'api::profile.profile.updateProfile',
      config: {
        auth: {
          scope: ['authenticated'],
        },
      },
    },
    {
      method: 'GET',
      path: '/profile/cv',
      handler: 'api::profile.profile.getCv',
      config: {
        auth: {
          scope: ['authenticated'],
        },
      },
    },
    {
      method: 'POST',
      path: '/profile/cv',
      handler: 'api::profile.profile.linkCv',
      config: {
        auth: {
          scope: ['authenticated'],
        },
      },
    },
  ],
};
