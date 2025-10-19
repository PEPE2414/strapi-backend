# N8N LinkedIn Optimiser Webhook Setup

This document explains how to set up the n8n webhook for LinkedIn profile optimization and how to upload results back to Strapi.

## Environment Variables

Add these to your Strapi backend `.env` file:

```env
# N8N Webhook URLs
N8N_LINKEDIN_WEBHOOK_URL=https://your-n8n-instance.com/webhook/linkedin-optimisation
CL_WEBHOOK_SECRET=your-secret-key-here
```

## Current Flow

1. **Frontend Request**: User submits LinkedIn profile data via `/api/linkedin-optimisations/generate`
2. **Backend Processing**: Strapi forwards request to n8n webhook with user data
3. **N8N Processing**: n8n analyzes the LinkedIn profile and generates optimization suggestions
4. **Result Upload**: n8n uploads results back to Strapi via `/api/webhooks/linkedin-results`

## Expected Webhook Payload (Strapi → N8N)

The Strapi backend will send this payload to your n8n webhook:

```json
{
  "userId": "user-id",
  "userEmail": "user@example.com",
  "profileData": {
    "user": {
      "id": "user-id",
      "email": "user@example.com"
    },
    "images": [
      {
        "base64": "data:image/jpeg;base64,..."
      }
    ],
    "text": {
      "wholeProfile": "LinkedIn profile text content...",
      "optionalText": "Additional context..."
    },
    "consent": {
      "createPost": false
    }
  },
  "context": {
    "targetRole": "Software Engineer",
    "location": "London",
    "jobType": "Graduate"
  }
}
```

## Required Response Format (N8N → Strapi)

Your n8n webhook should return this response format:

```json
{
  "overallScore": 85,
  "subscores": {
    "headline": 8,
    "about": 9,
    "experience": 7,
    "skills": 8,
    "activity": 6
  },
  "headlineVariants": {
    "conservative": "Software Engineer | Full-Stack Developer | React & Node.js",
    "punchy": "🚀 Full-Stack Engineer | Building Scalable Web Apps | React & Node.js Expert",
    "seo": "Software Engineer | Full-Stack Developer | React | Node.js | JavaScript | TypeScript | Web Development"
  },
  "about": {
    "full": "Passionate software engineer with 3+ years of experience building scalable web applications...",
    "lite": "Software engineer passionate about building scalable web apps with React & Node.js."
  },
  "quickWins": [
    "Add a professional headshot",
    "Include 3-5 relevant skills",
    "Write a compelling headline"
  ],
  "experienceBullets": [
    "Developed and maintained 5+ React applications serving 10,000+ users",
    "Implemented CI/CD pipelines reducing deployment time by 60%",
    "Led a team of 3 developers in building a microservices architecture"
  ],
  "skills": [
    "React",
    "Node.js",
    "JavaScript",
    "TypeScript",
    "AWS",
    "Docker",
    "Git"
  ],
  "postDrafts": [
    "Excited to share that I've been working on a new React project...",
    "Just completed a challenging full-stack development task..."
  ],
  "meta": {
    "model": "gpt-4",
    "latencyMs": 2500
  }
}
```

## Result Upload to Strapi

After processing, n8n should upload the complete result to Strapi using this webhook:

**Endpoint**: `POST /api/webhooks/linkedin-results`

**Headers**:
```
Content-Type: application/json
x-cl-secret: your-cl-webhook-secret
```

**Payload**:
```json
{
  "userId": "user-id",
  "userEmail": "user@example.com",
  "result": {
    "overallScore": 85,
    "subscores": { ... },
    "headlineVariants": { ... },
    "about": { ... },
    "quickWins": [ ... ],
    "experienceBullets": [ ... ],
    "skills": [ ... ],
    "postDrafts": [ ... ],
    "meta": { ... },
    "hadImage": true,
    "hadText": true,
    "context": {
      "targetRole": "Software Engineer",
      "location": "London",
      "jobType": "Graduate"
    }
  }
}
```

**Expected Response**:
```json
{
  "success": true,
  "resultId": "linkedin-result-id",
  "message": "LinkedIn result stored successfully"
}
```

## N8N Workflow Example

1. **Webhook Trigger**: Receive LinkedIn optimization request from Strapi
2. **Profile Analysis**: 
   - Process images (if provided)
   - Analyze text content
   - Extract key information
3. **AI Processing**:
   - Send to AI service (OpenAI GPT-4, Claude, etc.)
   - Generate optimization suggestions
   - Create headline variants, about sections, etc.
4. **Result Upload**:
   - POST results to `/api/webhooks/linkedin-results`
   - Include user identification and complete result data
5. **Response**: Return structured result to Strapi

## Security

- Use the `x-cl-secret` header for webhook authentication
- Validate the shared secret before processing
- Consider rate limiting for profile analysis
- Ensure user data is handled securely

## Error Handling

If processing fails, return:

```json
{
  "error": "Processing failed",
  "message": "Unable to analyze LinkedIn profile at this time"
}
```

If result upload fails, log the error and retry if possible. The frontend will handle missing results gracefully.

## Testing

You can test the webhook endpoints using curl:

```bash
# Test result upload
curl -X POST https://your-strapi-backend.com/api/webhooks/linkedin-results \
  -H "Content-Type: application/json" \
  -H "x-cl-secret: your-cl-webhook-secret" \
  -d '{
    "userId": "test-user-id",
    "userEmail": "test@example.com",
    "result": {
      "overallScore": 85,
      "subscores": {"headline": 8, "about": 9},
      "headlineVariants": {
        "conservative": "Test Headline",
        "punchy": "🚀 Test Headline",
        "seo": "Test Headline | Keywords"
      }
    }
  }'
```
