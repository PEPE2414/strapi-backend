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
    console.log('Step 1: Checking if coupon Effort-Free-WithPromo exists...');
    let coupon;
    try {
      // Try to retrieve by ID
      coupon = await stripe.coupons.retrieve('Effort-Free-WithPromo');
      console.log('✓ Coupon found:', {
        id: coupon.id,
        name: coupon.name,
        percent_off: coupon.percent_off,
        active: coupon.active
      });
    } catch (error: any) {
      if (error.code === 'resource_missing') {
        // Try to find it by listing all coupons
        console.log('✗ Coupon not found by ID. Searching in all coupons...');
        const coupons = await stripe.coupons.list({ limit: 100 });
        const foundCoupon = coupons.data.find(c => 
          c.id === 'Effort-Free-WithPromo' || 
          c.name === 'Effort-Free-WithPromo' ||
          c.id.toLowerCase() === 'effort-free-withpromo'
        );
        
        if (foundCoupon) {
          coupon = foundCoupon;
          console.log('✓ Coupon found by search:', {
            id: coupon.id,
            name: coupon.name,
            percent_off: coupon.percent_off,
            active: coupon.active
          });
        } else {
          console.error('✗ Coupon "Effort-Free-WithPromo" not found in Stripe.');
          console.error('Please create it in Stripe Dashboard first:');
          console.error('  1. Go to Products → Coupons');
          console.error('  2. Create a coupon with ID or name: Effort-Free-WithPromo');
          console.error('  3. Set it to 30% off, duration: once');
          throw new Error('Coupon "Effort-Free-WithPromo" not found. Please create it in Stripe Dashboard.');
        }
      } else {
        throw error;
      }
    }
    
    // Step 2: Try creating a promotion code
    console.log('\nStep 2: Creating test promotion code...');
    const testCode = `TEST-${Date.now()}`;
    
    try {
      // Use type assertion to bypass TypeScript errors
      // The 'coupon' parameter is valid in Stripe API but TypeScript types may be outdated
      const promotionCode = await stripe.promotionCodes.create({
        coupon: coupon.id,
        code: testCode,
        metadata: {
          test: 'true',
          type: 'referral_code'
        }
      } as any);
      
      console.log('✓ Promotion code created successfully!', {
        id: promotionCode.id,
        code: promotionCode.code,
        active: promotionCode.active,
        coupon: (promotionCode as any).coupon || 'N/A'
      });
      
      // Step 3: Verify it can be retrieved
      console.log('\nStep 3: Verifying promotion code can be retrieved...');
      const retrieved = await stripe.promotionCodes.retrieve(promotionCode.id);
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
      
      console.error('\nThis error needs to be fixed before promotion codes will work.');
      process.exit(1);
    }
    
  } catch (error: any) {
    console.error('Fatal error:', error);
    process.exit(1);
  }
}

testPromotionCodeCreation();

