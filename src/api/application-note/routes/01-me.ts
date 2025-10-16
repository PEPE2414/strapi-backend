export default {
  routes: [
    {
      method: 'GET',
      path: '/application-notes/me',
      handler: 'application-note.me',
      config: {
        auth: false, // We handle auth manually in controller
      },
    },
    {
      method: 'PUT',
      path: '/application-notes/me',
      handler: 'application-note.updateMe',
      config: {
        auth: false, // We handle auth manually in controller
      },
    },
  ],
};
