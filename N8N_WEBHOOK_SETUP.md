# Stripe → n8n → Strapi Integration Guide

This guide explains how to set up Stripe webhooks to send to n8n, and how to configure an n8n workflow to activate user accounts and process referrals in Strapi.

## Overview

When a payment is completed in Stripe, the webhook flow:
1. Stripe sends `checkout.session.completed` event to n8n
2. n8n processes the webhook and extracts payment data
3. n8n calls Strapi to activate the user's account
4. n8n processes referral codes (if any) and updates referral tracking

## Step 1: Stripe Webhook Configuration

### In Stripe Dashboard:

1. Go to **Developers** → **Webhooks**
2. Click **Add endpoint**
3. Enter your n8n webhook URL:
   ```
   https://your-n8n-instance.com/webhook/stripe-payment
   ```
4. Select events to listen to:
   - `checkout.session.completed` (required)
   - Optionally: `invoice.payment_succeeded`, `customer.subscription.updated`
5. Copy the **Signing secret** (starts with `whsec_`) - you'll need this for n8n

## Step 2: n8n Workflow Setup

### Workflow Structure:

```
┌─────────────────┐
│  Webhook Node   │ ← Receives Stripe webhook
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  IF Node        │ ← Check if event type is checkout.session.completed
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Code Node      │ ← Extract data from Stripe session
└────────┬────────┘
         │
         ├─────────────────┐
         │                 │
         ▼                 ▼
┌─────────────────┐  ┌─────────────────┐
│  HTTP Request   │  │  HTTP Request   │
│  (Activate)     │  │  (Referral)     │
└─────────────────┘  └─────────────────┘
```

### Node 1: Webhook Trigger

**Node Type:** Webhook

**Configuration:**
- **HTTP Method:** POST
- **Path:** `stripe-payment`
- **Response Mode:** Respond to Webhook
- **Authentication:** Generic Credential Type
  - **Header Name:** `stripe-signature`
  - **Value:** (will be set automatically by Stripe)

**Settings:**
- Add header: `stripe-signature` (from Stripe webhook)

### Node 2: IF Node (Event Type Check)

**Node Type:** IF

**Condition:**
- **Condition:** `{{ $json.body.type }}` equals `checkout.session.completed`

**True Branch:** Continue to data extraction
**False Branch:** End workflow (or log unhandled event)

### Node 3: Code Node (Extract Data)

**Node Type:** Code

**Language:** JavaScript

**Code:**
```javascript
const session = $input.item.json.body.data.object;
const subscription = session.subscription;

// Extract user ID from client_reference_id or metadata
const userId = session.client_reference_id || session.metadata?.userId;

// Extract referral code from metadata
const referralCode = session.metadata?.refCode || '';
const promoCode = session.metadata?.promoCode || '';

// Get subscription details (if needed)
// Note: You may need to make an HTTP request to Stripe API here
// or pass this to Strapi to retrieve

// Extract package slug from metadata (if available)
const packageSlug = session.metadata?.packageSlug || '';

// Extract subscription ID
const subscriptionId = subscription || '';

// Extract customer ID
const stripeCustomerId = session.customer || '';

return {
  userId,
  referralCode,
  promoCode,
  packageSlug,
  subscriptionId,
  stripeCustomerId,
  sessionId: session.id
};
```

### Node 4: HTTP Request (Activate Account)

**Node Type:** HTTP Request

**Configuration:**
- **Method:** POST
- **URL:** `https://your-strapi-backend.com/api/webhooks/account-activation`
- **Headers:**
  - `Content-Type: application/json`
  - `x-webhook-secret: YOUR_N8N_WEBHOOK_SECRET` (from environment variable)
- **Body (JSON):**
```json
{
  "userId": "{{ $json.userId }}",
  "packageSlug": "{{ $json.packageSlug }}",
  "subscriptionId": "{{ $json.subscriptionId }}",
  "stripeCustomerId": "{{ $json.stripeCustomerId }}"
}
```

**Error Handling:**
- On error, log and continue (or set up error notification)

### Node 5: HTTP Request (Process Referral)

**Node Type:** HTTP Request

