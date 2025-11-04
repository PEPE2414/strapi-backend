// src/api/checkout/controllers/checkout.ts
import { stripe } from '../../../utils/stripe';

// Map internal package slugs to Stripe price IDs
// Note: fast-track package = "Offer Fast-Track" on site
//       interview-pack package = "Interview Fast-Track" on site
const PACKAGE_PRICE_MAP = {
  'fast-track': {
    monthly: process.env.STRIPE_FAST_TRACK_PRICE_ID,
    '4-month': process.env.STRIPE_FAST_TRACK_PRICE_ID_4MONTHS
  },
  'interview-pack': {
    monthly: process.env.STRIPE_INTERVIEW_PACK_PRICE_ID,
    '4-month': process.env.STRIPE_INTERVIEW_FAST_TRACK_PRICE_ID_4MONTHS
  },
  'premium': {
    monthly: process.env.STRIPE_PREMIUM_PRICE_ID,
    '4-month': process.env.STRIPE_PREMIUM_PRICE_ID
  },
  'standard': {
    monthly: process.env.STRIPE_STANDARD_PRICE_ID,
    '4-month': process.env.STRIPE_STANDARD_PRICE_ID
  },
  'basic': {
    monthly: process.env.STRIPE_BASIC_PRICE_ID,
    '4-month': process.env.STRIPE_BASIC_PRICE_ID
  }
};

// Validate required environment variables
const requiredEnvVars = [
  'STRIPE_FAST_TRACK_PRICE_ID',
  'STRIPE_INTERVIEW_PACK_PRICE_ID',
  'STRIPE_FAST_TRACK_PRICE_ID_4MONTHS',
  'STRIPE_INTERVIEW_FAST_TRACK_PRICE_ID_4MONTHS'
];

for (const envVar of requiredEnvVars) {
  if (!process.env[envVar]) {
    console.error(`Missing required environment variable: ${envVar}`);
  }
}

