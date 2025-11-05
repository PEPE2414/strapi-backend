# How to Enable Events in Stripe

## Step-by-Step Guide

### 1. Go to Stripe Dashboard
1. Log in to your Stripe Dashboard: https://dashboard.stripe.com
2. Navigate to **Developers** → **Webhooks** (in the left sidebar)

### 2. Find Your Webhook Endpoint
- If you already have a webhook endpoint, click on it
- If not, click **"Add endpoint"** button

### 3. Configure Webhook Endpoint
- **Endpoint URL:** `https://your-strapi-backend.railway.app/api/webhooks/stripe`
  - Replace `your-strapi-backend.railway.app` with your actual Railway URL
- **Description:** (Optional) "Strapi Payment Webhooks"

### 4. Select Events to Listen To
Click on **"Select events"** or **"Add events"** and enable these events:

#### Required Events:
- ✅ `checkout.session.completed` - When checkout is completed
- ✅ `invoice.payment_failed` - When payment fails (NEW)
- ✅ `customer.subscription.deleted` - When subscription is cancelled
- ✅ `customer.subscription.updated` - When subscription is updated

#### How to Select Events:
1. Click on the event category or use search
2. Check the boxes next to each event name
3. Click **"Add events"** or **"Done"**

### 5. Save and Copy Webhook Secret
1. Click **"Add endpoint"** or **"Save changes"**
2. After saving, you'll see the webhook endpoint details
3. **Copy the "Signing secret"** (starts with `whsec_`)
4. This is your `STRIPE_WEBHOOK_SECRET` - add it to Railway environment variables

### 6. Test the Webhook
1. Click **"Send test webhook"** button
2. Select an event type (e.g., `checkout.session.completed`)
3. Click **"Send test webhook"**
4. Check your Strapi logs to verify it's being received

## Important Notes

- **Use HTTPS:** Stripe requires HTTPS for webhook endpoints
- **Test Mode vs Live Mode:** Make sure you're configuring webhooks in the correct mode (Test or Live)
- **Webhook Secret:** Keep this secret secure and never commit it to git
- **Multiple Environments:** You may need separate webhook endpoints for test and production

## Troubleshooting

### Webhook Not Receiving Events:
1. Check the endpoint URL is correct
2. Verify your Strapi backend is publicly accessible
3. Check Strapi logs for webhook delivery attempts
4. Verify the webhook secret matches in Railway

### Events Not Appearing:
1. Make sure you selected the events when creating/editing the endpoint
2. Check if events are enabled (they should have a checkmark)
3. Try re-adding the events if they're missing

### Testing Events:
Use Stripe CLI to test webhooks locally:
```bash
# Install Stripe CLI
# Then forward webhooks to your local server
stripe listen --forward-to http://localhost:1337/api/webhooks/stripe

# In another terminal, trigger test events
stripe trigger checkout.session.completed
stripe trigger invoice.payment_failed
stripe trigger customer.subscription.deleted
```

## Visual Guide

1. **Navigation:** Dashboard → Developers → Webhooks
2. **Add/Edit Endpoint:** Click "Add endpoint" or click on existing endpoint
3. **URL Field:** Enter your Strapi webhook URL
4. **Events Section:** Click "Select events" or "Add events"
5. **Event List:** Check boxes for required events
6. **Save:** Click "Add endpoint" or "Save changes"
7. **Copy Secret:** Copy the "Signing secret" value

## Quick Checklist

- [ ] Webhook endpoint URL is correct (HTTPS)
- [ ] `checkout.session.completed` event is enabled
- [ ] `invoice.payment_failed` event is enabled (NEW)
- [ ] `customer.subscription.deleted` event is enabled
- [ ] `customer.subscription.updated` event is enabled
- [ ] Webhook secret copied to Railway as `STRIPE_WEBHOOK_SECRET`
- [ ] Test webhook was sent successfully
- [ ] Strapi logs show webhook received

