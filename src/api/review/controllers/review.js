'use strict';

/**
 * review controller
 */

const { createCoreController } = require('@strapi/strapi').factories;

module.exports = createCoreController('api::review.review', ({ strapi }) => ({
  async submitReview(ctx) {
    try {
      const { user } = ctx.state;
      if (!user) {
        return ctx.unauthorized('You must be logged in to submit a review');
      }

      const { generalReview, worthItReview, rating } = ctx.request.body;

      if (!generalReview || !worthItReview || !rating) {
        return ctx.badRequest('Missing required fields: generalReview, worthItReview, rating');
      }

      if (rating < 1 || rating > 5) {
        return ctx.badRequest('Rating must be between 1 and 5');
      }

      // Check if user already submitted a review
      const existingReview = await strapi.entityService.findMany('api::review.review', {
        filters: { user: user.id },
      });

      if (existingReview.length > 0) {
        return ctx.badRequest('You have already submitted a review');
      }

      // Create the review
      const review = await strapi.entityService.create('api::review.review', {
        data: {
          user: user.id,
          generalReview,
          worthItReview,
          rating,
          approved: false,
          featured: false,
        },
      });

      // Mark user as having submitted a review
      await strapi.entityService.update('plugin::users-permissions.user', user.id, {
        data: {
          reviewSubmitted: true,
        },
      });

      // Award credits based on user's plan
      const userData = await strapi.entityService.findOne('plugin::users-permissions.user', user.id);
      const userPlan = userData.plan;

      if (userPlan === 'offer-fast-track') {
        // Award +10 mock interview minutes
        await strapi.entityService.update('plugin::users-permissions.user', user.id, {
          data: {
            mockInterviewMinutes: (userData.mockInterviewMinutes || 0) + 10,
          },
        });
      } else {
        // Award +5 email/LinkedIn credits
        await strapi.entityService.update('plugin::users-permissions.user', user.id, {
          data: {
            emailCredits: (userData.emailCredits || 0) + 5,
          },
        });
      }

      return ctx.created(review);
    } catch (error) {
      return ctx.internalServerError('Failed to submit review');
    }
  },

  async getFeaturedReviews(ctx) {
    try {
      const reviews = await strapi.entityService.findMany('api::review.review', {
        filters: {
          featured: true,
          approved: true,
        },
        populate: {
          user: {
            fields: ['preferredName', 'university'],
          },
        },
        sort: { createdAt: 'desc' },
        pagination: {
          page: 1,
          pageSize: 10,
        },
      });

      return ctx.ok(reviews);
    } catch (error) {
      return ctx.internalServerError('Failed to fetch featured reviews');
    }
  },
}));
