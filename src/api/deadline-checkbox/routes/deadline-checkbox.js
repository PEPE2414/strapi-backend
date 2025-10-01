'use strict';

const { createCoreRouter } = require('@strapi/strapi').factories;

module.exports = createCoreRouter('api::deadline-checkbox.deadline-checkbox', {
  routes: [
    {
      method: 'GET',
      path: '/deadlines-checkboxes/user',
      handler: 'deadline-checkbox.findUserCheckboxes',
      config: {
        auth: {
          scope: ['authenticated'],
        },
      },
    },
    {
      method: 'PUT',
      path: '/deadlines-checkboxes/user',
      handler: 'deadline-checkbox.updateUserCheckboxes',
      config: {
        auth: {
          scope: ['authenticated'],
        },
      },
    },
  ],
});
