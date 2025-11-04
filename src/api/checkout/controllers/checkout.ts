// src/api/checkout/controllers/checkout.ts
import { stripe } from '../../../utils/stripe';

// Map internal package slugs to Stripe price IDs
const PACKAGE_PRICE_MAP = {
  'fast-track': process.env.STRIPE_FAST_TRACK_PRICE_ID,
  'interview-pack': process.env.STRIPE_INTERVIEW_PACK_PRICE_ID,
  'premium': process.env.STRIPE_PREMIUM_PRICE_ID,
  'standard': process.env.STRIPE_STANDARD_PRICE_ID,
  'basic': process.env.STRIPE_BASIC_PRICE_ID
};

// Validate required environment variables
const requiredEnvVars = [
  'STRIPE_FAST_TRACK_PRICE_ID',
  'STRIPE_INTERVIEW_PACK_PRICE_ID'
];

for (const envVar of requiredEnvVars) {
  if (!process.env[envVar]) {
    console.error(`Missing required environment variable: ${envVar}`);
  }
}

export default {
  async createSession(ctx) {
    try {
      const { user } = ctx.state;
      const { packageSlug, promo, ref } = ctx.request.body;

      if (!user) {
        return ctx.unauthorized('Authentication required');
      }

      if (!packageSlug || !PACKAGE_PRICE_MAP[packageSlug]) {
        return ctx.badRequest('Invalid package slug');
      }

      const priceId = PACKAGE_PRICE_MAP[packageSlug];
      
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
        client_reference_id: user.id.toString(),
        metadata: {
          userId: user.id.toString(),
          packageSlug,
          refCode: ref || '',
          promoCode: promo || ''
        }
      };

      // For embedded checkout, use embedded mode
      if (isEmbedded) {
        sessionParams.ui_mode = 'embedded';
        sessionParams.return_url = `${process.env.FRONTEND_URL}/pricing?session_id={CHECKOUT_SESSION_ID}`;
      } else {
        // For hosted checkout, use redirect URLs
        sessionParams.success_url = `${process.env.FRONTEND_URL}/app/dashboard?success=true`;
        sessionParams.cancel_url = `${process.env.FRONTEND_URL}/pricing?cancelled=true`;
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
      } catch (error) {
        console.error('Error updating price metadata:', error);
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
