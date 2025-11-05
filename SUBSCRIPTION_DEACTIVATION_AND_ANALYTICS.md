# Subscription Deactivation & Analytics System

This document explains the complete subscription deactivation, notification, and analytics tracking system.

## Overview

The system handles:
1. **Account deactivation** when subscriptions fail or are cancelled
2. **Email notifications** via n8n webhooks for subscription issues
3. **Analytics tracking** for user usage, churn, and other metrics

## Components

### 1. Stripe Webhook Handlers

**File:** `src/api/webhooks/controllers/stripe.ts`

**New Event Handlers:**
- `invoice.payment_failed` - Handles payment failures
- `customer.subscription.deleted` - Handles subscription cancellations
- `customer.subscription.updated` - Tracks subscription changes

**Payment Failure Logic:**
- After 3 failed payment attempts → Account deactivated
- Early attempts (1-2) → Warning email sent
- Final attempt (3+) → Final failure email + account deactivation

**Cancellation Logic:**
- Immediate deactivation when subscription is cancelled
- Email notification sent to user
- Analytics event tracked

### 2. Account Deactivation

**Function:** `deactivateUserAccount()`

**What it does:**
- Removes all packages from user account
- Resets plan to 'none'
- Clears subscription ID (if cancelled)
- Tracks deactivation event in analytics

### 3. n8n Notification Service

**File:** `src/api/notifications/services/notifications.ts`

**Features:**
- Sends subscription failure notifications to n8n
- Sends cancellation notifications to n8n
- Non-blocking (failures don't break main flow)
- Secure webhook authentication

**Environment Variables Required:**
- `N8N_WEBHOOK_URL` - Your n8n instance URL
- `N8N_WEBHOOK_SECRET` - Secret for webhook authentication

**See:** `N8N_NOTIFICATIONS_SETUP.md` for detailed n8n workflow setup

### 4. Analytics Tracking Service

**File:** `src/api/analytics/services/analytics.ts`

**Features:**
- Tracks user events (activations, deactivations, payments, etc.)
- Tracks feature usage (cover letters, recruiter lookups, etc.)
- Calculates churn metrics
- Provides user usage analytics

**Tracked Events:**
- `account_activated`
- `account_deactivated`
- `payment_failed`
- `subscription_cancelled`
- `subscription_updated`
- `cover_letter_generated`
- `recruiter_lookup`
- `mock_interview_completed`
- `interview_questions_generated`
- `cheat_sheet_generated`
- `warm_up_completed`

### 5. Analytics Endpoints

**File:** `src/api/analytics/controllers/analytics.ts`

**Endpoints:**
- `GET /api/analytics/usage` - Get current user's usage metrics
- `GET /api/analytics/my-analytics` - Get comprehensive analytics for current user
- `GET /api/analytics/churn?period=month` - Get churn metrics (admin)

**Usage Metrics Include:**
- Total cover letters generated
- Total recruiter lookups
- Total mock interviews
- Total interview questions
- Total cheat sheets
- Total warm-ups
- Last activity date

**Churn Metrics Include:**
- Total churned users
- Churned from trial
- Churned from paid subscription
- Churn rates (overall, trial, paid)
- Configurable period (day, week, month)

## Configuration

### Environment Variables

Add to Strapi (Railway):

```bash
# n8n Integration
N8N_WEBHOOK_URL=https://your-n8n-instance.com
N8N_WEBHOOK_SECRET=your-secret-token-here

# Stripe (existing)
STRIPE_SECRET_KEY=sk_...
STRIPE_WEBHOOK_SECRET=whsec_...
```

### Stripe Webhook Configuration

In Stripe Dashboard, ensure these events are enabled:
- `checkout.session.completed` ✅
- `invoice.payment_failed` ✅
- `customer.subscription.deleted` ✅
- `customer.subscription.updated` ✅

## Usage Examples

### Track a Feature Usage Event

```typescript
// In your controller/service
await strapi.service('api::analytics.analytics').trackEvent(userId, {
  event: 'cover_letter_generated',
  jobId: '123',
  timestamp: new Date().toISOString()
});
```

### Get User Analytics

```javascript
// Frontend API call
const response = await fetch('/api/analytics/my-analytics', {
  headers: {
    'Authorization': `Bearer ${jwt}`
  }
});
const analytics = await response.json();
```

### Get Churn Metrics

```javascript
// Admin API call
const response = await fetch('/api/analytics/churn?period=month', {
  headers: {
    'Authorization': `Bearer ${adminJwt}`
  }
});
const churn = await response.json();
```

## Flow Diagrams

### Payment Failure Flow

```
Stripe Payment Fails
    ↓
invoice.payment_failed webhook
    ↓
Check attempt_count
    ↓
┌─────────────┬──────────────┐
│ Attempt 1-2 │ Attempt 3+   │
└─────────────┴──────────────┘
    ↓              ↓
Warning Email  Final Email
    ↓              ↓
Track Event    Deactivate Account
                Track Event
```

### Subscription Cancellation Flow

```
User Cancels Subscription
    ↓
customer.subscription.deleted webhook
    ↓
Deactivate Account
    ↓
Track Cancellation Event
    ↓
Send Cancellation Email (via n8n)
```

## Testing

### Test Payment Failure

```bash
# Use Stripe CLI to trigger test event
stripe trigger invoice.payment_failed
```

### Test Subscription Cancellation

```bash
# Use Stripe CLI to trigger test event
stripe trigger customer.subscription.deleted
```

### Test Analytics Endpoints

```bash
# Get usage metrics
curl -X GET https://your-backend.com/api/analytics/usage \
  -H "Authorization: Bearer YOUR_JWT"

# Get churn metrics
curl -X GET https://your-backend.com/api/analytics/churn?period=month \
  -H "Authorization: Bearer YOUR_JWT"
```

## Monitoring

### Key Metrics to Monitor

1. **Churn Rate** - Track monthly churn trends
2. **Payment Failure Rate** - Monitor payment issues
3. **Trial Conversion Rate** - Track trial → paid conversions
4. **Feature Usage** - Monitor which features are most used
5. **User Activity** - Track last activity dates

### Logs to Check

- Strapi logs: `console.log` for all webhook events
- n8n execution logs: Webhook delivery status
- Stripe Dashboard: Webhook delivery logs

## Troubleshooting

### Accounts Not Deactivating

- Check Stripe webhook is configured correctly
- Verify webhook secret matches
- Check Strapi logs for errors
- Ensure user has `stripeCustomerId` set

### Notifications Not Sending

- Verify `N8N_WEBHOOK_URL` is set correctly
- Check `N8N_WEBHOOK_SECRET` matches in both systems
- Verify n8n webhook is active
- Check n8n execution logs

### Analytics Not Tracking

- Verify usage logs are being created
- Check user has valid `userId`
- Ensure analytics service is accessible
- Check for errors in Strapi logs

## Future Enhancements

Potential improvements:
1. **Retry Logic** - Automatic retry for failed notifications
2. **Grace Period** - Allow grace period before deactivation
3. **Reactivation Flow** - Easy reactivation after payment update
4. **Advanced Analytics** - More detailed churn analysis
5. **User Segmentation** - Track churn by user segments
6. **Predictive Analytics** - Predict churn risk

