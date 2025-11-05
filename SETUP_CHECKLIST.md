# Setup Checklist - Subscription Deactivation & Notifications

This checklist covers everything you need to configure for the subscription deactivation and notification system to work.

## ✅ 1. Environment Variables (Railway/Strapi)

Add these to your Strapi backend environment variables in Railway:

### Required:
```bash
# Stripe (you likely already have these)
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...

# n8n Integration (NEW - you need to add these)
N8N_WEBHOOK_URL=https://your-n8n-instance.com
N8N_WEBHOOK_SECRET=your-secret-token-here-make-it-long-and-random
```

**How to generate `N8N_WEBHOOK_SECRET`:**
- Use a long random string (at least 32 characters)
- You can use: `openssl rand -hex 32` or any password generator
- **Important:** This same secret must be set in n8n too!

## ✅ 2. Stripe Webhook Configuration

In your Stripe Dashboard:

1. Go to **Developers** → **Webhooks**
2. Find your existing webhook endpoint (or create new one)
3. Make sure it's pointing to: `https://your-strapi-backend.com/api/webhooks/stripe`
4. **Enable these events** (if not already enabled):
   - ✅ `checkout.session.completed` (for account activation)
   - ✅ `invoice.payment_failed` (for payment failures - **NEW**)
   - ✅ `customer.subscription.deleted` (for cancellations)
   - ✅ `customer.subscription.updated` (for subscription changes)

5. Copy the **Signing secret** (starts with `whsec_`) → This should match your `STRIPE_WEBHOOK_SECRET`

## ✅ 3. n8n Workflow Setup

You need to create **3 workflows** in n8n:

### Workflow 1: Payment Failure (Regular Subscriptions)
**Purpose:** Sends email when regular subscription payment fails

**Steps:**
1. Create new workflow in n8n
2. Add **Webhook** node:
   - **Path:** `subscription-failure`
   - **Method:** POST
   - **Response Mode:** "Respond to Webhook"
3. Add **IF** node to verify secret:
   - Condition: `{{ $json.headers['x-webhook-secret'] }}` equals `{{ $env.WEBHOOK_SECRET }}`
4. Add **Code** node to extract data:
   ```javascript
   const body = $input.item.json.body;
   return {
     email: body.email,
     userId: body.userId,
     subscriptionId: body.subscriptionId
   };
   ```
5. Add **Email** node (Gmail/SMTP):
   - **To:** `{{ $json.email }}`
   - **Subject:** `Payment Issue - Please Review Your Payment Method`
   - **Body:** (Use the template from `N8N_NOTIFICATIONS_SETUP.md`)

**Activate the workflow!**

### Workflow 2: Guarantee Redemption (4-Month Subscriptions)
**Purpose:** Sends email asking about guarantee when 4-month subscription payment fails

**Steps:**
1. Create new workflow in n8n
2. Add **Webhook** node:
   - **Path:** `guarantee-redemption`
   - **Method:** POST
   - **Response Mode:** "Respond to Webhook"
3. Add **IF** node to verify secret (same as above)
4. Add **Code** node to extract data:
   ```javascript
   const body = $input.item.json.body;
   return {
     email: body.email,
     userId: body.userId,
     guaranteeType: body.guaranteeType, // 'offers' or 'interviews'
     packageSlug: body.packageSlug
   };
   ```
5. Add **IF** node to check guarantee type:
   - If `guaranteeType === 'offers'` → Route to "offers" email
   - If `guaranteeType === 'interviews'` → Route to "interviews" email
6. Add **Email** nodes for each type:
   - **Offers email:** Subject: `Redeem Your Guarantee - 2 Offers`
   - **Interviews email:** Subject: `Redeem Your Guarantee - 2 Interviews`
   - (Use templates from `N8N_NOTIFICATIONS_SETUP.md`)

**Activate the workflow!**

### Workflow 3: Subscription Cancellation
**Purpose:** Sends email when subscription is cancelled

**Steps:**
1. Create new workflow in n8n
2. Add **Webhook** node:
   - **Path:** `subscription-cancellation`
   - **Method:** POST
   - **Response Mode:** "Respond to Webhook"
