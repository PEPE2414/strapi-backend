/**
 * linkedin-optimisation router
 */

import { factories } from '@strapi/strapi';

export default factories.createCoreRouter(
  'api::linkedin-optimisation.linkedin-optimisation' as any,
  {
    only: ['find', 'findOne', 'create'],
    config: {
      create: {
        // Require authentication for create
        policies: [],
        middlewares: [],
      },
      find: {
        // Admin only for listing (controlled in controller)
        policies: [],
        middlewares: [],
      },
      findOne: {
        // Admin only for viewing (controlled in controller)
        policies: [],
        middlewares: [],
      },
    },
  }
);

