export default {
  routes: [
    {
      method: 'GET',
      path: '/outreach-emails/me',
      handler: 'outreach-email.me',
      config: {
        auth: false,
        policies: ['plugin::users-permissions.isAuthenticated']
      }
    },
    {
      method: 'POST',
      path: '/outreach-emails/find',
      handler: 'outreach-email.findEmails',
      config: {
        auth: false,
        policies: ['plugin::users-permissions.isAuthenticated']
      }
    }
  ]
};
