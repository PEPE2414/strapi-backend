'use strict';

const { factories } = require('@strapi/strapi');

module.exports = factories.createCoreController('api::ats-term.ats-term', ({ strapi }) => ({
  // Debug endpoint: GET /api/ats-terms/ping
  async ping(ctx) {
    ctx.body = { ok: true, uid: 'api::ats-term.ats-term' };
  },
}));
