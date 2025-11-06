// src/api/referrals/services/referrals.ts
import { lookupReferrerByPromotionCodeId, createUserPromotionCode } from '../../../utils/stripe';

interface ReferralSummary {
  promoCode: string;
  referralLink: string;
  qualifiedReferrals: number;
  nextMilestone: number;
  fastTrackUntil: string | null;
  guaranteeActive: boolean;
}

interface RewardEntry {
  date: string;
  reason: string;
  type: 'weeks' | 'months' | 'guarantee';
  amount: number;
  packageSlug?: string;
}

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
  async getReferralSummary(userId: string): Promise<ReferralSummary> {
    let user = await strapi.entityService.findOne('plugin::users-permissions.user', userId, {
      fields: ['promoCode', 'referralCode', 'promoCodeId', 'username', 'qualifiedReferrals', 'fastTrackUntil', 'guaranteeActive']
    });

    if (!user) {
      throw new Error('User not found');
    }

    // If user doesn't have a promo code, create one
    if (!user.promoCode || !user.referralCode) {
      console.log(`[getReferralSummary] User ${userId} doesn't have promo code, creating one...`);
      
      // Generate referral code if missing
      let referralCode = user.referralCode || generateReferralCode();
      
      // Ensure uniqueness
      if (!user.referralCode) {
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
      }

      // Generate promo code
      const promoCode = generatePromoCode(user.username || `USER${userId}`, referralCode);
      console.log(`[getReferralSummary] Generated promo code: ${promoCode} for user ${userId}`);
      
      // Create Stripe promotion code (non-blocking - will return promo code even if Stripe creation fails)
      console.log(`[getReferralSummary] Calling createUserPromotionCode for user ${userId}...`);
      const { promotionCodeId, promotionCode: actualPromoCode } = await createUserPromotionCode(
        userId.toString(),
        promoCode
      );
      console.log(`[getReferralSummary] createUserPromotionCode returned:`, {
        promotionCodeId,
        promotionCode: actualPromoCode
      });
      
      // Update user with referral data
      // Note: promoCodeId may be null if Stripe creation failed, but promoCode will still work
      const updateData: any = {
        referralCode,
        promoCode: actualPromoCode
      };
      
      // Only set promoCodeId if it was successfully created in Stripe
      if (promotionCodeId) {
        updateData.promoCodeId = promotionCodeId;
      }
      
      await strapi.entityService.update('plugin::users-permissions.user', userId, {
        data: updateData
      });

      // Reload user to get updated data
      user = await strapi.entityService.findOne('plugin::users-permissions.user', userId, {
        fields: ['promoCode', 'referralCode', 'promoCodeId', 'qualifiedReferrals', 'fastTrackUntil', 'guaranteeActive']
      });
    } else {
      console.log(`[getReferralSummary] User ${userId} already has promo code: ${user.promoCode}`);
      
      // Check if the promo code exists in Stripe
      // If user doesn't have a promoCodeId, or if the promoCodeId is invalid, create it in Stripe
      let needsStripePromoCode = false;
      
      if (!user.promoCodeId) {
        console.log(`[getReferralSummary] User ${userId} has promo code "${user.promoCode}" but no promoCodeId. Creating in Stripe...`);
        needsStripePromoCode = true;
      } else {
        // Verify the promoCodeId exists in Stripe
        try {
          const { stripe } = await import('../../../utils/stripe');
          const promotionCode = await stripe.promotionCodes.retrieve(user.promoCodeId);
          console.log(`[getReferralSummary] Verified promoCodeId ${user.promoCodeId} exists in Stripe: ${promotionCode.code}`);
        } catch (error: any) {
          console.log(`[getReferralSummary] promoCodeId ${user.promoCodeId} not found in Stripe (${error.message}). Creating new one...`);
          needsStripePromoCode = true;
        }
      }
      
      if (needsStripePromoCode) {
        console.log(`[getReferralSummary] Creating Stripe promotion code for existing promo code "${user.promoCode}"...`);
        const { promotionCodeId, promotionCode: actualPromoCode } = await createUserPromotionCode(
          userId.toString(),
          user.promoCode
        );
        console.log(`[getReferralSummary] createUserPromotionCode returned:`, {
          promotionCodeId,
          promotionCode: actualPromoCode
        });
        
        // Update user with promoCodeId if it was successfully created
        if (promotionCodeId) {
          await strapi.entityService.update('plugin::users-permissions.user', userId, {
            data: { promoCodeId: promotionCodeId }
          });
          console.log(`[getReferralSummary] Updated user ${userId} with promoCodeId: ${promotionCodeId}`);
        } else {
          console.warn(`[getReferralSummary] Failed to create Stripe promotion code for user ${userId}. Promo code "${user.promoCode}" will still work but won't be in Stripe.`);
        }
      }
    }

    const referralLink = `https://effort-free.co.uk/pricing?ref=${user.referralCode}&promo=${user.promoCode}`;
    const nextMilestone = Math.max(0, 7 - (user.qualifiedReferrals || 0));

    return {
      promoCode: user.promoCode || '',
      referralLink,
      qualifiedReferrals: user.qualifiedReferrals || 0,
      nextMilestone,
      fastTrackUntil: user.fastTrackUntil,
      guaranteeActive: user.guaranteeActive || false
    };
  },

  async grantWeeks(userId: string, weeks: number, reason: string, packageSlug?: string): Promise<void> {
    const user = await strapi.entityService.findOne('plugin::users-permissions.user', userId, {
      fields: ['fastTrackUntil', 'referralRewards']
    });

    if (!user) {
      throw new Error('User not found');
    }

    const now = new Date();
    const currentFastTrackUntil = user.fastTrackUntil ? new Date(user.fastTrackUntil) : now;
    const newFastTrackUntil = new Date(currentFastTrackUntil.getTime() + (weeks * 7 * 24 * 60 * 60 * 1000));

    const newReward: RewardEntry = {
      date: now.toISOString(),
      reason,
      type: 'weeks',
      amount: weeks,
      packageSlug
    };

    const updatedRewards = [...(user.referralRewards || []), newReward];

    await strapi.entityService.update('plugin::users-permissions.user', userId, {
      data: {
        fastTrackUntil: newFastTrackUntil.toISOString(),
        referralRewards: updatedRewards
      }
    });
  },

  async grantMonthsFastTrack(userId: string, months: number, reason: string): Promise<void> {
    const user = await strapi.entityService.findOne('plugin::users-permissions.user', userId, {
      fields: ['fastTrackUntil', 'referralRewards']
    });

    if (!user) {
      throw new Error('User not found');
    }

    const now = new Date();
    const currentFastTrackUntil = user.fastTrackUntil ? new Date(user.fastTrackUntil) : now;
    const newFastTrackUntil = new Date(currentFastTrackUntil.getTime() + (months * 30 * 24 * 60 * 60 * 1000));

    const newReward: RewardEntry = {
      date: now.toISOString(),
      reason,
      type: 'months',
      amount: months
    };

    const updatedRewards = [...(user.referralRewards || []), newReward];

    await strapi.entityService.update('plugin::users-permissions.user', userId, {
      data: {
        fastTrackUntil: newFastTrackUntil.toISOString(),
        referralRewards: updatedRewards
      }
    });
  },

  async markQualifiedReferral({
    referrerId,
    refereeId,
    source,
    promotionCodeId,
    packageSlug
  }: {
    referrerId: string;
    refereeId: string;
    source: string;
    promotionCodeId: string;
    packageSlug: string;
  }): Promise<void> {
    // Prevent self-referrals
    if (referrerId === refereeId) {
      console.log('Self-referral prevented:', { referrerId, refereeId });
      return;
    }

    // Get referrer data
    const referrer = await strapi.entityService.findOne('plugin::users-permissions.user', referrerId, {
      fields: ['qualifiedReferrals', 'guaranteeActive', 'referralRewards', 'fastTrackUntil']
    });

    if (!referrer) {
      throw new Error('Referrer not found');
    }

    // Increment qualified referrals
    const newQualifiedReferrals = (referrer.qualifiedReferrals || 0) + 1;

    // Grant +1 week of the package the referee bought
    await this.grantWeeks(
      referrerId,
      1,
      `+1 week of ${packageSlug} from referral`,
      packageSlug
    );

    // Check milestone: 7 qualified referrals
    let guaranteeActive = referrer.guaranteeActive || false;
    if (newQualifiedReferrals >= 7 && !guaranteeActive) {
      // Grant +4 months of fast-track
      await this.grantMonthsFastTrack(
        referrerId,
        4,
        'Milestone reward: 7 qualified referrals'
      );

      guaranteeActive = true;
    }

    // Update referrer
    await strapi.entityService.update('plugin::users-permissions.user', referrerId, {
      data: {
        qualifiedReferrals: newQualifiedReferrals,
        guaranteeActive
      }
    });

    // Update referee to track who referred them
    await strapi.entityService.update('plugin::users-permissions.user', refereeId, {
      data: {
        referredBy: referrerId
      }
    });

    console.log(`Qualified referral processed: ${referrerId} -> ${refereeId} (${packageSlug})`);
  },

  async lookupReferrerByPromotionCodeId(promotionCodeId: string): Promise<string | null> {
    return await lookupReferrerByPromotionCodeId(promotionCodeId);
  }
};
