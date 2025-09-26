// Simple test to verify the jobs-ingest setup works
console.log('🧪 Testing jobs-ingest setup...');

try {
  // Test imports
  const bottleneck = require('bottleneck');
  const cheerio = require('cheerio');
  const dotenv = require('dotenv');
  const undici = require('undici');
  const zod = require('zod');
  
  console.log('✅ All dependencies imported successfully');
  console.log('📦 Bottleneck version:', bottleneck.version || 'loaded');
  console.log('📦 Cheerio version:', cheerio.version || 'loaded');
  console.log('📦 Undici version:', undici.version || 'loaded');
  
  // Test basic functionality
  const limiter = new bottleneck({
    maxConcurrent: 1,
    minTime: 100
  });
  
  console.log('✅ Bottleneck limiter created');
  console.log('✅ Jobs-ingest setup test passed!');
  
} catch (error) {
  console.error('❌ Jobs-ingest setup test failed:', error.message);
  process.exit(1);
}
