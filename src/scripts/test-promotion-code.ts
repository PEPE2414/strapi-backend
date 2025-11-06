// Test script to create a Stripe promotion code
// Run with: npm run test:promo-code
// 
// NOTE: For local testing, you need to set STRIPE_SECRET_KEY in your .env file
// or as an environment variable:
//   export STRIPE_SECRET_KEY=sk_test_... (Linux/Mac)
//   set STRIPE_SECRET_KEY=sk_test_... (Windows)

import Stripe from 'stripe';
import dotenv from 'dotenv';
import path from 'path';

// Try to load .env file from project root
dotenv.config({ path: path.join(__dirname, '../../.env') });

const stripeSecretKey = process.env.STRIPE_SECRET_KEY;

if (!stripeSecretKey) {
  console.error('❌ STRIPE_SECRET_KEY environment variable is not set');
  console.error('\nTo run this test locally, you need to:');
  console.error('1. Create a .env file in the strapi-backend directory');
  console.error('2. Add: STRIPE_SECRET_KEY=sk_test_YOUR_KEY (or sk_live_YOUR_KEY)');
  console.error('\nOr set it as an environment variable before running:');
  console.error('  export STRIPE_SECRET_KEY=sk_test_YOUR_KEY (Linux/Mac)');
  console.error('  set STRIPE_SECRET_KEY=sk_test_YOUR_KEY (Windows)');
  console.error('\nFor Railway deployment, the environment variable should be set in Railway dashboard.');
  process.exit(1);
}

const stripe = new Stripe(stripeSecretKey, {
  apiVersion: '2025-09-30.clover', // Required by TypeScript types
});

async function testPromotionCodeCreation() {
  try {
    console.log('Testing Stripe promotion code creation...\n');
    
    // Step 1: Check if coupon exists
    console.log('Step 1: Checking if coupon zcSkjKMc exists...');
    const couponId = 'zcSkjKMc'; // The actual coupon ID from Stripe Dashboard
    let coupon;
    try {
      // Retrieve the coupon by ID
      coupon = await stripe.coupons.retrieve(couponId);
      console.log('✓ Coupon found:', {
        id: coupon.id,
        name: coupon.name || 'N/A',
        percent_off: coupon.percent_off,
        active: coupon.active
      });
    } catch (error: any) {
      console.error('✗ Coupon not found:', error.message);
      throw new Error(`Coupon "${couponId}" not found in Stripe. Please verify it exists in Stripe Dashboard.`);
    }
    
    // Step 2: Try creating a promotion code using HTTP API first
    console.log('\nStep 2: Creating test promotion code using HTTP API...');
    const testCode = `TEST-${Date.now()}`;
    
    try {
      // First try HTTP API (more reliable)
      console.log('Attempting HTTP API method...');
      const formData = new URLSearchParams();
      formData.append('coupon', coupon.id);
      formData.append('code', testCode);
      formData.append('metadata[test]', 'true');
      
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
        console.error('HTTP API failed:', responseData);
        throw new Error(`HTTP ${response.status}: ${JSON.stringify(responseData)}`);
      }
      
      console.log('✓ Promotion code created via HTTP API!', {
        id: responseData.id,
        code: responseData.code,
        active: responseData.active,
        coupon: responseData.coupon?.id || 'N/A'
      });
      
      const promotionCodeId = responseData.id;
      
      // Step 3: Verify it can be retrieved
      console.log('\nStep 3: Verifying promotion code can be retrieved...');
      const retrieved = await stripe.promotionCodes.retrieve(promotionCodeId);
      console.log('✓ Promotion code retrieved:', retrieved.code);
      
      // Step 4: List by code
      console.log('\nStep 4: Testing list by code...');
      const listed = await stripe.promotionCodes.list({
        code: testCode,
        limit: 1
      });
      console.log('✓ Found promotion code via list:', listed.data[0]?.code);
      
      console.log('\n✅ All tests passed! Promotion code creation is working.');
      console.log(`\nTest code: ${testCode}`);
      console.log('You can use this code in Stripe checkout to test.');
      console.log(`\nPromotion code ID: ${promotionCodeId}`);
      console.log('Check Stripe Dashboard → Products → Promotion codes to see it.');
      
    } catch (error: any) {
      console.error('\n✗ Error creating promotion code:', {
        type: error.type,
        code: error.code,
        message: error.message,
        param: error.param,
        statusCode: error.statusCode
      });
      
      if (error.raw) {
        console.error('Raw error:', JSON.stringify(error.raw, null, 2));
      }
      
      console.error('\n⚠️  If HTTP API fails, promotion codes cannot be created programmatically.');
      console.error('Please check:');
      console.error('1. The coupon ID is correct');
      console.error('2. The coupon is active');
      console.error('3. Your Stripe API key has the correct permissions');
      console.error('4. Try creating a promotion code manually in Stripe Dashboard first');
      
      process.exit(1);
    }
    
  } catch (error: any) {
    console.error('Fatal error:', error);
    process.exit(1);
  }
}

testPromotionCodeCreation();

