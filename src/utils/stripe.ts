// src/utils/stripe.ts
import Stripe from 'stripe';

// Validate Stripe secret key
const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
if (!stripeSecretKey) {
  console.error('STRIPE_SECRET_KEY environment variable is not set');
  throw new Error('STRIPE_SECRET_KEY environment variable is required');
}

// Use the API version required by TypeScript types
// Note: For HTTP API calls, we don't specify the version header to let Stripe use the default
const stripe = new Stripe(stripeSecretKey, {
  apiVersion: '2025-09-30.clover', // Required by TypeScript types
});

export { stripe };

// Ensure the referral coupon exists (using the actual coupon ID from Stripe)
export async function ensureReferralCoupon(): Promise<string> {
  const couponId = 'zcSkjKMc'; // The actual coupon ID from Stripe Dashboard
  
  try {
    // Retrieve the coupon to verify it exists
    const coupon = await stripe.coupons.retrieve(couponId);
    console.log(`✓ Found referral coupon: ${coupon.id} (name: ${coupon.name || 'N/A'}, percent_off: ${coupon.percent_off}%)`);
    return coupon.id;
  } catch (error) {
    console.error(`Error retrieving coupon ${couponId}:`, error);
    throw new Error(`Coupon "${couponId}" not found in Stripe. Please verify it exists in Stripe Dashboard.`);
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
  console.log(`[createUserPromotionCode] Starting for user ${userId} with promo code "${promoCode}"`);
  
  let couponId: string;
  try {
    couponId = await ensureReferralCoupon();
    console.log(`[createUserPromotionCode] Coupon ID retrieved: ${couponId}`);
  } catch (error: any) {
    console.error(`[createUserPromotionCode] Failed to get coupon:`, error.message);
    return { promotionCodeId: null, promotionCode: promoCode };
  }
  
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
    // Try HTTP API first as it's more reliable than the SDK for this use case
    const maxRetries = 5;
    let lastError: any = null;
    
    // First, try HTTP API directly (more reliable for promotion codes)
    console.log(`[createUserPromotionCode] Attempting to create promotion code using HTTP API...`);
    try {
      const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
      if (!stripeSecretKey) {
        throw new Error('STRIPE_SECRET_KEY not found in environment variables');
      }
      
      // Verify coupon exists first
      const coupon = await stripe.coupons.retrieve(couponId);
      console.log(`[createUserPromotionCode] Coupon verified before HTTP API call:`, {
        id: coupon.id,
        name: coupon.name,
        percent_off: coupon.percent_off
      });
      
      // Use fetch to call Stripe API directly
      // Use the exact format from Stripe's documentation
      const formData = new URLSearchParams();
      formData.append('coupon', couponId);
      formData.append('code', promoCode);
      formData.append('metadata[userId]', userId);
      formData.append('metadata[type]', 'referral_code');
      
      console.log(`[createUserPromotionCode] Sending HTTP request with body:`, formData.toString());
      
      const response = await fetch('https://api.stripe.com/v1/promotion_codes', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${stripeSecretKey}`,
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: formData
      });
      
      const responseData: any = await response.json();
      
      if (!response.ok) {
        console.error(`[createUserPromotionCode] HTTP API error response:`, {
          status: response.status,
          statusText: response.statusText,
          error: responseData
        });
        
        // If it's a duplicate code error, try to find the existing one
        if (responseData.error?.code === 'resource_already_exists' || responseData.error?.message?.includes('already exists')) {
          console.log(`[createUserPromotionCode] Promotion code "${promoCode}" already exists, looking it up...`);
          try {
            const existingCodes = await stripe.promotionCodes.list({
              code: promoCode,
              limit: 1
            });
            
            if (existingCodes.data.length > 0) {
              const existingCode = existingCodes.data[0];
              promotionCodeId = existingCode.id;
              console.log(`✓ Found existing promotion code: ${existingCode.id} (active: ${existingCode.active})`);
              return { promotionCodeId, promotionCode: existingCode.code };
            }
          } catch (listError: any) {
            console.warn(`[createUserPromotionCode] Error listing existing promotion codes:`, listError.message);
          }
        }
        
        // If it's a parameter_unknown error for coupon, try verifying the coupon exists and is valid
        if (responseData.error?.code === 'parameter_unknown' && responseData.error?.param === 'coupon') {
          console.warn(`[createUserPromotionCode] Stripe rejected 'coupon' parameter. Verifying coupon exists...`);
          try {
            const coupon = await stripe.coupons.retrieve(couponId);
            console.log(`[createUserPromotionCode] Coupon verified:`, {
              id: coupon.id,
              name: coupon.name,
              percent_off: coupon.percent_off,
              valid: true
            });
            
            // Try using the coupon object ID directly
            console.log(`[createUserPromotionCode] Retrying with coupon ID: ${coupon.id}`);
            // This will fall through to the SDK fallback below
          } catch (couponError: any) {
            console.error(`[createUserPromotionCode] Error verifying coupon:`, couponError.message);
            throw new Error(`Coupon ${couponId} not found or invalid: ${couponError.message}`);
          }
        }
        
        throw new Error(`HTTP ${response.status}: ${JSON.stringify(responseData)}`);
      }
      
      promotionCodeId = responseData.id as string;
      console.log(`✓ Successfully created promotion code using HTTP API: ${promotionCodeId}`);
      
      // Verify the promotion code actually exists and is active
      try {
        const verified = await stripe.promotionCodes.retrieve(promotionCodeId);
        if (!verified.active) {
          console.warn(`⚠ Warning: Promotion code ${promotionCodeId} was created but is not active`);
        }
        console.log(`✓ Verified promotion code exists: ${verified.code} (ID: ${promotionCodeId}, Active: ${verified.active})`);
      } catch (verifyError: any) {
        console.error(`❌ Error verifying promotion code after creation:`, verifyError.message);
      }
      
      return { promotionCodeId, promotionCode: responseData.code || promoCode };
    } catch (httpError: any) {
      console.warn(`[createUserPromotionCode] HTTP API method failed: ${httpError.message}`);
      console.log(`[createUserPromotionCode] Falling back to Stripe SDK...`);
      lastError = httpError;
    }
    
    // Fallback to Stripe SDK if HTTP API failed
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`[Attempt ${attempt}/${maxRetries}] Creating promotion code "${promoCode}" for coupon "${couponId}" using SDK...`);
        
        // Retrieve the coupon to ensure it exists
        const coupon = await stripe.coupons.retrieve(couponId);
        console.log(`✓ Coupon verified: ${coupon.id} (percent_off: ${coupon.percent_off}%)`);
        
        // Try creating promotion code using the Stripe SDK
        const createParams = {
          coupon: couponId,
          code: promoCode,
          metadata: {
            userId: userId,
            type: 'referral_code'
          }
        };
        
        console.log(`Creating promotion code with params:`, JSON.stringify(createParams, null, 2));
        
        const promotionCodeResult = await stripe.promotionCodes.create(createParams as any);
        
        promotionCodeId = promotionCodeResult.id;
        console.log(`✓ Successfully created Stripe promotion code on attempt ${attempt}:`, {
          id: promotionCodeId,
          code: promotionCodeResult.code,
          active: promotionCodeResult.active
        });
        
        // Verify the promotion code actually exists and is active
        try {
          const verified = await stripe.promotionCodes.retrieve(promotionCodeId);
          if (!verified.active) {
            console.warn(`⚠ Warning: Promotion code ${promotionCodeId} was created but is not active`);
          }
          console.log(`✓ Verified promotion code exists: ${verified.code} (ID: ${promotionCodeId}, Active: ${verified.active})`);
        } catch (verifyError: any) {
          console.error(`❌ Error verifying promotion code after creation:`, verifyError.message);
        }
        
        break; // Success - exit retry loop
      } catch (stripeError: any) {
        lastError = stripeError;
        
        // Log the full error details for debugging
        console.error(`❌ [Attempt ${attempt}/${maxRetries}] Error creating promotion code:`, {
          message: stripeError.message,
          code: stripeError.code,
          type: stripeError.type,
          param: stripeError.param,
          statusCode: stripeError.statusCode,
          requestId: stripeError.requestId
        });
        
        // If it's a duplicate code error, try to find the existing one
        if (stripeError.code === 'resource_already_exists' || stripeError.message?.includes('already exists')) {
          console.log(`Promotion code "${promoCode}" already exists, looking it up...`);
          try {
            const existingCodes = await stripe.promotionCodes.list({
              code: promoCode,
              limit: 1
            });
            
            if (existingCodes.data.length > 0) {
              const existingCode = existingCodes.data[0];
              promotionCodeId = existingCode.id;
              console.log(`✓ Found existing promotion code: ${existingCode.id} (active: ${existingCode.active})`);
              break; // Found existing - exit retry loop
            }
          } catch (listError: any) {
            console.warn(`Error listing existing promotion codes:`, listError.message);
          }
        }
        
        // Determine if we should retry
        const shouldRetry = 
          stripeError.code === 'rate_limit' || // Rate limit - retry
          (stripeError.statusCode && stripeError.statusCode >= 500); // Server error - retry
        
        if (!shouldRetry) {
          // Non-retryable error - log and return promo code string
          console.error(`❌ Non-retryable error creating Stripe promotion code: ${stripeError.message}`);
          console.error(`   Error code: ${stripeError.code}, Param: ${stripeError.param}`);
          console.error(`   Promo code string "${promoCode}" will be stored but won't work in Stripe checkout.`);
          promotionCodeId = null;
          break; // Exit retry loop
        }
        
        // If not the last attempt, wait before retrying (exponential backoff)
        if (attempt < maxRetries) {
          const delayMs = Math.min(1000 * Math.pow(2, attempt - 1), 10000); // Max 10 seconds
          console.warn(`⏳ Attempt ${attempt}/${maxRetries} failed, retrying in ${delayMs}ms...`);
          await sleep(delayMs);
        } else {
          // After all retries, return promo code string (can still be used manually)
          console.error(`❌ Failed to create Stripe promotion code after ${maxRetries} attempts.`);
          console.error(`   Last error: ${lastError?.message || 'Unknown error'}`);
          console.error(`   Promo code string "${promoCode}" will be stored but won't work in Stripe checkout.`);
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