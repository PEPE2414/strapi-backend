# n8n Notifications Setup Guide

This guide explains how to set up n8n webhooks to receive notifications from Strapi for subscription failures and cancellations.

## Overview

When subscription events occur, Strapi sends webhooks to n8n for email notifications:
- **Regular subscriptions**: Payment failures → Account deactivated on first attempt + payment review email
- **4-month subscriptions**: Payment failures → Account deactivated + guarantee redemption email
- Subscription cancellations

## Step 1: Configure Environment Variables

### In Strapi (Railway):

Add these environment variables:
- `N8N_WEBHOOK_URL`: Your n8n instance URL (e.g., `https://your-n8n-instance.com`)
- `N8N_WEBHOOK_SECRET`: A secret token for authenticating webhook requests (must match n8n)

### In n8n:

Set these environment variables:
- `WEBHOOK_SECRET`: Same secret token as `N8N_WEBHOOK_SECRET` in Strapi

## Step 2: Create n8n Webhook Workflows

### Workflow 1: Subscription Failure Notification (Regular Subscriptions)

**Webhook Trigger:**
- **Path:** `subscription-failure`
- **HTTP Method:** POST
- **Authentication:** Header Auth
  - **Name:** `x-webhook-secret`
  - **Value:** `{{ $env.WEBHOOK_SECRET }}`

**IF Node (Verify Secret):**
- Check if header `x-webhook-secret` matches `{{ $env.WEBHOOK_SECRET }}`
- If not, end workflow

**Extract Data Node:**
```javascript
const body = $input.item.json.body;
return {
  event: body.event,
  userId: body.userId,
  email: body.email,
  subscriptionId: body.subscriptionId,
  invoiceId: body.invoiceId,
  reason: body.reason, // 'payment_failed_review' (first attempt)
  attemptCount: body.attemptCount,
  timestamp: body.timestamp
};
```

**Email Node (Payment Review - First Attempt):**
- **To:** `{{ $json.email }}`
- **Subject:** `Payment Issue - Please Review Your Payment Method`
- **Body:** 
```
Hi there,

We had trouble processing your payment for your EffortFree subscription. 
Your account has been temporarily deactivated while we resolve this.

Please review and update your payment method:
[Payment Update Link]

Once updated, your account will be reactivated automatically. If you have any questions, please contact support.

Best,
EffortFree Team
```

### Workflow 2: Guarantee Redemption Notification (4-Month Subscriptions)

**Webhook Trigger:**
- **Path:** `guarantee-redemption`
- **HTTP Method:** POST
- **Authentication:** Header Auth
  - **Name:** `x-webhook-secret`
  - **Value:** `{{ $env.WEBHOOK_SECRET }}`

**IF Node (Verify Secret):**
- Check if header `x-webhook-secret` matches `{{ $env.WEBHOOK_SECRET }}`
- If not, end workflow

**Extract Data Node:**
```javascript
const body = $input.item.json.body;
return {
  event: body.event,
  userId: body.userId,
  email: body.email,
  subscriptionId: body.subscriptionId,
  invoiceId: body.invoiceId,
  packageSlug: body.packageSlug,
  guaranteeType: body.guaranteeType, // 'offers' or 'interviews'
  timestamp: body.timestamp
};
```

**IF Node (Check Guarantee Type):**
- If `guaranteeType === 'offers'` → Send offer guarantee email
- If `guaranteeType === 'interviews'` → Send interview guarantee email

**Email Node (Offer Guarantee - fast-track/offer-fast-track):**
- **To:** `{{ $json.email }}`
- **Subject:** `Redeem Your Guarantee - 2 Offers`
- **Body:**
```
Hi there,

We had trouble processing your payment for your EffortFree subscription. 
Your account has been temporarily deactivated.

As part of your 4-month subscription guarantee, we want to make sure you've achieved your goals:

**Have you received 2 job offers in the past 90 days?**

If yes, congratulations! 🎉 We'd love to hear about your success.

If not, we'd like to honor our guarantee and continue working with you free of charge until you achieve your goals. 

To redeem your guarantee, please reply to this email or contact support:
[Contact Support Link]

We're here to help you succeed!

Best,
EffortFree Team
```

**Email Node (Interview Guarantee - interview-pack):**
- **To:** `{{ $json.email }}`
- **Subject:** `Redeem Your Guarantee - 2 Interviews`
- **Body:**
```
Hi there,

We had trouble processing your payment for your EffortFree subscription. 
Your account has been temporarily deactivated.

As part of your 4-month subscription guarantee, we want to make sure you've achieved your goals:

**Have you received 2 interview invitations in the past 90 days?**

If yes, congratulations! 🎉 We'd love to hear about your success.

If not, we'd like to honor our guarantee and continue working with you free of charge until you achieve your goals. 

To redeem your guarantee, please reply to this email or contact support:
[Contact Support Link]

We're here to help you succeed!

Best,
EffortFree Team
```

