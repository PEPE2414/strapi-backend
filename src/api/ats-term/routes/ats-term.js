'use strict';

module.exports = {
  routes: [
    {
      method: 'GET',
      path: '/ats-terms',
      handler: 'api::ats-term.ats-term.find',
      config: { auth: false },
    },
    {
      method: 'GET',
      path: '/ats-terms/:id',
      handler: 'api::ats-term.ats-term.findOne',
      config: { auth: false },
    },
  ],
};
