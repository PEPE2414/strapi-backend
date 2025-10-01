'use strict';

const { createCoreRouter } = require('@strapi/strapi').factories;

module.exports = createCoreRouter('api::deadlines-todos.deadlines-todos', {
  routes: [
    {
      method: 'GET',
      path: '/deadlines-todos/user',
      handler: 'deadlines-todos.findUserTodos',
      config: {
        auth: {
          scope: ['authenticated'],
        },
      },
    },
    {
      method: 'PUT',
      path: '/deadlines-todos/user',
      handler: 'deadlines-todos.updateUserTodos',
      config: {
        auth: {
          scope: ['authenticated'],
        },
      },
    },
  ],
});
