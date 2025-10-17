// src/api/referrals/controllers/referrals.ts
import { errors } from '@strapi/utils';
const { UnauthorizedError } = errors;

export default {
  async test(ctx) {
    ctx.body = {
      data: {
        message: 'Referrals API is working',
        timestamp: new Date().toISOString()
      }
    };
  },

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

      // Simple fallback - return basic referral data without complex logic
      const referralSummary = {
        promoCode: `EF-${user.username?.toUpperCase() || 'USER'}-DEMO`,
        referralLink: `https://effort-free.co.uk/pricing?ref=${user.username || 'demo'}&promo=EF-${user.username?.toUpperCase() || 'USER'}-DEMO`,
        qualifiedReferrals: 0,
        nextMilestone: 7,
        fastTrackUntil: null,
        guaranteeActive: false
      };

      console.log('[referrals:me] Returning simple referral summary:', referralSummary);
      
      ctx.body = {
        data: referralSummary
      };
    } catch (error) {
      console.error('[referrals:me] Error fetching referral summary:', error);
      console.error('[referrals:me] Error stack:', error.stack);
      console.error('[referrals:me] Error details:', {
        message: error.message,
        name: error.name,
        stack: error.stack
      });
      
      // Return more detailed error information
      ctx.status = 500;
      ctx.body = {
        data: null,
        error: {
          status: 500,
          name: 'InternalServerError',
          message: `Failed to fetch referral summary: ${error.message}`,
          details: {
            originalError: error.message,
            stack: error.stack
          }
        }
      };
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
