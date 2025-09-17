export default {
  routes: [
    {
      method: 'GET',
      path: '/outreach-emails/me',
      handler: 'outreach-email.me',
      // config: { auth: true }  <-- remove this line entirely
    },
    {
      method: 'POST',
      path: '/outreach-emails/find',
      handler: 'outreach-email.findEmails',
      // config: { auth: true }  <-- remove this line entirely
    }
  ]
};
