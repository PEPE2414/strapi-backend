// src/extensions/users-permissions/content-types/user/lifecycles.ts
import { createUserPromotionCode } from '../../../../utils/stripe';

// Generate a short referral code (base36)
function generateReferralCode(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  for (let i = 0; i < 6; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

// Generate promo code from username or referral code
function generatePromoCode(username: string, referralCode: string): string {
  const base = username.toUpperCase().replace(/[^A-Z0-9]/g, '');
  const suffix = referralCode.toUpperCase();
  return `EF-${base}-${suffix}`;
}

export default {
  async afterCreate(event) {
    const { result: user } = event;
    
    try {
      // Generate referral code
      let referralCode = generateReferralCode();
      
      // Ensure uniqueness
      let attempts = 0;
      while (attempts < 10) {
        const existing = await strapi.entityService.findMany('plugin::users-permissions.user', {
          filters: { referralCode },
          limit: 1
        });
        
        if (existing.length === 0) break;
        
        referralCode = generateReferralCode();
        attempts++;
      }
      
      if (attempts >= 10) {
        console.error('Failed to generate unique referral code for user:', user.id);
        return;
      }
      
      // Generate promo code
      const promoCode = generatePromoCode(user.username, referralCode);
      
      // Create Stripe promotion code (non-blocking - will return promo code even if Stripe creation fails)
      const { promotionCodeId, promotionCode: actualPromoCode } = await createUserPromotionCode(
        user.id.toString(),
        promoCode
      );
      
      // Update user with referral data (NO trial auto-activation - user must click Start trial button)
      await strapi.entityService.update('plugin::users-permissions.user', user.id, {
        data: {
          referralCode,
          promoCode: actualPromoCode,
          promoCodeId: promotionCodeId,
          referralRewards: []
        }
      });
      
      console.log(`Created referral system for user ${user.id}: ${referralCode} / ${actualPromoCode}`);
      
    } catch (error) {
      console.error('Error setting up referral system for user:', user.id, error);
      // Don't throw - we don't want to break user creation
    }
  }
};
