// Public read-only routes for ATS Terms
export default {
  routes: [
    {
      method: 'GET',
      path: '/ats-terms',
      handler: 'api::ats-term.ats-term.find',
      config: { auth: { required: false } }
    },
    {
      method: 'GET',
      path: '/ats-terms/:id',
      handler: 'api::ats-term.ats-term.findOne',
      config: { auth: { required: false } }
    }
  ],
};
