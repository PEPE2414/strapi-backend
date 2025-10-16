// src/api/referrals/services/referrals.ts
import { lookupReferrerByPromotionCodeId } from '../../../utils/stripe';

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

export default {
  async getReferralSummary(userId: string): Promise<ReferralSummary> {
    const user = await strapi.entityService.findOne('plugin::users-permissions.user', userId, {
      fields: ['promoCode', 'referralCode', 'qualifiedReferrals', 'fastTrackUntil', 'guaranteeActive']
    });

    if (!user) {
      throw new Error('User not found');
    }

    const referralLink = `https://effort-free.co.uk/pricing?ref=${user.referralCode}&promo=${user.promoCode}`;
    const nextMilestone = Math.max(0, 7 - user.qualifiedReferrals);

    return {
      promoCode: user.promoCode,
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
      // Grant +3 months of fast-track
      await this.grantMonthsFastTrack(
        referrerId,
        3,
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
