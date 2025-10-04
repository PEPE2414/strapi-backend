export default {
  routes: [
    // Disable all core routes by not including them
    // Only our custom routes are enabled
    {
      method: 'GET',
      path: '/cheat-sheets/me',
      handler: 'cheat-sheet.me',
      config: {
        auth: {
          scope: ['authenticated'],
        },
      },
    },
    {
      method: 'POST',
      path: '/cheat-sheets/generate',
      handler: 'cheat-sheet.generate',
      config: {
        auth: {
          scope: ['authenticated'],
        },
      },
    },
  ],
};