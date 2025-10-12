# Security Fixes - Webhook URL Protection

## Summary

All n8n webhook URLs have been moved from the frontend to the backend, preventing public exposure and potential abuse.

## Changes Made

### 1. Cover Letters Page ✅
**Status:** Fixed (hardcoded webhook URL removed)

**Frontend Changes:**
- Removed hardcoded `WEBHOOK_URL` constant from `src/pages/CoverLettersPage.js`
- Updated documentation to reflect backend endpoint usage
- Already using secure endpoint: `/api/cover-letters/generate`

**Backend:**
- No changes needed - endpoint already exists at `src/api/cover-letter/controllers/cover-letter.ts`
- Uses `COVERLETTER_WEBHOOK_URL` environment variable (server-side only)
- Requires JWT authentication
- Checks credits/entitlements
- Calls n8n securely with `x-cl-secret` header

### 2. LinkedIn Optimiser ✅
**Status:** Fixed (environment variable removed, backend proxy created)

**Frontend Changes (`effortfree-frontend`):**
- Removed all references to `REACT_APP_N8N_LINKEDIN_WEBHOOK_URL` from `src/pages/LinkedInOptimiserPage.js`
- Updated to call `/api/linkedin-optimisations/generate` via `strapiFetch` with authentication
- Removed dev warning section for missing webhook URL

**Backend Changes (`strapi-backend`):**
- Created new `generate` endpoint in `src/api/linkedin-optimisation/controllers/linkedin-optimisation.ts`
  - Requires JWT authentication
  - Validates input
  - Proxies request to n8n webhook server-side
  - Returns result to frontend
- Updated routes in `src/api/linkedin-optimisation/routes/linkedin-optimisation.ts`
  - Added `POST /api/linkedin-optimisations/generate` route

## Required Environment Variables

### Backend Only (`strapi-backend/.env`)

Add this new variable to your backend `.env` file:

```env
# LinkedIn Optimiser Webhook (move from frontend to backend)
N8N_LINKEDIN_WEBHOOK_URL=https://your-n8n-instance.app.n8n.cloud/webhook/linkedin-optimizer

# Shared secret for n8n authentication (recommended)
N8N_SHARED_SECRET=your-shared-secret-key

# Cover Letter Webhook (should already exist)
COVERLETTER_WEBHOOK_URL=https://your-n8n-instance.app.n8n.cloud/webhook/cover-letter
COVERLETTER_PROCESSING_SECRET=your-processing-secret
CL_WEBHOOK_SECRET=your-cl-webhook-secret
```

### Frontend Environment Variables to Remove

These can now be safely removed from your frontend `.env` file:

```env
# REMOVE THESE - no longer needed or used
# REACT_APP_N8N_LINKEDIN_WEBHOOK_URL=...
```

### Frontend Environment Variables That Are Safe to Keep

These are intentionally public and required for frontend functionality:

```env
# ✅ SAFE - Required public variables
REACT_APP_API_URL=https://your-backend-url.com
REACT_APP_GOOGLE_CLIENT_ID=your-google-oauth-client-id
REACT_APP_SENTRY_DSN=your-sentry-dsn
```

## Security Benefits

1. **Webhook URLs Hidden:** No n8n webhook URLs are visible in frontend code or network inspector
2. **Authentication Required:** All AI features now require valid JWT tokens
3. **Server-Side Validation:** Input validation happens server-side before calling n8n
4. **Shared Secrets:** n8n webhooks can be protected with `x-cl-secret` header
5. **Rate Limiting:** Easier to implement rate limiting at the backend level
6. **Audit Trail:** All requests go through Strapi for logging and monitoring

## Testing Checklist

After deploying these changes:

- [ ] Cover letters generation works correctly
- [ ] LinkedIn optimiser analysis works correctly
- [ ] Both features require authentication (reject if not logged in)
- [ ] Inspect frontend JavaScript - no n8n webhook URLs visible
- [ ] Check browser network tab - requests go to Strapi API, not n8n directly
- [ ] Backend logs show successful n8n webhook calls
- [ ] n8n workflows receive requests with proper authentication headers

## Deployment Steps

### 1. Backend Deployment

```bash
cd strapi-backend

# Add N8N_LINKEDIN_WEBHOOK_URL to .env file
echo "N8N_LINKEDIN_WEBHOOK_URL=https://your-n8n-instance.app.n8n.cloud/webhook/linkedin-optimizer" >> .env

# Rebuild TypeScript
npm run build

# Restart Strapi
pm2 restart strapi
# OR
npm run develop
```

### 2. Frontend Deployment

```bash
cd effortfree-frontend

# Remove old environment variable (if it exists in .env.production or .env)
# Edit .env and remove: REACT_APP_N8N_LINKEDIN_WEBHOOK_URL

# Rebuild and deploy
npm run build

# Deploy to hosting (Vercel, Netlify, etc.)
```

### 3. Verify n8n Configuration

Ensure your n8n workflows are configured to:
1. Accept the `x-cl-secret` header for authentication
2. Validate the secret matches `N8N_SHARED_SECRET` from Strapi
3. Handle the new payload structure from backend endpoints

## Troubleshooting

### "LinkedIn optimization service not configured"
- Verify `N8N_LINKEDIN_WEBHOOK_URL` is set in backend `.env`
- Restart Strapi backend after adding environment variable

### "Authentication required" error
- Ensure user is logged in on frontend
- Check JWT token is valid and not expired
- Verify Strapi authentication is working

### n8n webhook not receiving requests
- Check backend logs for webhook call errors
- Verify webhook URL is correct and n8n workflow is active
- Test webhook URL directly with curl to verify it's accessible

### Cover letters not generating
- Verify `COVERLETTER_WEBHOOK_URL` is set in backend `.env`
- Check `CL_WEBHOOK_SECRET` matches between Strapi and n8n
- Review backend logs for webhook errors

## Files Modified

**Frontend (`effortfree-frontend`):**
- `src/pages/CoverLettersPage.js` - Removed hardcoded webhook URL
- `src/pages/LinkedInOptimiserPage.js` - Updated to use backend endpoint

**Backend (`strapi-backend`):**
- `src/api/linkedin-optimisation/controllers/linkedin-optimisation.ts` - Added generate method
- `src/api/linkedin-optimisation/routes/linkedin-optimisation.ts` - Added generate route

## References

- n8n Webhook Configuration: See `N8N_WEBHOOK_CONFIGURATION.md`
- Cover Letter Implementation: See `src/api/cover-letter/controllers/cover-letter.ts`
- Authentication Flow: See `AUTHENTICATION_FLOW_UPDATE.md` (frontend)

---

**Implementation Date:** October 11, 2025  
**Security Level:** ✅ All webhook URLs now secured server-side

