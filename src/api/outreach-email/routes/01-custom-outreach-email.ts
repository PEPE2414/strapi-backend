export default {
  routes: [
    {
      method: 'GET',
      path: '/outreach-emails/me',
      handler: 'outreach-email.me',
      config: { policies: ['global::is-authenticated'] } // <— no auth:true
    },
    {
      method: 'POST',
      path: '/outreach-emails/find',
      handler: 'outreach-email.findEmails',
      config: { policies: ['global::is-authenticated'] } // <— no auth:true
    }
  ]
};
