// src/api/webhooks/controllers/account-activation.ts
// Endpoint for n8n to activate user accounts after payment

export default {
  async activateAccount(ctx) {
    try {
      // Verify webhook secret for security
      const webhookSecret = ctx.request.headers['x-webhook-secret'];
      const expectedSecret = process.env.N8N_WEBHOOK_SECRET;
      
      if (!expectedSecret) {
        console.error('N8N_WEBHOOK_SECRET environment variable is not set');
        return ctx.internalServerError('Webhook configuration error');
      }

      if (webhookSecret !== expectedSecret) {
        return ctx.unauthorized('Invalid webhook secret');
      }

      const { userId, packageSlug, subscriptionId, stripeCustomerId } = ctx.request.body;

      if (!userId || !packageSlug) {
        return ctx.badRequest('userId and packageSlug are required');
      }

      // Get user
      const user = await strapi.entityService.findOne('plugin::users-permissions.user', userId, {
        fields: ['id', 'packages', 'plan', 'stripeCustomerId', 'stripeSubscriptionId']
      });

      if (!user) {
        return ctx.notFound('User not found');
      }

      // Get current packages array
      const packagesArr = Array.isArray(user.packages) ? user.packages : [];
      
      // Add package if not already present
      if (!packagesArr.includes(packageSlug)) {
        packagesArr.push(packageSlug);
      }

      // Update user with package and subscription info
      const updateData: any = {
        packages: packagesArr,
        plan: packageSlug, // Set plan to package slug
      };

      // Store Stripe subscription info if provided
      if (subscriptionId) {
        updateData.stripeSubscriptionId = subscriptionId;
      }
      if (stripeCustomerId) {
        updateData.stripeCustomerId = stripeCustomerId;
      }

      await strapi.entityService.update('plugin::users-permissions.user', userId, {
        data: updateData
      });

      console.log(`Account activated for user ${userId} with package ${packageSlug}`);

      ctx.body = {
        success: true,
        message: 'Account activated successfully',
        userId,
        packageSlug
      };
    } catch (error) {
      console.error('Error activating account:', error);
      ctx.internalServerError('Failed to activate account');
    }
  }
};

