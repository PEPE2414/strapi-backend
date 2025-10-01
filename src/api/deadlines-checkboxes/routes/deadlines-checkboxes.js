'use strict';

const { createCoreRouter } = require('@strapi/strapi').factories;

module.exports = createCoreRouter('api::deadlines-checkboxes.deadlines-checkboxes', {
  routes: [
    {
      method: 'GET',
      path: '/deadlines-checkboxes/user',
      handler: 'deadlines-checkboxes.findUserCheckboxes',
      config: {
        auth: {
          scope: ['authenticated'],
        },
      },
    },
    {
      method: 'PUT',
      path: '/deadlines-checkboxes/user',
      handler: 'deadlines-checkboxes.updateUserCheckboxes',
      config: {
        auth: {
          scope: ['authenticated'],
        },
      },
    },
  ],
});
