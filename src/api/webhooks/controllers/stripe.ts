// src/api/webhooks/controllers/stripe.ts
import { stripe, getPackageSlugFromPrice } from '../../../utils/stripe';

export default {
  async handleWebhook(ctx) {
    const sig = ctx.request.headers['stripe-signature'];
    const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;

    if (!sig || !endpointSecret) {
      return ctx.badRequest('Missing signature or webhook secret');
    }

    let event;

    try {
      event = stripe.webhooks.constructEvent(ctx.request.body, sig, endpointSecret);
    } catch (err) {
      console.error('Webhook signature verification failed:', err);
      return ctx.badRequest('Invalid signature');
    }

    try {
      switch (event.type) {
        case 'checkout.session.completed':
          await handleCheckoutSessionCompleted(event.data.object);
          break;
        default:
          console.log(`Unhandled event type: ${event.type}`);
      }

      ctx.body = { received: true };
    } catch (error) {
      console.error('Error processing webhook:', error);
      ctx.internalServerError('Webhook processing failed');
    }
  }
};

async function handleCheckoutSessionCompleted(session: any) {
  console.log('Processing checkout session completed:', session.id);

  try {
    // Get the subscription and invoice details
    const subscription = await stripe.subscriptions.retrieve(session.subscription);
    const invoice = await stripe.invoices.retrieve(subscription.latest_invoice);

    // Extract discount information
    const discount = invoice.discount;
    const promotionCodeId = discount?.promotion_code;

    // Get package slug from the price
    const priceId = subscription.items.data[0]?.price?.id;
    const price = await stripe.prices.retrieve(priceId);
    const packageSlug = getPackageSlugFromPrice(price);

    // Get referee user ID
    const refereeId = session.client_reference_id || session.metadata?.userId;
    if (!refereeId) {
      console.error('No referee ID found in session:', session.id);
      return;
    }

    // If a promotion code was used, process the referral
    if (promotionCodeId) {
      const referrerId = await strapi.service('api::referrals.referrals').lookupReferrerByPromotionCodeId(promotionCodeId);
      
      if (referrerId) {
        await strapi.service('api::referrals.referrals').markQualifiedReferral({
          referrerId,
          refereeId,
          source: 'stripe',
          promotionCodeId,
          packageSlug
        });

        console.log(`Referral processed: ${referrerId} -> ${refereeId} (${packageSlug})`);
      } else {
        console.log('No referrer found for promotion code:', promotionCodeId);
      }
    } else {
      console.log('No promotion code used in session:', session.id);
    }

    // TODO: Add refund clawback logic here when needed
    // This would involve listening to invoice.payment_failed or charge.dispute.created events

  } catch (error) {
    console.error('Error processing checkout session:', error);
    throw error;
  }
}
