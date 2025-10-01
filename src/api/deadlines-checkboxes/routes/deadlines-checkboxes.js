'use strict';

const { createCoreRouter } = require('@strapi/strapi').factories;

module.exports = createCoreRouter('api::deadline-checkbox.deadline-checkbox', {
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
