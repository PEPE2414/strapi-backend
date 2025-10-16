// src/api/referrals/controllers/referrals.ts
export default {
  async me(ctx) {
    try {
      const { user } = ctx.state;
      
      if (!user) {
        return ctx.unauthorized('Authentication required');
      }

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
