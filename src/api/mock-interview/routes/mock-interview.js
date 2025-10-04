// strapi-backend/src/api/mock-interview/routes/mock-interview.js
'use strict';

/**
 * mock-interview router
 */

const { createCoreRouter } = require('@strapi/strapi').factories;

module.exports = createCoreRouter('api::mock-interview.mock-interview');

// Custom route for starting mock interviews
module.exports.routes = [
  {
    method: 'POST',
    path: '/mock-interview/start',
    handler: 'mock-interview.start',
    config: {
      auth: false,
      policies: [],
      middlewares: []
    }
  }
];
