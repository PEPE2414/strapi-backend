'use strict';

const { createCoreController } = require('@strapi/strapi').factories;

module.exports = createCoreController('api::deadline-checkbox.deadline-checkbox', ({ strapi }) => ({
  async findUserCheckboxes(ctx) {
    const { user } = ctx.state;
    if (!user) {
      return ctx.unauthorized('You must be authenticated to access checkboxes');
    }

    try {
      const checkboxes = await strapi.entityService.findMany('api::deadline-checkbox.deadline-checkbox', {
        filters: { user: user.id }
      });
      return ctx.send({ data: checkboxes[0]?.checkboxes || {} });
    } catch (error) {
      strapi.log.error('Error fetching user checkboxes:', error);
      return ctx.internalServerError('Failed to fetch checkboxes');
    }
  },

  async updateUserCheckboxes(ctx) {
    const { user } = ctx.state;
    const { checkboxes } = ctx.request.body;

    if (!user) {
      return ctx.unauthorized('You must be authenticated to update checkboxes');
    }
    if (typeof checkboxes !== 'object' || checkboxes === null) {
      return ctx.badRequest('checkboxes must be an object');
    }

    try {
      let userCheckboxes = await strapi.entityService.findMany('api::deadline-checkbox.deadline-checkbox', {
        filters: { user: user.id }
      });

      if (userCheckboxes.length > 0) {
        // Update existing
        userCheckboxes = await strapi.entityService.update('api::deadline-checkbox.deadline-checkbox', userCheckboxes[0].id, {
          data: { checkboxes }
        });
      } else {
        // Create new
        userCheckboxes = await strapi.entityService.create('api::deadline-checkbox.deadline-checkbox', {
          data: { user: user.id, checkboxes }
        });
      }
      return ctx.send({ data: userCheckboxes.checkboxes });
    } catch (error) {
      strapi.log.error(`Error updating user checkboxes:`, error);
      return ctx.internalServerError('Failed to update checkboxes');
    }
  }
}));
