'use strict';

module.exports = {
  async ping(ctx) {
    ctx.body = {
      ok: true,
      apis: Object.keys(strapi.api || {}).sort(), // which APIs Strapi loaded
    };
  },
};
