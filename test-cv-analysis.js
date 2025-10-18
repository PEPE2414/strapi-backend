// Test script for CV analysis service
// Run with: node test-cv-analysis.js

const sampleCVText = `
John Smith
Software Engineer
john.smith@email.com | +44 123 456 7890

EXPERIENCE
Senior Software Engineer | TechCorp | 2021-Present
- Developed and maintained web applications using React, Node.js, and PostgreSQL
- Led a team of 3 junior developers
- Implemented CI/CD pipelines using Docker and AWS
- Skills: JavaScript, TypeScript, Python, SQL, Docker, AWS

Software Engineer | StartupXYZ | 2019-2021
- Built REST APIs using Node.js and Express
- Worked with MongoDB and Redis for data storage
- Collaborated with frontend team on React applications
- Skills: Node.js, MongoDB, React, Git

EDUCATION
BSc Computer Science | University of London | 2015-2019
- First Class Honours
- Relevant modules: Software Engineering, Databases, Algorithms

SKILLS
Programming: JavaScript, TypeScript, Python, Java, SQL
Frameworks: React, Node.js, Express, Django
Tools: Git, Docker, AWS, Jenkins
Databases: PostgreSQL, MongoDB, Redis
`;

async function testCVAnalysis() {
  try {
    // Import the service
    const { analyzeCV } = await import('./dist/services/cvAnalysisService.js');
    
    console.log('Testing CV analysis service...');
    console.log('Sample CV length:', sampleCVText.length, 'characters');
    
    // Test the analysis
    const result = await analyzeCV(sampleCVText);
    
    if (result) {
      console.log('\n✅ Analysis successful!');
      console.log('Skills:', result.skills);
      console.log('Experience Level:', result.experienceLevel);
      console.log('Industries:', result.industries);
      console.log('Confidence:', result.confidence);
      console.log('Extracted At:', result.extractedAt);
    } else {
      console.log('\n❌ Analysis failed or was skipped');
    }
    
  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    console.log('\nNote: Make sure to:');
    console.log('1. Set OPENAI_API_KEY environment variable');
    console.log('2. Run "npm run build" to compile TypeScript');
    console.log('3. Ensure you have internet connectivity');
  }
}

// Run the test
testCVAnalysis();
