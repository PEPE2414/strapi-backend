export default {
  type: 'content-api',
  routes: [
    {
      method: 'GET',
      path: '/diag/whoami',
      handler: 'diag.whoami',
      config: { auth: false } // public on purpose
    }
  ]
};
