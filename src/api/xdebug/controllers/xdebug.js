'use strict';

module.exports = {
  async index(ctx) {
    ctx.body = {
      ok: true,
      apis: Object.keys(strapi.container.get('content-types') || {}),
    };
  },
};

