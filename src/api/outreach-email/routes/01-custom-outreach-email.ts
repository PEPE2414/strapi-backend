export default {
  routes: [
    {
      method: 'GET',
      path: '/outreach-emails/me',
      handler: 'outreach-email.me',
      config: { auth: true }   // <-- was auth:false + policy; now just auth:true
    },
    {
      method: 'POST',
      path: '/outreach-emails/find',
      handler: 'outreach-email.findEmails',
      config: { auth: true }   // <-- same here
    }
  ]
};
