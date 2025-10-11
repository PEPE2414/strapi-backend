# n8n Webhook Configuration Guide

This document explains all the n8n webhook environment variables that need to be configured for the EffortFree application.

## Required Environment Variables

Add these to your `.env` file in the Strapi backend:

```env
# ========================================
# n8n Webhook URLs
# ========================================

# Outreach Emails Webhook
# Used by: /api/outreach-emails/find endpoint
# Payload: { userId, company, jobTitle, companyUrl, source, description }
# Expected Response: { emails: [{ role: 'recruiter'|'manager', email, confidence, message }] }
OUTREACH_WEBHOOK_URL=https://your-n8n-instance.app.n8n.cloud/webhook/outreach-emails
OUTREACH_WEBHOOK_URL_ALT=https://your-n8n-instance.app.n8n.cloud/webhook/outreach-emails-backup
OUTREACH_WEBHOOK_SECRET=your-optional-secret-key

# LinkedIn Recruiter Search Webhook
# Used by: /api/linkedin-recruiter/search endpoint
# Payload: { userId, company, roleKeywords, location, limit }
# Expected Response: { profiles: [{ name, title, company, location, linkedinUrl }] }
N8N_LINKEDIN_RECRUITER_WEBHOOK_URL=https://your-n8n-instance.app.n8n.cloud/webhook/linkedin-recruiters

# Interview Questions Generation Webhook
# Used by: /api/interview-sets/generate endpoint
# Payload: { userId, jobTitle, company, jdText, jobId }
# Expected Response: { questions: [{ q, a, category }] }
N8N_INTERVIEW_URL=https://your-n8n-instance.app.n8n.cloud/webhook/interview-questions

# Interview Cheat Sheet Generation Webhook
# Used by: /api/cheat-sheets/generate endpoint
# Payload: { userId, jobTitle, company, jdText, cvText, coverLetterPoints, previousCoverLetters }
# Expected Response: { sections: { news, whatTheyDo, history, products, hiringFocus, cultureValues, competitors, talkingPoints }, sources }
N8N_CHEATSHEET_URL=https://your-n8n-instance.app.n8n.cloud/webhook/cheat-sheet

# Mock Interview Chat Webhook
# Used by: /api/mock-interview/chat endpoint
# Payload: { userId, sessionId, message, jobTitle, company, conversationHistory, timestamp }
# Expected Response: { response: "AI response text", followUpQuestion: "Optional next question" }
N8N_MOCK_INTERVIEW_WEBHOOK=https://your-n8n-instance.app.n8n.cloud/webhook/mock-interview-chat
MOCKINTERVIEW_WEBHOOK=https://your-n8n-instance.app.n8n.cloud/webhook/mock-interview-legacy

# Shared Secret (Optional but Recommended)
# Used to authenticate requests to n8n webhooks
N8N_SHARED_SECRET=your-shared-secret-key-here
N8N_WEBHOOK_SECRET=your-shared-secret-key-here

```

## Webhook Details

### 1. Outreach Emails Webhook

**Endpoint:** `POST /api/outreach-emails/find`  
**Environment Variable:** `OUTREACH_WEBHOOK_URL`

**Request Payload:**
```json
{
  "userId": 123,
  "company": "Arup",
  "jobTitle": "Graduate Structural Engineer",
  "companyUrl": "https://arup.com/careers/job-123",
  "source": "saved-job",
  "description": "Job description text..."
}
```

**Expected Response:**
```json
{
  "emails": [
    {
      "role": "recruiter",
      "email": "recruiter@arup.com",
      "confidence": 0.85,
      "message": "Subject: Quick note re: Graduate Structural Engineer @ Arup\n\nHi {{Name}}..."
    },
    {
      "role": "manager",
      "email": "hiring.manager@arup.com",
      "confidence": 0.70,
      "message": "Subject: Quick note re: Graduate Structural Engineer @ Arup\n\nHi {{Name}}..."
    }
  ]
}
```

