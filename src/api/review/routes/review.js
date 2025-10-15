'use strict';

/**
 * review router
 */

const { createCoreRouter } = require('@strapi/strapi').factories;

const defaultRouter = createCoreRouter('api::review.review');

const customRoutes = {
  routes: [
    {
      method: 'POST',
      path: '/reviews/submit',
      handler: 'review.submitReview',
      config: {
        auth: {
          scope: ['api::review.review.create'],
        },
      },
    },
    {
      method: 'GET',
      path: '/reviews/featured',
      handler: 'review.getFeaturedReviews',
      config: {
        auth: false,
      },
    },
  ],
};

module.exports = {
  routes: [
    ...defaultRouter.routes,
    ...customRoutes.routes,
  ],
};
