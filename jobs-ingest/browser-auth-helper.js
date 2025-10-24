const fetch = require('node-fetch');

const STRAPI_URL = 'https://api.effort-free.co.uk';

console.log('🔍 Browser Authentication Helper');
console.log('This script will help you extract the working authentication from your browser.');
console.log('\n📋 Instructions:');
console.log('1. Open your browser and go to: https://api.effort-free.co.uk/admin');
console.log('2. Log in to your Strapi admin panel');
console.log('3. Go to Content Manager → Job');
console.log('4. Open Developer Tools (F12)');
console.log('5. Go to Network tab');
console.log('6. Refresh the page');
console.log('7. Look for a request to: /content-manager/collection-types/api::job.job');
console.log('8. Click on that request');
console.log('9. Look at the Request Headers section');
console.log('10. Copy the "authorization" header value');
console.log('11. Copy the "cookie" header value');
console.log('\n🔍 What to look for:');
console.log('- authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...');
console.log('- cookie: jwtToken=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...');
console.log('\n📝 Once you have these values, update the script below:');

// Example of how to use the extracted values
async function testWithBrowserAuth() {
  // Replace these with the values you extracted from your browser
  const authorizationHeader = 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...'; // Replace with actual value
  const cookieHeader = 'jwtToken=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...'; // Replace with actual value
  
  console.log('\n🧪 Testing with browser authentication...');
  
  try {
    const response = await fetch(`${STRAPI_URL}/content-manager/collection-types/api::job.job?pagination[page]=1&pagination[pageSize]=1`, {
      headers: {
        'Authorization': authorizationHeader,
        'Cookie': cookieHeader,
        'Content-Type': 'application/json'
      }
    });
    
    console.log(`📊 Response: ${response.status} ${response.statusText}`);
    
    if (response.ok) {
      const data = await response.json();
      console.log(`✅ SUCCESS! Found ${data.data?.length || 0} jobs`);
      console.log(`📊 Total: ${data.meta?.pagination?.total || 'unknown'}`);
      return true;
    } else {
      const errorText = await response.text();
      console.log(`❌ Failed: ${errorText}`);
      return false;
    }
  } catch (error) {
    console.log(`❌ Error: ${error.message}`);
    return false;
  }
}

// Uncomment and run this after you've extracted the values from your browser
// testWithBrowserAuth();

console.log('\n🔧 After extracting the values, uncomment the testWithBrowserAuth() call at the bottom of this file and run it again.');
