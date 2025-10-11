// strapi-backend/src/api/mock-interview/routes/mock-interview.js
'use strict';

/**
 * mock-interview router
 */

const { createCoreRouter } = require('@strapi/strapi').factories;

module.exports = createCoreRouter('api::mock-interview.mock-interview');

// Custom routes for mock interviews
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
  },
  {
    method: 'POST',
    path: '/mock-interview/chat',
    handler: 'mock-interview.chat',
    config: {
      auth: false, // Manual JWT verification in controller
      policies: [],
      middlewares: []
    }
  },
  {
    method: 'GET',
    path: '/mock-interview/:sessionId/history',
    handler: 'mock-interview.getHistory',
    config: {
      auth: false, // Manual JWT verification in controller
      policies: [],
      middlewares: []
    }
  }
];
