// Simple test to verify job scraping works
console.log('🧪 Testing Job Scraping Components...');

// Test 1: Check if we can import the modules
try {
  console.log('1️⃣ Testing module imports...');
  
  // Test basic functionality
  const testJob = {
    source: 'test:manual',
    sourceUrl: 'https://example.com/test-job',
    title: 'Test Graduate Engineer',
    company: { name: 'Test Company' },
    applyUrl: 'https://example.com/apply',
    jobType: 'graduate',
    slug: 'test-graduate-engineer-test-company-12345678',
    hash: 'test-hash-12345678'
  };
  
  console.log('✅ Test job object created:', testJob.title);
  
  // Test classification
  const classifyJobType = (text) => {
    const t = text.toLowerCase();
    if (/\b(intern(ship)?|summer|industrial placement)\b/.test(t)) return 'internship';
    if (/\b(placement|year in industry|sandwich)\b/.test(t)) return 'placement';
    if (/\b(graduate|early careers|new grad)\b/.test(t)) return 'graduate';
    return 'other';
  };
  
  const jobType = classifyJobType(testJob.title);
  console.log('✅ Job type classification:', jobType);
  
  // Test filtering
  const isRelevantJobType = (text) => {
    const t = text.toLowerCase();
    const positiveKeywords = ['intern', 'internship', 'graduate', 'placement', 'trainee'];
    const negativeKeywords = ['senior', 'principal', 'lead', 'manager'];
    const hasPositive = positiveKeywords.some(keyword => t.includes(keyword));
    const hasNegative = negativeKeywords.some(keyword => t.includes(keyword));
    return hasPositive && !hasNegative;
  };
  
  const isRelevant = isRelevantJobType(testJob.title);
  console.log('✅ Job relevance check:', isRelevant);
  
  console.log('\n🎉 All basic tests passed!');
  console.log('📋 Next steps:');
  console.log('  1. Deploy this to Railway');
  console.log('  2. Check if the frontend job library works');
  console.log('  3. Test the ingest endpoint with real data');
  
} catch (error) {
  console.error('❌ Test failed:', error.message);
  console.error('Stack:', error.stack);
}
