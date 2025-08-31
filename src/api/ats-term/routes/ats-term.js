'use strict';

const { factories } = require('@strapi/strapi');

module.exports = factories.createCoreRouter('api::ats-term.ats-term', {
  config: {
    find:    { auth: false }, // GET /api/ats-terms
    findOne: { auth: false }, // GET /api/ats-terms/:id
  },
});
