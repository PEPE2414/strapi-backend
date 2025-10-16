// src/utils/stripe.ts
import Stripe from 'stripe';

// Validate Stripe secret key
const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
if (!stripeSecretKey) {
  console.error('STRIPE_SECRET_KEY environment variable is not set');
  throw new Error('STRIPE_SECRET_KEY environment variable is required');
}

const stripe = new Stripe(stripeSecretKey, {
  apiVersion: '2025-09-30.clover',
});

export { stripe };

// Ensure the 20_OFF_FIRST coupon exists
export async function ensureReferralCoupon(): Promise<string> {
  try {
    // Try to retrieve existing coupon
    const coupon = await stripe.coupons.retrieve('20_OFF_FIRST');
    return coupon.id;
  } catch (error) {
    // Coupon doesn't exist, create it
    if (error instanceof Stripe.errors.StripeError && error.code === 'resource_missing') {
      const coupon = await stripe.coupons.create({
        id: '20_OFF_FIRST',
        name: '20% Off First Month',
        percent_off: 20,
        duration: 'once',
        metadata: {
          type: 'referral_discount',
          description: '20% off first month for referred users'
        }
      });
      return coupon.id;
    }
    throw error;
  }
}

// Create a promotion code for a user
export async function createUserPromotionCode(
  userId: string, 
  promoCode: string
): Promise<{ promotionCodeId: string; promotionCode: string }> {
  const couponId = await ensureReferralCoupon();
  
  const promotionCode = await stripe.promotionCodes.create({
    coupon: couponId,
    code: promoCode,
    max_redemptions: 1,
    metadata: {
      userId,
      type: 'referral_code'
    }
  } as any);

  return {
    promotionCodeId: promotionCode.id,
    promotionCode: promotionCode.code
  };
}

// Look up referrer by promotion code ID
export async function lookupReferrerByPromotionCodeId(promotionCodeId: string) {
  try {
    const promotionCode = await stripe.promotionCodes.retrieve(promotionCodeId);
    return promotionCode.metadata?.userId || null;
  } catch (error) {
    console.error('Error looking up promotion code:', error);
    return null;
  }
}

// Get package slug from Stripe price metadata
export function getPackageSlugFromPrice(price: Stripe.Price): string {
  return price.metadata?.package_slug || 'fast-track';
}

// Get package slug from Stripe product metadata
export function getPackageSlugFromProduct(product: Stripe.Product): string {
  return product.metadata?.package_slug || 'fast-track';
}