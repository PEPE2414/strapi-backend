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

// Helper function to sleep/delay
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Create a promotion code for a user with retry logic
// Returns promo code string even if Stripe promotion code creation fails (code can still be used manually)
export async function createUserPromotionCode(
  userId: string, 
  promoCode: string
): Promise<{ promotionCodeId: string | null; promotionCode: string }> {
  const couponId = await ensureReferralCoupon();
  let promotionCodeId: string | null = null;
    
    // Verify the coupon exists
    try {
      const coupon = await stripe.coupons.retrieve(couponId);
      if (!coupon) {
        console.log('Coupon not found, skipping Stripe promotion code creation');
        return { promotionCodeId: null, promotionCode: promoCode };
      }
    } catch (error) {
      console.log('Error verifying coupon, skipping Stripe promotion code creation:', error);
      return { promotionCodeId: null, promotionCode: promoCode };
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
      console.log('Error checking for existing promotion code:', error);
    }
    
    // Retry logic for creating promotion code
    const maxRetries = 5;
    let lastError: any = null;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        // Try to create new promotion code in Stripe
        const promotionCodeResult = await stripe.promotionCodes.create({
    coupon: couponId,
    code: promoCode,
    metadata: {
      userId,
      type: 'referral_code'
    }
  } as any);

        promotionCodeId = promotionCodeResult.id;
        console.log(`Successfully created Stripe promotion code on attempt ${attempt}:`, promotionCodeId);
        break; // Success - exit retry loop
      } catch (stripeError: any) {
        lastError = stripeError;
        
        // If it's a duplicate code error, try to find the existing one
        if (stripeError.code === 'resource_already_exists' || stripeError.message?.includes('already exists')) {
          try {
            const existingCodes = await stripe.promotionCodes.list({
              code: promoCode,
              limit: 1
            });
            
            if (existingCodes.data.length > 0) {
              const existingCode = existingCodes.data[0];
              promotionCodeId = existingCode.id;
              console.log('Found existing promotion code:', existingCode.id);
              break; // Found existing - exit retry loop
            }
          } catch (listError) {
            console.warn('Error listing existing promotion codes:', listError);
          }
        }
        
        // Determine if we should retry
        const shouldRetry = 
          stripeError.code === 'rate_limit' || // Rate limit - retry
          (stripeError.statusCode && stripeError.statusCode >= 500); // Server error - retry
        
        // If it's a parameter_unknown error, it's likely an API version issue that won't be fixed by retrying
        // In this case, we'll return the promo code string which can still be used manually
        if (stripeError.code === 'parameter_unknown' && stripeError.param === 'coupon') {
          console.warn(`Stripe API version issue: parameter 'coupon' not recognized. Promo code string will be used directly: ${promoCode}`);
          promotionCodeId = null; // Will return null but promo code string will still work
          break; // Exit retry loop - this won't be fixed by retrying
        }
        
        if (!shouldRetry) {
          // Non-retryable error - log and return promo code string
          console.warn(`Non-retryable error creating Stripe promotion code: ${stripeError.message}. Promo code string will be used: ${promoCode}`);
          promotionCodeId = null;
          break; // Exit retry loop
        }
        
        // If not the last attempt, wait before retrying (exponential backoff)
        if (attempt < maxRetries) {
          const delayMs = Math.min(1000 * Math.pow(2, attempt - 1), 10000); // Max 10 seconds
          console.warn(`Attempt ${attempt}/${maxRetries} failed (${stripeError.message}), retrying in ${delayMs}ms...`);
          await sleep(delayMs);
        } else {
          // After all retries, return promo code string (can still be used manually)
          console.warn(`Failed to create Stripe promotion code after ${maxRetries} attempts. Promo code string will be used: ${promoCode}`);
          promotionCodeId = null;
        }
      }
    }
  
  // Return the promotion code
  // Note: promotionCodeId may be null if Stripe creation failed, but promoCode string can still be used manually in checkout
  return {
    promotionCodeId,
    promotionCode: promoCode
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