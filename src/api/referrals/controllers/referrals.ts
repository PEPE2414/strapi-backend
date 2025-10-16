// src/api/referrals/controllers/referrals.ts
export default {
  async me(ctx) {
    try {
      const { user } = ctx.state;
      
      if (!user) {
        return ctx.unauthorized('Authentication required');
      }

      // Check if user has referral data, if not generate it
      const userData = await strapi.entityService.findOne('plugin::users-permissions.user', user.id, {
        fields: ['referralCode', 'promoCode', 'promoCodeId']
      });

      if (!userData.referralCode || !userData.promoCode || !userData.promoCodeId) {
        console.log('User missing referral data, generating...');
        // Import and run the referral generation logic
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
        
        console.log(`Generated referral system for user ${user.id}: ${referralCode} / ${actualPromoCode}`);
      }

      // Now get the referral summary
      const referralSummary = await strapi.service('api::referrals.referrals').getReferralSummary(user.id);
      
      ctx.body = {
        data: referralSummary
      };
    } catch (error) {
      console.error('Error fetching referral summary:', error);
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
