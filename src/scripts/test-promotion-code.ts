// Test script to create a Stripe promotion code
// Run with: tsx src/scripts/test-promotion-code.ts

import Stripe from 'stripe';
import dotenv from 'dotenv';

dotenv.config();

const stripeSecretKey = process.env.STRIPE_SECRET_KEY;

if (!stripeSecretKey) {
  console.error('STRIPE_SECRET_KEY environment variable is not set');
  process.exit(1);
}

const stripe = new Stripe(stripeSecretKey, {
  apiVersion: '2024-11-20.acacia',
});

async function testPromotionCodeCreation() {
  try {
    console.log('Testing Stripe promotion code creation...\n');
    
    // Step 1: Check if coupon exists
    console.log('Step 1: Checking if coupon 30_OFF_REFERRAL exists...');
    let coupon;
    try {
      coupon = await stripe.coupons.retrieve('30_OFF_REFERRAL');
      console.log('✓ Coupon found:', {
        id: coupon.id,
        name: coupon.name,
        percent_off: coupon.percent_off,
        active: coupon.active
      });
    } catch (error: any) {
      if (error.code === 'resource_missing') {
        console.log('✗ Coupon not found. Creating it...');
        coupon = await stripe.coupons.create({
          id: '30_OFF_REFERRAL',
          name: '30% Off Referral Discount',
          percent_off: 30,
          duration: 'once',
          metadata: {
            type: 'referral_discount',
            description: '30% off any package for referred users'
          }
        });
        console.log('✓ Coupon created:', coupon.id);
      } else {
        throw error;
      }
    }
    
    // Step 2: Try creating a promotion code
    console.log('\nStep 2: Creating test promotion code...');
    const testCode = `TEST-${Date.now()}`;
    
    try {
      const promotionCode = await stripe.promotionCodes.create({
        coupon: coupon.id,
        code: testCode,
        metadata: {
          test: 'true',
          type: 'referral_code'
        }
      });
      
      console.log('✓ Promotion code created successfully!', {
        id: promotionCode.id,
        code: promotionCode.code,
        active: promotionCode.active,
        coupon: promotionCode.coupon
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