### 2. LinkedIn Recruiter Search Webhook

**Endpoint:** `POST /api/linkedin-recruiter/search`  
**Environment Variable:** `N8N_LINKEDIN_RECRUITER_WEBHOOK_URL`

**Request Payload:**
```json
{
  "userId": 123,
  "company": "Arup",
  "roleKeywords": "recruiter, talent, campus, early careers, TA",
  "location": "United Kingdom",
  "limit": 25
}
```

**Expected Response:**
```json
{
  "profiles": [
    {
      "name": "John Doe",
      "title": "Campus Recruiter",
      "company": "Arup",
      "location": "London, UK",
      "linkedinUrl": "https://linkedin.com/in/johndoe"
    }
  ]
}
```

**Note:** n8n should save these profiles to Strapi after finding them.

### 3. Interview Questions Generation Webhook

**Endpoint:** `POST /api/interview-sets/generate`  
**Environment Variable:** `N8N_INTERVIEW_URL`

**Request Payload:**
```json
{
  "userId": 123,
  "jobTitle": "Graduate Structural Engineer",
  "company": "Arup",
  "jdText": "Full job description text...",
  "jobId": 456
}
```

**Expected Response:**
```json
{
  "questions": [
    {
      "q": "Tell me about a time when you worked on a challenging engineering project",
      "a": "Model answer: Use the STAR method...",
      "category": "Technical"
    },
    {
      "q": "Why do you want to work at Arup?",
      "a": "Model answer: Research their recent projects...",
      "category": "Motivation"
    }
  ]
}
```

### 4. Interview Cheat Sheet Generation Webhook

**Endpoint:** `POST /api/cheat-sheets/generate`  
**Environment Variable:** `N8N_CHEATSHEET_URL`

**Request Payload:**
```json
{
  "userId": 123,
  "jobTitle": "Graduate Structural Engineer",
  "company": "Arup",
  "jdText": "Full job description text...",
  "cvText": "Extracted CV text from user's uploaded CV...",
  "coverLetterPoints": [
    "Led a team of 5 in developing a sustainable design...",
    "Improved structural efficiency by 30%..."
  ],
  "previousCoverLetters": [
    "Full text of previous cover letter 1...",
    "Full text of previous cover letter 2..."
  ]
}
```

**Expected Response:**
```json
{
  "sections": {
    "news": [
      "Arup recently won the contract for XYZ project",
      "Company announced new sustainability initiative"
    ],
    "whatTheyDo": "Arup is a global firm of designers, planners, engineers...",
    "history": [
      "Founded in 1946 by Ove Arup",
      "Key milestone: Sydney Opera House design"
    ],
    "products": [
      "Structural Engineering Services",
      "Sustainability Consulting"
    ],
    "hiringFocus": [
      "Looking for graduates with strong technical foundation",
      "Values sustainability and innovation"
    ],
    "cultureValues": [
      "Total design philosophy",
      "Collaborative approach"
    ],
    "competitors": [
      "WSP", "Atkins", "Mott MacDonald"
    ],
    "talkingPoints": [
      "Your experience with [X] aligns with their [Y] project",
      "Connect your sustainability interest to their new initiative"
    ]
  },
  "sources": [
    { "label": "Company Website", "url": "https://arup.com" },
    { "label": "Recent News", "url": "https://news-source.com" }
  ]
}
```

### 5. Mock Interview Chat Webhook

**Endpoint:** `POST /api/mock-interview/chat`  
**Environment Variable:** `N8N_MOCK_INTERVIEW_WEBHOOK`

**Request Payload:**
```json
{
  "userId": 123,
  "sessionId": "abc-123-def",
  "message": "I managed a team project where we had to redesign a bridge structure under tight deadlines",
  "jobTitle": "Graduate Structural Engineer",
  "company": "Arup",
  "conversationHistory": [
    {
      "role": "assistant",
      "content": "Tell me about a time when you demonstrated leadership",
      "timestamp": "2025-10-11T10:00:00Z"
    },
    {
      "role": "user",
      "content": "I managed a team project...",
      "timestamp": "2025-10-11T10:01:00Z"
    }
  ],
  "timestamp": "2025-10-11T10:01:00Z"
}
```

