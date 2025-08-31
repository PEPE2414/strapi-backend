'use strict';
module.exports = {
  routes: [
    {
      method: 'POST',
      path: '/ats-terms/bulk',
      handler: 'api::ats-term.bulk.bulkUpsert',
      config: { auth: false } // protected by x-seed-secret header
    },
  ],
};
