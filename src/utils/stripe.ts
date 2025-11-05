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

// Ensure the 30_OFF_REFERRAL coupon exists
export async function ensureReferralCoupon(): Promise<string> {
  try {
    // Try to retrieve existing coupon
    const coupon = await stripe.coupons.retrieve('30_OFF_REFERRAL');
    return coupon.id;
  } catch (error) {
    // Coupon doesn't exist, create it
    if (error instanceof Stripe.errors.StripeError && error.code === 'resource_missing') {
      const coupon = await stripe.coupons.create({
        id: '30_OFF_REFERRAL',
        name: '30% Off Referral Discount',
        percent_off: 30,
        duration: 'once',
        metadata: {
          type: 'referral_discount',
          description: '30% off any package for referred users'
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
  
  // Verify the coupon exists before creating the promotion code
  try {
    const coupon = await stripe.coupons.retrieve(couponId);
    if (!coupon) {
      throw new Error(`Coupon ${couponId} does not exist`);
    }
  } catch (error) {
    console.error('Error verifying coupon before creating promotion code:', error);
    throw error;
  }
  
  // Check if a promotion code with this code already exists
  try {
    const existingCodes = await stripe.promotionCodes.list({
      code: promoCode,
      limit: 1
    });
    
    if (existingCodes.data.length > 0) {
      const existingCode = existingCodes.data[0];
      // Verify it belongs to this user
      if (existingCode.metadata?.userId === userId) {
        return {
          promotionCodeId: existingCode.id,
          promotionCode: existingCode.code
        };
      }
    }
  } catch (error) {
    console.log('Error checking for existing promotion code, will create new one:', error);
  }
  
  // Create new promotion code
  try {
    // Log the coupon ID to verify it's correct
    console.log('Creating promotion code with coupon ID:', couponId);
    
    // Use type assertion to bypass TypeScript error - coupon is valid in Stripe API
    // The coupon parameter is required for creating promotion codes
    const promotionCodeParams: any = {
      coupon: couponId,
      code: promoCode,
      // No max_redemptions - allow unlimited uses so the promo code can be shared
      metadata: {
        userId,
        type: 'referral_code'
      }
    };
    
    console.log('Promotion code params:', JSON.stringify(promotionCodeParams, null, 2));
    
    // @ts-ignore - TypeScript types may be outdated for this API version
    const promotionCode = await stripe.promotionCodes.create(promotionCodeParams);

    return {
      promotionCodeId: promotionCode.id,
      promotionCode: promotionCode.code
    };
  } catch (error: any) {
    console.error('Error creating promotion code:', error);
    // If it's a duplicate code error, try to find the existing one
    if (error.code === 'resource_already_exists' || error.message?.includes('already exists')) {
      const existingCodes = await stripe.promotionCodes.list({
        code: promoCode,
        limit: 1
      });
      
      if (existingCodes.data.length > 0) {
        const existingCode = existingCodes.data[0];
        return {
          promotionCodeId: existingCode.id,
          promotionCode: existingCode.code
        };
      }
    }
    throw error;
  }
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

// Check if a price is a 4-month subscription
export function is4MonthSubscription(price: Stripe.Price): boolean {
  // Check metadata for billing period
  if (price.metadata?.billing_period === '4-month') {
    return true;
  }
  
  // Check price ID - if it contains '4month' or similar pattern
  if (price.id.toLowerCase().includes('4month') || price.id.toLowerCase().includes('4-month')) {
    return true;
  }
  
  // Check interval and interval_count
  if (price.recurring) {
    // 4-month subscriptions typically have interval_count = 4 and interval = 'month'
    if (price.recurring.interval === 'month' && price.recurring.interval_count === 4) {
      return true;
    }
  }
  
  return false;
}

// Get package slug from Stripe product metadata
export function getPackageSlugFromProduct(product: Stripe.Product): string {
  return product.metadata?.package_slug || 'fast-track';
}

// Look up referrer by referral code (EF-REF-{userId} format)
export async function lookupReferrerByReferralCode(referralCode: string): Promise<string | null> {
  try {
    // Check if it matches EF-REF-{userId} format
    const match = referralCode.match(/^EF-REF-(\d+)$/i);
    if (match) {
      const userId = match[1];
      // Verify user exists
      const user = await strapi.entityService.findOne('plugin::users-permissions.user', userId, {
        fields: ['id']
      });
      return user ? userId : null;
    }
    
    // Fallback: try to find by referral code field
    const users = await strapi.entityService.findMany('plugin::users-permissions.user', {
      filters: {
        referralCode: referralCode
      },
      fields: ['id'],
      limit: 1
    });
    
    return users.length > 0 ? users[0].id.toString() : null;
  } catch (error) {
    console.error('Error looking up referrer by referral code:', error);
    return null;
  }
}