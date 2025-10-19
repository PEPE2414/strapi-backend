/**
 * Error Log Service
 */

export default ({ strapi }) => ({
  async find(params) {
    return strapi.entityService.findMany('api::error-log.error-log', params);
  },

  async findOne(id, params) {
    return strapi.entityService.findOne('api::error-log.error-log', id, params);
  },

  async create(params) {
    return strapi.entityService.create('api::error-log.error-log', params);
  },

  async update(id, params) {
    return strapi.entityService.update('api::error-log.error-log', id, params);
  },

  async delete(id, params) {
    return strapi.entityService.delete('api::error-log.error-log', id, params);
  },
});
