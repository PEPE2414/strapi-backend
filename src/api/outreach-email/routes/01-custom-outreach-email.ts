export default {
  routes: [
    {
      method: 'GET',
      path: '/outreach-emails/me',
      handler: 'outreach-email.me',
      config: { 
        auth: false,
        policies: [],
        middlewares: []
      }
    },
    {
      method: 'POST',
      path: '/outreach-emails/find',
      handler: 'outreach-email.findEmails',
      config: { 
        auth: false,
        policies: [],
        middlewares: []
      }
    },
    {
      method: 'POST',
      path: '/outreach-emails/upload-results',
      handler: 'outreach-email.uploadResults',
      config: { 
        auth: false,
        policies: [],
        middlewares: []
      }
    }
  ]
};
