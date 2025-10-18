// CV Analysis Service using OpenAI
import { strapi } from '@strapi/strapi';

// Types for CV analysis results
export interface CVAnalysisResult {
  skills: string[];
  experienceLevel: 'intern' | 'junior' | 'mid' | 'senior' | 'unknown';
  industries: string[];
  extractedAt: string;
  confidence?: number;
  rawResponse?: string;
}

// Configuration
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const OPENAI_MODEL = process.env.OPENAI_MODEL || 'gpt-4o-mini';
const CV_ANALYSIS_ENABLED = process.env.CV_ANALYSIS_ENABLED !== 'false';
const CV_ANALYSIS_TIMEOUT = parseInt(process.env.CV_ANALYSIS_TIMEOUT || '30000');

// Main analysis function
export async function analyzeCV(cvText: string): Promise<CVAnalysisResult | null> {
  if (!CV_ANALYSIS_ENABLED || !OPENAI_API_KEY || !cvText?.trim()) {
    strapi.log.debug('[cvAnalysis] Skipping analysis - disabled, no key, or no text');
    return null;
  }

  const startTime = Date.now();
  
  try {
    strapi.log.info(`[cvAnalysis] Starting analysis for CV (${cvText.length} chars)`);
    
    // Create structured prompt for consistent extraction
    const prompt = createAnalysisPrompt(cvText);
    
    // Call OpenAI API with timeout
    const response = await Promise.race([
      callOpenAI(prompt),
      new Promise<never>((_, reject) => 
        setTimeout(() => reject(new Error('Analysis timeout')), CV_ANALYSIS_TIMEOUT)
      )
    ]);

    // Parse and validate response
    const result = parseAnalysisResponse(response);
    
    const duration = Date.now() - startTime;
    strapi.log.info(`[cvAnalysis] Analysis completed in ${duration}ms`, {
      skillsCount: result.skills.length,
      experienceLevel: result.experienceLevel,
      industriesCount: result.industries.length,
      confidence: result.confidence
    });

    return result;
    
  } catch (error: any) {
    const duration = Date.now() - startTime;
    strapi.log.warn(`[cvAnalysis] Analysis failed after ${duration}ms:`, error.message);
    return null;
  }
}

// Create optimized prompt for CV analysis
function createAnalysisPrompt(cvText: string): string {
  return `Analyze this CV and extract structured information. Return ONLY a JSON object with this exact structure:

{
  "skills": ["skill1", "skill2", "skill3"],
  "experienceLevel": "intern|junior|mid|senior|unknown",
  "industries": ["industry1", "industry2"],
  "confidence": 0.85
}

Rules:
- Extract 5-15 most relevant technical and soft skills
- Determine experience level: intern (0-1 years), junior (1-3 years), mid (3-7 years), senior (7+ years), unknown if unclear
- Extract 2-5 industry domains the person has worked in
- Set confidence 0.0-1.0 based on how clear the CV is
- Use standard skill/industry names (e.g., "JavaScript", "Python", "Project Management", "Healthcare", "Finance")

CV Text:
${cvText.slice(0, 4000)}`; // Limit to ~4k chars to stay under token limits
}

// Call OpenAI API
async function callOpenAI(prompt: string): Promise<string> {
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${OPENAI_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: OPENAI_MODEL,
      temperature: 0,
      max_tokens: 512,
      messages: [
        { 
          role: 'system', 
          content: 'You are a CV analysis expert. Extract structured information from CVs and return only valid JSON.' 
        },
        { role: 'user', content: prompt }
      ]
    })
  });

  if (!response.ok) {
    throw new Error(`OpenAI API error: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content?.trim() || '';
}

// Parse and validate OpenAI response
function parseAnalysisResponse(response: string): CVAnalysisResult {
  try {
    // Extract JSON from response (handle cases where LLM adds extra text)
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    const jsonStr = jsonMatch ? jsonMatch[0] : response;
    
    const parsed = JSON.parse(jsonStr);
    
    // Validate and normalize the response
    const result: CVAnalysisResult = {
      skills: Array.isArray(parsed.skills) 
        ? parsed.skills.map((s: any) => String(s).trim()).filter(Boolean).slice(0, 15)
        : [],
      experienceLevel: ['intern', 'junior', 'mid', 'senior', 'unknown'].includes(parsed.experienceLevel)
        ? parsed.experienceLevel
        : 'unknown',
      industries: Array.isArray(parsed.industries)
        ? parsed.industries.map((i: any) => String(i).trim()).filter(Boolean).slice(0, 5)
        : [],
      extractedAt: new Date().toISOString(),
      confidence: typeof parsed.confidence === 'number' 
        ? Math.max(0, Math.min(1, parsed.confidence)) 
        : 0.5,
      rawResponse: response
    };

    // Ensure we have meaningful results
    if (result.skills.length === 0 && result.experienceLevel === 'unknown' && result.industries.length === 0) {
      throw new Error('No meaningful data extracted');
    }

    return result;
    
  } catch (error: any) {
    strapi.log.warn('[cvAnalysis] Failed to parse OpenAI response:', error.message);
    throw new Error(`Invalid response format: ${error.message}`);
  }
}

// Helper function to get analysis for a user
export async function getUserCVAnalysis(userId: number): Promise<CVAnalysisResult | null> {
  try {
    const user = await strapi.entityService.findOne('plugin::users-permissions.user', userId, {
      fields: ['id', 'cvAnalysis']
    });
    
    return user?.cvAnalysis || null;
  } catch (error: any) {
    strapi.log.warn('[cvAnalysis] Failed to get user CV analysis:', error.message);
    return null;
  }
}

// Helper function to save analysis for a user
export async function saveUserCVAnalysis(userId: number, analysis: CVAnalysisResult): Promise<boolean> {
  try {
    await strapi.entityService.update('plugin::users-permissions.user', userId, {
      data: { cvAnalysis: analysis }
    });
    return true;
  } catch (error: any) {
    strapi.log.warn('[cvAnalysis] Failed to save user CV analysis:', error.message);
    return false;
  }
}
