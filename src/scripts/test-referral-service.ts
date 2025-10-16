// src/scripts/test-referral-service.ts
// Test script to check if the referral service is working

async function testReferralService() {
  console.log('Testing referral service...');
  
  try {
    // Test if the service is accessible
    const service = strapi.service('api::referrals.referrals');
    console.log('✅ Service found:', !!service);
    
    if (service) {
      console.log('Service methods:', Object.keys(service));
      
      // Test getReferralSummary method
      if (typeof service.getReferralSummary === 'function') {
        console.log('✅ getReferralSummary method exists');
      } else {
        console.log('❌ getReferralSummary method not found');
      }
    }
    
  } catch (error) {
    console.error('❌ Error testing service:', error);
  }
}

export default testReferralService;

// If running as a script
if (require.main === module) {
  testReferralService().then(() => {
    process.exit(0);
  }).catch((error) => {
    console.error('Script failed:', error);
    process.exit(1);
  });
}