**Expected Response:**
```json
{
  "response": "That's a great example of leadership under pressure. Can you tell me more about how you managed the tight deadlines? What specific strategies did you use to ensure the team stayed on track?",
  "followUpQuestion": "How did you handle any conflicts or challenges within the team during this project?"
}
```

**Note:** The conversation flows bidirectionally - user sends message, n8n returns AI response, user sends next message based on response, etc.

## Testing Your Webhooks

### 1. Test with cURL

```bash
# Test Outreach Emails
curl -X POST https://your-n8n-instance.app.n8n.cloud/webhook/outreach-emails \
  -H "Content-Type: application/json" \
  -d '{"userId":1,"company":"TestCorp","jobTitle":"Engineer","description":"Test job"}'

# Test Mock Interview Chat
curl -X POST https://your-n8n-instance.app.n8n.cloud/webhook/mock-interview-chat \
  -H "Content-Type: application/json" \
  -H "x-cl-secret: your-shared-secret" \
  -d '{"userId":1,"sessionId":"test-123","message":"Hello","conversationHistory":[]}'
```

### 2. Test from Strapi

Once you've set the environment variables, test from the application by using the respective features.

## Security Notes

1. **Always use HTTPS** for webhook URLs in production
2. **Set N8N_SHARED_SECRET** to authenticate requests from Strapi to n8n
3. **Validate the secret** in your n8n workflows using the `x-cl-secret` header
4. **Rate limit** your n8n workflows to prevent abuse
5. **Monitor logs** for failed webhook calls

## Troubleshooting

### Webhook Returns 404
- Check that the webhook path matches exactly in n8n
- Verify the webhook is activated in n8n
- Try the `-test` vs production webhook paths

### Webhook Times Out
- Increase timeout in Strapi controller (default 30s for mock interview)
- Check n8n workflow execution time
- Ensure AI services (OpenAI, etc.) are responding quickly

### Authentication Failures
- Verify N8N_SHARED_SECRET matches in both Strapi and n8n
- Check header name is correct: `x-cl-secret`
- Ensure JWT token is valid for user endpoints

## Environment Variable Summary

| Variable | Required | Used By | Purpose |
|----------|----------|---------|---------|
| `OUTREACH_WEBHOOK_URL` | Yes | Outreach Emails | Primary email finding webhook |
| `OUTREACH_WEBHOOK_URL_ALT` | No | Outreach Emails | Fallback email webhook |
| `N8N_LINKEDIN_RECRUITER_WEBHOOK_URL` | Yes | LinkedIn Search | Find LinkedIn recruiters |
| `N8N_INTERVIEW_URL` | Yes | Interview Questions | Generate interview questions |
| `N8N_CHEATSHEET_URL` | Yes | Cheat Sheets | Generate interview cheat sheets |
| `N8N_MOCK_INTERVIEW_WEBHOOK` | Yes | Mock Interview | Chat with AI interviewer |
| `N8N_SHARED_SECRET` | Recommended | All | Authenticate webhook requests |

## Next Steps

1. Create your n8n workflows for each webhook
2. Copy the webhook URLs from n8n
3. Add them to your `.env` file
4. Restart Strapi backend
5. Test each feature in the application

---

For more information, see the implementation details in:
- `strapi-backend/src/api/outreach-email/controllers/outreach-email.ts`
- `strapi-backend/src/api/linkedin-recruiter/controllers/linkedin-recruiter.ts`
- `strapi-backend/src/api/interview-set/controllers/interview-set.ts`
- `strapi-backend/src/api/cheat-sheet/controllers/cheat-sheet.ts`
- `strapi-backend/src/api/mock-interview/controllers/mock-interview.js`

