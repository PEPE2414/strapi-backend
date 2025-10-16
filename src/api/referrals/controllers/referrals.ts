// src/api/referrals/controllers/referrals.ts
import { errors } from '@strapi/utils';
const { UnauthorizedError } = errors;

export default {
  async me(ctx) {
    try {
      console.log('[referrals:me] Starting referrals/me request');
      console.log('[referrals:me] ctx.state:', ctx.state);
      console.log('[referrals:me] ctx.state.user:', ctx.state.user);
      console.log('[referrals:me] Authorization header:', ctx.request.header.authorization);
      
      const { user } = ctx.state;
      
      if (!user) {
        console.log('[referrals:me] No user found, returning unauthorized');
        throw new UnauthorizedError('Authentication required');
      }
      
      console.log('[referrals:me] User found:', user.id);

      // Check if user has referral data, if not generate it
      console.log('[referrals:me] Fetching user data for user:', user.id);
      const userData = await strapi.entityService.findOne('plugin::users-permissions.user', user.id, {
        fields: ['referralCode', 'promoCode', 'promoCodeId', 'username']
      });

      console.log('[referrals:me] User data:', userData);

      if (!userData.referralCode || !userData.promoCode || !userData.promoCodeId) {
        console.log('[referrals:me] User missing referral data, generating...');
        
        try {
          // Check if Stripe is configured
          const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
          if (!stripeSecretKey) {
            console.log('[referrals:me] Stripe not configured, creating mock referral data');
            // Create mock referral data without Stripe
            const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
            let referralCode = '';
            for (let i = 0; i < 6; i++) {
              referralCode += chars.charAt(Math.floor(Math.random() * chars.length));
            }
            
            // Ensure uniqueness
            let attempts = 0;
            while (attempts < 10) {
              const existing = await strapi.entityService.findMany('plugin::users-permissions.user', {
                filters: { referralCode },
                limit: 1
              });
              
              if (existing.length === 0) break;
              
              referralCode = '';
              for (let i = 0; i < 6; i++) {
                referralCode += chars.charAt(Math.floor(Math.random() * chars.length));
              }
              attempts++;
            }
            
            if (attempts >= 10) {
              throw new Error('Failed to generate unique referral code');
            }
            
            // Generate promo code
            const base = userData.username.toUpperCase().replace(/[^A-Z0-9]/g, '');
            const suffix = referralCode.toUpperCase();
            const promoCode = `EF-${base}-${suffix}`;
            
            // Update user with referral data (without Stripe)
            await strapi.entityService.update('plugin::users-permissions.user', user.id, {
              data: {
                referralCode,
                promoCode,
                promoCodeId: null, // No Stripe ID since Stripe isn't configured
                referralRewards: []
              }
            });
            
            console.log(`[referrals:me] Generated mock referral system for user ${user.id}: ${referralCode} / ${promoCode}`);
          } else {
            // Stripe is configured, create real promotion code
            const { createUserPromotionCode } = await import('../../../utils/stripe');
            
            // Generate referral code
            const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
            let referralCode = '';
            for (let i = 0; i < 6; i++) {
              referralCode += chars.charAt(Math.floor(Math.random() * chars.length));
            }
            
            // Ensure uniqueness
            let attempts = 0;
            while (attempts < 10) {
              const existing = await strapi.entityService.findMany('plugin::users-permissions.user', {
                filters: { referralCode },
                limit: 1
              });
              
              if (existing.length === 0) break;
              
              referralCode = '';
              for (let i = 0; i < 6; i++) {
                referralCode += chars.charAt(Math.floor(Math.random() * chars.length));
              }
              attempts++;
            }
            
            if (attempts >= 10) {
              throw new Error('Failed to generate unique referral code');
            }
            
            // Generate promo code
            const base = userData.username.toUpperCase().replace(/[^A-Z0-9]/g, '');
            const suffix = referralCode.toUpperCase();
            const promoCode = `EF-${base}-${suffix}`;
            
            // Create Stripe promotion code
            const { promotionCodeId, promotionCode: actualPromoCode } = await createUserPromotionCode(
              user.id.toString(),
              promoCode
            );
            
            // Update user with referral data
            await strapi.entityService.update('plugin::users-permissions.user', user.id, {
              data: {
                referralCode,
                promoCode: actualPromoCode,
                promoCodeId: promotionCodeId,
                referralRewards: []
              }
            });
            
            console.log(`[referrals:me] Generated referral system for user ${user.id}: ${referralCode} / ${actualPromoCode}`);
          }
        } catch (error) {
          console.error('[referrals:me] Error generating referral data:', error);
          // Don't throw here, just log the error and continue with mock data
        }
      }

      // Now get the referral summary directly
      console.log('[referrals:me] Fetching final user data...');
      const userWithReferralData = await strapi.entityService.findOne('plugin::users-permissions.user', user.id, {
        fields: ['promoCode', 'referralCode', 'qualifiedReferrals', 'fastTrackUntil', 'guaranteeActive']
      });

      console.log('[referrals:me] Final user data:', userWithReferralData);

      if (!userWithReferralData) {
        console.error('[referrals:me] User not found after processing');
        throw new Error('User not found');
      }

      // Create referral summary with safe defaults
      const referralSummary = {
        promoCode: userWithReferralData.promoCode || 'NOT-GENERATED',
        referralLink: userWithReferralData.referralCode && userWithReferralData.promoCode 
          ? `https://effort-free.co.uk/pricing?ref=${userWithReferralData.referralCode}&promo=${userWithReferralData.promoCode}`
          : 'https://effort-free.co.uk/pricing',
        qualifiedReferrals: userWithReferralData.qualifiedReferrals || 0,
        nextMilestone: Math.max(0, 7 - (userWithReferralData.qualifiedReferrals || 0)),
        fastTrackUntil: userWithReferralData.fastTrackUntil || null,
        guaranteeActive: userWithReferralData.guaranteeActive || false
      };

      console.log('[referrals:me] Generated referral summary:', referralSummary);
      
      ctx.body = {
        data: referralSummary
      };
    } catch (error) {
      console.error('[referrals:me] Error fetching referral summary:', error);
      console.error('[referrals:me] Error stack:', error.stack);
      ctx.internalServerError('Failed to fetch referral summary');
    }
  },

  async lookup(ctx) {
    try {
      const { promo } = ctx.query;
      
      if (!promo) {
        return ctx.badRequest('Promo code is required');
      }

      // Look up user by promo code
      const user = await strapi.entityService.findMany('plugin::users-permissions.user', {
        filters: { promoCode: promo },
        fields: ['username', 'preferredName', 'referralCode'],
        limit: 1
      });

      if (user.length === 0) {
        return ctx.body = { data: null };
      }

      const referrer = user[0];
      
      ctx.body = {
        data: {
          username: referrer.username,
          preferredName: referrer.preferredName,
          referralCode: referrer.referralCode
        }
      };
    } catch (error) {
      console.error('Error looking up referrer:', error);
      ctx.internalServerError('Failed to look up referrer');
    }
  }
};
