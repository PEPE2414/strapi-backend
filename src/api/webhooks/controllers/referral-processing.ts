// src/api/webhooks/controllers/referral-processing.ts
// Endpoint for n8n to process referrals after payment

import { lookupReferrerByReferralCode } from '../../../utils/stripe';

export default {
  async processReferral(ctx) {
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

      const { userId, referralCode, packageSlug, promotionCodeId } = ctx.request.body;

      if (!userId || !packageSlug) {
        return ctx.badRequest('userId and packageSlug are required');
      }

      // If no referral code provided, skip referral processing
      if (!referralCode && !promotionCodeId) {
        ctx.body = {
          success: true,
          message: 'No referral code provided, skipping referral processing',
          userId
        };
        return;
      }

      let referrerId: string | null = null;

      // Try to look up referrer by promotion code ID first (Stripe promotion codes)
      if (promotionCodeId) {
        referrerId = await strapi.service('api::referrals.referrals').lookupReferrerByPromotionCodeId(promotionCodeId);
      }

      // If not found and referral code provided, try referral code lookup
      if (!referrerId && referralCode) {
        referrerId = await lookupReferrerByReferralCode(referralCode);
      }

      // Process referral if referrer found
      if (referrerId) {
        await strapi.service('api::referrals.referrals').markQualifiedReferral({
          referrerId,
          refereeId: userId.toString(),
          source: 'n8n',
          promotionCodeId: promotionCodeId || '',
          packageSlug
        });

        console.log(`Referral processed via n8n: ${referrerId} -> ${userId} (${packageSlug})`);

        ctx.body = {
          success: true,
          message: 'Referral processed successfully',
          userId,
          referrerId,
          packageSlug
        };
      } else {
        console.log(`No referrer found for referral code: ${referralCode || promotionCodeId}`);
        ctx.body = {
          success: true,
          message: 'No referrer found for provided referral code',
          userId
        };
      }
    } catch (error) {
      console.error('Error processing referral:', error);
      ctx.internalServerError('Failed to process referral');
    }
  }
};

