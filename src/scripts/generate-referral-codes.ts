// src/scripts/generate-referral-codes.ts
// Run this script to generate referral codes for existing users who don't have them

import { createUserPromotionCode } from '../utils/stripe';

// Generate a short referral code (base36)
function generateReferralCode(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  for (let i = 0; i < 6; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

// Generate promo code from username or referral code
function generatePromoCode(username: string, referralCode: string): string {
  const base = username.toUpperCase().replace(/[^A-Z0-9]/g, '');
  const suffix = referralCode.toUpperCase();
  return `EF-${base}-${suffix}`;
}

async function generateReferralCodesForExistingUsers() {
  console.log('Starting referral code generation for existing users...');
  
  try {
    // Find all users who don't have referral codes
    const users = await strapi.entityService.findMany('plugin::users-permissions.user', {
      filters: {
        $or: [
          { referralCode: { $null: true } },
          { promoCode: { $null: true } },
          { promoCodeId: { $null: true } }
        ]
      },
      fields: ['id', 'username', 'referralCode', 'promoCode', 'promoCodeId'],
      limit: -1 // Get all users
    });

    console.log(`Found ${users.length} users without referral codes`);

    for (const user of users) {
      try {
        console.log(`Processing user ${user.id} (${user.username})...`);

        // Generate referral code
        let referralCode = generateReferralCode();
        
        // Ensure uniqueness
        let attempts = 0;
        while (attempts < 10) {
          const existing = await strapi.entityService.findMany('plugin::users-permissions.user', {
            filters: { referralCode },
            limit: 1
          });
          
          if (existing.length === 0) break;
          
          referralCode = generateReferralCode();
          attempts++;
        }
        
        if (attempts >= 10) {
          console.error(`Failed to generate unique referral code for user ${user.id}`);
          continue;
        }
        
        // Generate promo code
        const promoCode = generatePromoCode(user.username, referralCode);
        
        // Create Stripe promotion code
        const { promotionCodeId, promotionCode: actualPromoCode } = await createUserPromotionCode(
          user.id.toString(),
          promoCode
        );
        
        // Update user with referral data
        await strapi.entityService.update('plugin::users-permissions.user', user.id, {
          data: {
            referralCode,
            promoCode: actualPromoCode,
            promoCodeId: promotionCodeId,
            referralRewards: []
          }
        });
        
        console.log(`✅ Generated referral system for user ${user.id}: ${referralCode} / ${actualPromoCode}`);
        
      } catch (error) {
        console.error(`❌ Error processing user ${user.id}:`, error);
      }
    }

    console.log('✅ Referral code generation completed!');
    
  } catch (error) {
    console.error('❌ Error during referral code generation:', error);
  }
}

// Export for use in Strapi console or as a script
export default generateReferralCodesForExistingUsers;

// If running as a script
if (require.main === module) {
  generateReferralCodesForExistingUsers().then(() => {
    process.exit(0);
  }).catch((error) => {
    console.error('Script failed:', error);
    process.exit(1);
  });
}
