// strapi-backend/src/api/mock-interview/services/mock-interview.js
'use strict';

/**
 * mock-interview service
 */

const { createCoreService } = require('@strapi/strapi').factories;

module.exports = createCoreService('api::mock-interview.mock-interview');