**Configuration:**
- **Method:** POST
- **URL:** `https://your-strapi-backend.com/api/webhooks/referral-processing`
- **Headers:**
  - `Content-Type: application/json`
  - `x-webhook-secret: YOUR_N8N_WEBHOOK_SECRET` (from environment variable)
- **Body (JSON):**
```json
{
  "userId": "{{ $json.userId }}",
  "referralCode": "{{ $json.referralCode }}",
  "packageSlug": "{{ $json.packageSlug }}",
  "promotionCodeId": "{{ $json.promoCode }}"
}
```

**Note:** This node should only run if `referralCode` or `promoCode` exists. Use an IF node before this.

### Node 6: IF Node (Check for Referral Code)

**Node Type:** IF

**Condition:**
- **Condition:** `{{ $json.referralCode }}` is not empty OR `{{ $json.promoCode }}` is not empty

**True Branch:** Continue to referral processing
**False Branch:** Skip referral processing

## Step 3: Environment Variables

### In n8n:

Set these environment variables:
- `N8N_WEBHOOK_SECRET`: A secret token for authenticating webhook requests to Strapi
- `STRAPI_URL`: Your Strapi backend URL (e.g., `https://your-backend.railway.app`)

### In Strapi (Railway):

Add to your environment variables:
- `N8N_WEBHOOK_SECRET`: Same secret token as in n8n (must match)

## Step 4: Referral Code Format

The system supports two referral code formats:

1. **EF-REF-{userId}** format:
   - Example: `EF-REF-123`
   - Directly maps to user ID 123

2. **Stripe Promotion Codes**:
   - Stored in Stripe with metadata linking to user ID
   - Used when promo codes are applied during checkout

3. **Legacy referral codes**:
   - Stored in user's `referralCode` field
   - Fallback lookup if other methods don't match

## Step 5: Referral Rewards Logic

When a user refers 7 qualified users who complete payment:
- The referrer gets **4 months free** of fast-track access
- Each referral also grants +1 week of the package the referee bought

The referral is tracked in the `qualifiedReferrals` field and rewards are stored in `referralRewards` array.

## Testing

### Test Stripe Webhook Locally:

1. Use Stripe CLI to forward webhooks:
   ```bash
   stripe listen --forward-to http://localhost:5678/webhook/stripe-payment
   ```

2. Trigger a test event:
   ```bash
   stripe trigger checkout.session.completed
   ```

3. Check n8n workflow execution logs

### Test Strapi Endpoints:

```bash
# Activate account
curl -X POST https://your-strapi-backend.com/api/webhooks/account-activation \
  -H "Content-Type: application/json" \
  -H "x-webhook-secret: YOUR_SECRET" \
  -d '{
    "userId": "123",
    "packageSlug": "fast-track",
    "subscriptionId": "sub_test123",
    "stripeCustomerId": "cus_test123"
  }'

# Process referral
curl -X POST https://your-strapi-backend.com/api/webhooks/referral-processing \
  -H "Content-Type: application/json" \
  -H "x-webhook-secret: YOUR_SECRET" \
  -d '{
    "userId": "456",
    "referralCode": "EF-REF-123",
    "packageSlug": "fast-track"
  }'
```

## Troubleshooting

### Webhook not received in n8n:
- Check Stripe webhook endpoint URL is correct
- Verify n8n webhook is active and accessible
- Check Stripe webhook delivery logs

### Account not activating:
- Verify `N8N_WEBHOOK_SECRET` matches in both n8n and Strapi
- Check Strapi logs for errors
- Verify user ID exists in Strapi

### Referral not processing:
- Check referral code format matches expected pattern
- Verify referrer user exists
- Check Strapi logs for referral processing errors

## Security Notes

1. **Webhook Secret**: Always use a strong, random secret for `N8N_WEBHOOK_SECRET`
2. **HTTPS**: Use HTTPS for all webhook endpoints (Stripe requires this)
3. **Stripe Signature Verification**: Consider adding Stripe signature verification in n8n for additional security
4. **Rate Limiting**: Consider adding rate limiting to Strapi webhook endpoints

## Additional Stripe Events (Optional)

You may want to handle additional events:

- `invoice.payment_succeeded`: Track successful recurring payments
- `customer.subscription.updated`: Handle subscription changes
- `customer.subscription.deleted`: Handle cancellations
- `invoice.payment_failed`: Handle failed payments

