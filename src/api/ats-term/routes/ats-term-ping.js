'use strict';

module.exports = {
  routes: [
    {
      method: 'GET',
      path: '/ats-terms/ping',
      handler: 'api::ats-term.ats-term.ping',
      config: { auth: false },
    },
  ],
};
