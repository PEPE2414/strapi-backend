export default {
  routes: [
    {
      method: 'GET',
      path: '/cheat-sheets/me',
      handler: 'cheat-sheet.me',
      config: {
        auth: false,
        policies: [],
        middlewares: [],
      },
    },
    {
      method: 'POST',
      path: '/cheat-sheets/generate',
      handler: 'cheat-sheet.generate',
      config: {
        auth: false,
        policies: [],
        middlewares: [],
      },
    },
  ],
};