### Workflow 3: Subscription Cancellation Notification

**Webhook Trigger:**
- **Path:** `subscription-cancellation`
- **HTTP Method:** POST
- **Authentication:** Header Auth
  - **Name:** `x-webhook-secret`
  - **Value:** `{{ $env.WEBHOOK_SECRET }}`

**IF Node (Verify Secret):**
- Check if header `x-webhook-secret` matches `{{ $env.WEBHOOK_SECRET }}`
- If not, end workflow

**Extract Data Node:**
```javascript
const body = $input.item.json.body;
return {
  event: body.event,
  userId: body.userId,
  email: body.email,
  subscriptionId: body.subscriptionId,
  cancelAtPeriodEnd: body.cancelAtPeriodEnd,
  timestamp: body.timestamp
};
```

**IF Node (Check cancelAtPeriodEnd):**
- If `cancelAtPeriodEnd` is true → Send cancellation scheduled email
- If false → Send immediate cancellation email

**Email Node (Scheduled Cancellation):**
- **To:** `{{ $json.email }}`
- **Subject:** `Subscription Cancellation Scheduled`
- **Body:**
```
Hi there,

Your subscription cancellation has been scheduled. 
Your access will continue until the end of your current billing period.

We're sorry to see you go! If you change your mind, you can reactivate anytime:
[Reactivate Link]

Best,
EffortFree Team
```

**Email Node (Immediate Cancellation):**
- **To:** `{{ $json.email }}`
- **Subject:** `Subscription Cancelled`
- **Body:**
```
Hi there,

Your subscription has been cancelled and your account has been deactivated.

We're sorry to see you go! If you'd like to return, you can reactivate anytime:
[Reactivate Link]

Best,
EffortFree Team
```

## Step 3: Test the Integration

### Test from Strapi:

```bash
# Test subscription failure notification (regular subscription)
curl -X POST https://your-n8n-instance.com/subscription-failure \
  -H "Content-Type: application/json" \
  -H "x-webhook-secret: YOUR_SECRET" \
  -d '{
    "event": "subscription_failure",
    "userId": "123",
    "email": "test@example.com",
    "subscriptionId": "sub_test123",
    "invoiceId": "in_test123",
    "reason": "payment_failed_review",
    "attemptCount": 1,
    "timestamp": "2024-01-01T00:00:00Z"
  }'

# Test guarantee redemption notification (4-month subscription)
curl -X POST https://your-n8n-instance.com/guarantee-redemption \
  -H "Content-Type: application/json" \
  -H "x-webhook-secret: YOUR_SECRET" \
  -d '{
    "event": "guarantee_redemption",
    "userId": "123",
    "email": "test@example.com",
    "subscriptionId": "sub_test123",
    "invoiceId": "in_test123",
    "packageSlug": "fast-track",
    "guaranteeType": "offers",
    "timestamp": "2024-01-01T00:00:00Z"
  }'
```

# Test subscription cancellation notification
curl -X POST https://your-n8n-instance.com/subscription-cancellation \
  -H "Content-Type: application/json" \
  -H "x-webhook-secret: YOUR_SECRET" \
  -d '{
    "event": "subscription_cancellation",
    "userId": "123",
    "email": "test@example.com",
    "subscriptionId": "sub_test123",
    "cancelAtPeriodEnd": false,
    "timestamp": "2024-01-01T00:00:00Z"
  }'
```

## Step 4: Monitor and Debug

- Check n8n execution logs for webhook delivery
- Check Strapi logs for notification sending errors
- Verify emails are being sent correctly
- Monitor for failed webhook deliveries

## Security Notes

1. **Always use HTTPS** for n8n webhook URLs
2. **Use strong secrets** for `N8N_WEBHOOK_SECRET`
3. **Verify webhook secret** in n8n workflows before processing
4. **Rate limit** webhook endpoints if needed
5. **Log all webhook events** for audit purposes

## Troubleshooting

### Webhooks not received:
- Verify `N8N_WEBHOOK_URL` is correct in Strapi
- Check n8n webhook is active and accessible
- Verify webhook secret matches in both systems

### Emails not sending:
- Check n8n email node configuration
- Verify email service credentials in n8n
- Check n8n execution logs for errors

### Authentication failures:
- Verify `N8N_WEBHOOK_SECRET` matches in both Strapi and n8n
- Check webhook secret is being sent in headers correctly

