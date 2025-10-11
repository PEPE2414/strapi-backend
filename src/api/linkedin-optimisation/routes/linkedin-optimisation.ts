/**
 * linkedin-optimisation router
 */

import { factories } from '@strapi/strapi';

export default factories.createCoreRouter(
  'api::linkedin-optimisation.linkedin-optimisation',
  {
    config: {
      create: {
        // Require authentication for create
        policies: [],
        middlewares: [],
      },
      find: {
        // Admin only for listing
        policies: [],
        middlewares: [],
      },
      findOne: {
        // Admin only for viewing
        policies: [],
        middlewares: [],
      },
      update: {
        // Disable update
        policies: ['admin::isAdmin'],
        middlewares: [],
      },
      delete: {
        // Disable delete
        policies: ['admin::isAdmin'],
        middlewares: [],
      },
    },
  }
);

