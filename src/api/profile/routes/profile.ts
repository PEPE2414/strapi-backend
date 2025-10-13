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
        middlewares: [],
      },
    },
    {
      method: 'PUT',
      path: '/profile/me',
      handler: 'profile.updateProfile',
      config: {
        policies: [],
        middlewares: [],
      },
    },
    {
      method: 'PUT',
      path: '/user/profile',
      handler: 'profile.updateProfile',
      config: {
        policies: [],
        middlewares: [],
      },
    },
    {
      method: 'GET',
      path: '/profile/cv',
      handler: 'profile.getCv',
      config: {
        auth: false,
        policies: [],
        middlewares: [],
      },
    },
    {
      method: 'POST',
      path: '/profile/cv',
      handler: 'profile.linkCv',
      config: {
        auth: false,
        policies: [],
        middlewares: [],
      },
    },
    {
      method: 'POST',
      path: '/profile/validate-text',
      handler: 'profile.validateText',
      config: {
        auth: false,
        policies: [],
        middlewares: [],
      },
    },
    {
      method: 'POST',
      path: '/profile/previous-cover-letters',
      handler: 'profile.addPreviousCoverLetter',
      config: {
        auth: false,
        policies: [],
        middlewares: [],
      },
    },
    {
      method: 'GET',
      path: '/profile/previous-cover-letters',
      handler: 'profile.getPreviousCoverLetters',
      config: {
        auth: false,
        policies: [],
        middlewares: [],
      },
    },
    {
      method: 'DELETE',
      path: '/profile/previous-cover-letters/:fileId',
      handler: 'profile.removePreviousCoverLetter',
      config: {
        auth: false,
        policies: [],
        middlewares: [],
      },
    },
    {
      method: 'GET',
      path: '/profile/debug-cover-letter-extraction',
      handler: 'profile.debugCoverLetterExtraction',
      config: {
        auth: false,
        policies: [],
        middlewares: [],
      },
    },
  ],
};
