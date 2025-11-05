// src/api/referrals/controllers/referrals.ts

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
      console.log('[referrals:me] Authorization header:', ctx.request.header.authorization);
      
      // Manual JWT verification since auth: false bypasses built-in auth
      const authHeader = ctx.request.header.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        console.log('[referrals:me] No valid Authorization header');
        return ctx.unauthorized('Authentication required');
      }
      
      const token = authHeader.slice(7);
      let user = null;
      
      try {
        // Use Strapi's JWT service to verify the token
        const jwtService = strapi.plugin('users-permissions').service('jwt');
        user = await jwtService.verify(token);
        console.log('[referrals:me] JWT verified, user ID:', user.id);
      } catch (jwtError) {
        console.log('[referrals:me] JWT verification failed:', jwtError.message);
        return ctx.unauthorized('Invalid token');
      }
      
      console.log('[referrals:me] User found:', user.id, user.username);

      // Use the referrals service to get the actual referral summary
      const referralService = strapi.service('api::referrals.referrals');
      const referralSummary = await referralService.getReferralSummary(user.id.toString());

      console.log('[referrals:me] Returning referral summary:', referralSummary);
      
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
