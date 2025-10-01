'use strict';

const { createCoreRouter } = require('@strapi/strapi').factories;

module.exports = createCoreRouter('api::deadline-todo.deadline-todo', {
  routes: [
    {
      method: 'GET',
      path: '/deadline-todo/user',
      handler: 'deadline-todo.findUserTodos',
      config: {
        auth: {
          scope: ['authenticated'],
        },
      },
    },
    {
      method: 'PUT',
      path: '/deadline-todo/user',
      handler: 'deadline-todo.updateUserTodos',
      config: {
        auth: {
          scope: ['authenticated'],
        },
      },
    },
  ],
});
