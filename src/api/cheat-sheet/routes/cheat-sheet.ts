export default {
  routes: [
    {
      method: 'GET',
      path: '/cheat-sheets/me',
      handler: 'cheat-sheet.me',
      config: {
        policies: ['global::is-authenticated'],
      },
    },
    {
      method: 'POST',
      path: '/cheat-sheets/generate',
      handler: 'cheat-sheet.generate',
      config: {
        policies: ['global::is-authenticated'],
      },
    },
  ],
};
