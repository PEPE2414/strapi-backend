'use strict';

const { createCoreController } = require('@strapi/strapi').factories;

module.exports = createCoreController('api::deadline-todo.deadline-todo', ({ strapi }) => ({
  async findUserTodos(ctx) {
    const { user } = ctx.state;
    if (!user) {
      return ctx.unauthorized('You must be authenticated to access todos');
    }

    try {
      const todos = await strapi.entityService.findMany('api::deadline-todo.deadline-todo', {
        filters: { user: user.id }
      });
      return ctx.send({ data: todos[0]?.todos || {} });
    } catch (error) {
      strapi.log.error('Error fetching user todos:', error);
      return ctx.internalServerError('Failed to fetch todos');
    }
  },

  async updateUserTodos(ctx) {
    const { user } = ctx.state;
    const { todos } = ctx.request.body;

    if (!user) {
      return ctx.unauthorized('You must be authenticated to update todos');
    }
    if (typeof todos !== 'object' || todos === null) {
      return ctx.badRequest('todos must be an object');
    }

    try {
      let userTodos = await strapi.entityService.findMany('api::deadline-todo.deadline-todo', {
        filters: { user: user.id }
      });

      if (userTodos.length > 0) {
        // Update existing
        userTodos = await strapi.entityService.update('api::deadline-todo.deadline-todo', userTodos[0].id, {
          data: { todos }
        });
      } else {
        // Create new
        userTodos = await strapi.entityService.create('api::deadline-todo.deadline-todo', {
          data: { user: user.id, todos }
        });
      }
      return ctx.send({ data: userTodos.todos });
    } catch (error) {
      strapi.log.error(`Error updating user todos:`, error);
      return ctx.internalServerError('Failed to update todos');
    }
  }
}));