export default {
  async createSession(ctx) {
    try {
      // Manual JWT verification since auth: false bypasses built-in auth
      const authHeader = ctx.request.header.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return ctx.unauthorized('Authentication required');
      }
      
      const token = authHeader.slice(7);
      let user = null;
      
      try {
        // Use Strapi's JWT service to verify the token
        const jwtService = strapi.plugin('users-permissions').service('jwt');
        user = await jwtService.verify(token);
      } catch (jwtError) {
        console.error('JWT verification failed:', jwtError.message);
        return ctx.unauthorized('Invalid token');
      }

      // Get user from database
      const userEntity = await strapi.entityService.findOne('plugin::users-permissions.user', user.id, {
        populate: ['*']
      });

      if (!userEntity) {
        return ctx.unauthorized('User not found');
      }

      const { packageSlug, billingPeriod = 'monthly', promo, ref } = ctx.request.body;

      console.log('Checkout request:', { packageSlug, billingPeriod, promo, ref });
      console.log('Available packages:', Object.keys(PACKAGE_PRICE_MAP));
      console.log('PACKAGE_PRICE_MAP structure:', JSON.stringify(PACKAGE_PRICE_MAP, null, 2));

      if (!packageSlug) {
        console.error('Package slug is missing');
        return ctx.badRequest('Package slug is required');
      }

      const packageConfig = PACKAGE_PRICE_MAP[packageSlug];
      console.log(`Package config for "${packageSlug}":`, packageConfig);

      if (!packageConfig) {
        const availablePackages = Object.keys(PACKAGE_PRICE_MAP).join(', ');
        const errorMsg = `Invalid package slug: "${packageSlug}". Available packages: ${availablePackages}`;
        console.error(errorMsg);
        return ctx.badRequest(errorMsg);
      }

      // Get price ID based on package and billing period
      const priceId = packageConfig?.[billingPeriod] || packageConfig?.monthly;
      
      console.log('Price ID lookup:', { packageSlug, billingPeriod, priceId, packageConfig });
      
      if (!priceId) {
        const errorMsg = `Price ID not found for package: ${packageSlug}, billing period: ${billingPeriod}. Available periods: ${Object.keys(packageConfig).join(', ')}`;
        console.error(errorMsg);
        return ctx.badRequest(errorMsg);
      }

      // Validate that priceId is actually a Price ID (starts with 'price_') not a Product ID (starts with 'prod_')
      if (!priceId.startsWith('price_')) {
        const errorMsg = `Invalid Price ID format: "${priceId}". Price IDs must start with "price_". This looks like a Product ID (starts with "prod_"). Please check your environment variables in Railway.`;
        console.error(errorMsg);
        return ctx.badRequest(errorMsg);
      }
      
      // Build session parameters
      // Support both embedded and hosted checkout modes
      const isEmbedded = ctx.request.body.embedded === true;
      
      const sessionParams: any = {
        mode: 'subscription',
        payment_method_types: ['card'],
        line_items: [
          {
            price: priceId,
            quantity: 1
          }
        ],
        client_reference_id: userEntity.id.toString(),
        metadata: {
          userId: userEntity.id.toString(),
          packageSlug,
          refCode: ref || '',
          promoCode: promo || ''
        }
      };

      // For embedded checkout, use embedded mode
      if (isEmbedded) {
        sessionParams.ui_mode = 'embedded';
        
        // Ensure FRONTEND_URL has a scheme (https://)
        const frontendUrl = process.env.FRONTEND_URL || '';
        if (!frontendUrl) {
          console.error('FRONTEND_URL environment variable is not set');
          return ctx.badRequest('Frontend URL is not configured. Please set FRONTEND_URL in Railway.');
        }
        
        // Add https:// if missing
        const returnUrl = frontendUrl.startsWith('http://') || frontendUrl.startsWith('https://')
          ? `${frontendUrl}/pricing?session_id={CHECKOUT_SESSION_ID}`
          : `https://${frontendUrl}/pricing?session_id={CHECKOUT_SESSION_ID}`;
        
        sessionParams.return_url = returnUrl;
        console.log('Embedded checkout return_url:', returnUrl);
      } else {
        // For hosted checkout, use redirect URLs
        const frontendUrl = process.env.FRONTEND_URL || '';
        if (!frontendUrl) {
          console.error('FRONTEND_URL environment variable is not set');
          return ctx.badRequest('Frontend URL is not configured. Please set FRONTEND_URL in Railway.');
        }
        
        // Add https:// if missing
        const baseUrl = frontendUrl.startsWith('http://') || frontendUrl.startsWith('https://')
          ? frontendUrl
          : `https://${frontendUrl}`;
        
        sessionParams.success_url = `${baseUrl}/app/dashboard?success=true`;
        sessionParams.cancel_url = `${baseUrl}/pricing?cancelled=true`;
        console.log('Hosted checkout URLs:', { success_url: sessionParams.success_url, cancel_url: sessionParams.cancel_url });
      }

      // Handle promotion code
      if (promo) {
        // Look up the promotion code to get its ID
        try {
          const promotionCodes = await stripe.promotionCodes.list({
            code: promo,
            limit: 1
          });

          if (promotionCodes.data.length > 0) {
            sessionParams.discounts = [{
              promotion_code: promotionCodes.data[0].id
            }];
          } else {
            // If promo code not found, enable promotion codes for manual entry
            sessionParams.allow_promotion_codes = true;
          }
        } catch (error) {
          console.error('Error looking up promotion code:', error);
          sessionParams.allow_promotion_codes = true;
        }
      } else {
        sessionParams.allow_promotion_codes = true;
      }

      // Ensure the price has the correct metadata
      try {
        const price = await stripe.prices.retrieve(priceId);
        if (!price.metadata?.package_slug) {
          await stripe.prices.update(priceId, {
            metadata: {
              ...price.metadata,
              package_slug: packageSlug
            }
          });
        }
      } catch (error: any) {
        console.error('Error updating price metadata:', error);
        // If it's a Stripe error about invalid price ID, provide helpful message
        if (error?.type === 'StripeInvalidRequestError' && error?.code === 'resource_missing') {
          const errorMsg = `Stripe Price ID "${priceId}" not found. Please check that this Price ID exists in your Stripe account and matches the environment variable in Railway. Error: ${error.message}`;
          console.error(errorMsg);
          return ctx.badRequest(errorMsg);
        }
        // For other errors, log but continue (metadata update is optional)
      }

      const session = await stripe.checkout.sessions.create(sessionParams);

      // For embedded checkout, the client_secret is available on the session
      if (isEmbedded) {
        // For embedded checkout, client_secret is available directly on the session
        // when ui_mode is 'embedded'
        ctx.body = {
          data: {
            sessionId: session.id,
            clientSecret: session.client_secret,
            url: session.url // Keep for fallback
          }
        };
      } else {
        ctx.body = {
          data: {
            sessionId: session.id,
            url: session.url
          }
        };
      }

    } catch (error) {
      console.error('Error creating checkout session:', error);
      // Return more detailed error information
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const errorDetails = error?.type || error?.code || 'unknown';
      
      console.error('Stripe error details:', {
        message: errorMessage,
        type: errorDetails,
        statusCode: error?.statusCode
      });
      
      ctx.internalServerError({
        error: {
          message: errorMessage,
          type: errorDetails
        }
      });
    }
  }
};