3. Add **IF** node to verify secret (same as above)
4. Add **Email** node:
   - (Use template from `N8N_NOTIFICATIONS_SETUP.md`)

**Activate the workflow!**

### n8n Environment Variable

In your n8n instance, set:
```bash
WEBHOOK_SECRET=your-secret-token-here-make-it-long-and-random
```
**Important:** This must be the **same value** as `N8N_WEBHOOK_SECRET` in Strapi!

## ✅ 4. Email Configuration in n8n

You need to configure email sending in n8n:

### Option A: Gmail (Easiest)
1. In n8n, go to **Credentials**
2. Add **Gmail OAuth2** credential
3. Follow Google OAuth setup
4. Use this credential in your Email nodes

### Option B: SMTP (More Control)
1. In n8n, go to **Credentials**
2. Add **SMTP** credential
3. Enter your email provider's SMTP settings:
   - Host: `smtp.gmail.com` (or your provider)
   - Port: `587`
   - User: `your-email@example.com`
   - Password: Your email password or app password

## ✅ 5. Testing

### Test Stripe Webhooks Locally:
```bash
# Install Stripe CLI
stripe listen --forward-to http://localhost:1337/api/webhooks/stripe

# Test payment failure
stripe trigger invoice.payment_failed

# Test subscription cancellation
stripe trigger customer.subscription.deleted
```

### Test n8n Webhooks:
```bash
# Test payment failure notification
curl -X POST https://your-n8n-instance.com/webhook/subscription-failure \
  -H "Content-Type: application/json" \
  -H "x-webhook-secret: YOUR_SECRET" \
  -d '{
    "event": "subscription_failure",
    "userId": "123",
    "email": "test@example.com",
    "subscriptionId": "sub_test123",
    "invoiceId": "in_test123",
    "reason": "payment_failed_review",
    "attemptCount": 1
  }'
```

## ✅ 6. Verify Everything Works

### Check Strapi Logs:
- Payment failures should log: `Processing invoice payment failed`
- Account deactivations should log: `Account deactivated for user X`
- Notifications should log: `Notification sent to n8n for user X`

### Check n8n Execution Logs:
- Webhooks should be received
- Emails should be sent successfully
- Check for any errors in workflow execution

### Test with Real Payment:
1. Create a test subscription
2. Cause a payment failure (expired card, etc.)
3. Verify:
   - ✅ Account is deactivated in Strapi
   - ✅ Email is sent via n8n
   - ✅ Correct email template is used

## 📋 Quick Checklist

- [ ] Added `N8N_WEBHOOK_URL` to Strapi environment variables
- [ ] Added `N8N_WEBHOOK_SECRET` to Strapi environment variables
- [ ] Added `WEBHOOK_SECRET` to n8n environment variables (same value!)
- [ ] Enabled `invoice.payment_failed` event in Stripe webhooks
- [ ] Enabled `customer.subscription.deleted` event in Stripe webhooks
- [ ] Created n8n workflow for `subscription-failure`
- [ ] Created n8n workflow for `guarantee-redemption`
- [ ] Created n8n workflow for `subscription-cancellation`
- [ ] Configured email credentials in n8n (Gmail/SMTP)
- [ ] Activated all n8n workflows
- [ ] Tested payment failure webhook
- [ ] Tested email sending
- [ ] Verified accounts deactivate correctly

## 🆘 Troubleshooting

### Emails not sending:
- Check n8n workflow is **activated**
- Check email credentials are correct
- Check n8n execution logs for errors
- Verify webhook URL is accessible

### Webhooks not received:
- Check `N8N_WEBHOOK_URL` is correct
- Verify webhook secret matches in both systems
- Check n8n workflow is active
- Test webhook URL manually with curl

### Accounts not deactivating:
- Check Stripe webhook is configured correctly
- Verify `STRIPE_WEBHOOK_SECRET` matches Stripe
- Check Strapi logs for errors
- Ensure user has `stripeCustomerId` set

## 📚 Reference Files

- **Detailed n8n setup:** `N8N_NOTIFICATIONS_SETUP.md`
- **System overview:** `SUBSCRIPTION_DEACTIVATION_AND_ANALYTICS.md`

