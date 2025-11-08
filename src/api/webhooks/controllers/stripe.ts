// src/api/webhooks/controllers/stripe.ts
import { stripe, getPackageSlugFromPrice, lookupReferrerByReferralCode, is4MonthSubscription } from '../../../utils/stripe';

export default {
  async handleWebhook(ctx) {
    const sig = ctx.request.headers['stripe-signature'];
    const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;

    if (!sig) {
      return ctx.badRequest('Missing Stripe signature');
    }

    if (!endpointSecret) {
      console.error('STRIPE_WEBHOOK_SECRET environment variable is not set');
      return ctx.internalServerError('Webhook configuration error');
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
        case 'invoice.payment_failed':
          await handleInvoicePaymentFailed(event.data.object);
          break;
        case 'customer.subscription.deleted':
          await handleSubscriptionDeleted(event.data.object);
          break;
        case 'customer.subscription.updated':
          await handleSubscriptionUpdated(event.data.object);
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
    const invoiceId = typeof subscription.latest_invoice === 'string' 
      ? subscription.latest_invoice 
      : subscription.latest_invoice.id;
    const invoice = await stripe.invoices.retrieve(invoiceId) as any;

    // Safety check: Only activate if payment was successful
    if (invoice.payment_intent) {
      const paymentIntentId = typeof invoice.payment_intent === 'string' 
        ? invoice.payment_intent 
        : invoice.payment_intent.id;
      const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
      
      if (paymentIntent.status !== 'succeeded') {
        console.log(`Payment not succeeded (status: ${paymentIntent.status}), skipping activation for session: ${session.id}`);
        return;
      }
    } else if (invoice.status !== 'paid') {
      // If no payment intent, check invoice status directly
      console.log(`Invoice not paid (status: ${invoice.status}), skipping activation for session: ${session.id}`);
      return;
    }

    // Extract discount information
    const discounts = invoice.discounts || [];
    const discount = discounts.length > 0 ? discounts[0] : null;
    const promotionCodeId = typeof discount === 'object' && discount !== null && 'promotion_code' in discount 
      ? (discount as any).promotion_code 
      : null;

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

    // Activate user account with the purchased package
    await activateUserAccount(refereeId, packageSlug, subscription.id, session.customer);

    // Process referral if referral code or promotion code was used
    const referralCode = session.metadata?.refCode || '';
    const promoCode = session.metadata?.promoCode || '';
    let referrerId: string | null = null;

    // Try to look up referrer by promotion code ID first (Stripe promotion codes)
    if (promotionCodeId) {
      referrerId = await strapi.service('api::referrals.referrals').lookupReferrerByPromotionCodeId(promotionCodeId);
    }

    // If not found and referral code provided, try referral code lookup (EF-REF-{userId} format)
    if (!referrerId && referralCode) {
      referrerId = await lookupReferrerByReferralCode(referralCode);
    }

    // If still not found, try to resolve by the stored promo code string
    if (!referrerId && promoCode) {
      try {
        const promoUsers = await strapi.entityService.findMany('plugin::users-permissions.user', {
          filters: { promoCode },
          fields: ['id'],
          limit: 1
        });

        if (promoUsers.length > 0) {
          referrerId = promoUsers[0].id.toString();
        }
      } catch (lookupError) {
        console.error('Error looking up user by promo code:', lookupError);
      }
    }

    // Process referral if referrer found
    if (referrerId) {
      await strapi.service('api::referrals.referrals').markQualifiedReferral({
        referrerId,
        refereeId: refereeId.toString(),
        source: 'stripe',
        promotionCodeId: promotionCodeId || '',
        packageSlug
      });

      console.log(`Referral processed: ${referrerId} -> ${refereeId} (${packageSlug})`);
    } else if (referralCode || promotionCodeId) {
      console.log(`No referrer found for referral code: ${referralCode || promotionCodeId}`);
    }

    // TODO: Add refund clawback logic here when needed
    // This would involve listening to invoice.payment_failed or charge.dispute.created events

  } catch (error) {
    console.error('Error processing checkout session:', error);
    throw error;
  }
}

/**
 * Activate user account with purchased package
 */
async function activateUserAccount(
  userId: string | number,
  packageSlug: string,
  subscriptionId: string,
  stripeCustomerId: string | null
) {
  try {
    // Get user
    const user = await strapi.entityService.findOne('plugin::users-permissions.user', userId, {
      fields: ['id', 'packages', 'plan', 'stripeCustomerId', 'stripeSubscriptionId']
    });

    if (!user) {
      console.error(`User not found: ${userId}`);
      return;
    }

    // Get current packages array
    const packagesArr = Array.isArray(user.packages) ? user.packages : [];
    
    // Add package if not already present
    if (!packagesArr.includes(packageSlug)) {
      packagesArr.push(packageSlug);
    }

    // Update user with package and subscription info
    const updateData: any = {
      packages: packagesArr,
      plan: packageSlug, // Set plan to package slug
    };

    // Store Stripe subscription info
    if (subscriptionId) {
      updateData.stripeSubscriptionId = subscriptionId;
    }
    if (stripeCustomerId) {
      updateData.stripeCustomerId = stripeCustomerId;
    }

    await strapi.entityService.update('plugin::users-permissions.user', userId, {
      data: updateData
    });

    console.log(`Account activated for user ${userId} with package ${packageSlug}`);
    
    // Track activation event
    await strapi.service('api::analytics.analytics').trackEvent(userId.toString(), {
      event: 'account_activated',
      packageSlug,
      subscriptionId,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error(`Error activating account for user ${userId}:`, error);
    throw error;
  }
}

/**
 * Handle invoice payment failed - deactivate account after grace period
 */
async function handleInvoicePaymentFailed(invoice: any) {
  console.log('Processing invoice payment failed:', invoice.id);

  try {
    const subscriptionId = invoice.subscription;
    if (!subscriptionId) {
      console.log('No subscription ID in invoice:', invoice.id);
      return;
    }

    // Get subscription to find customer
    const subscription = await stripe.subscriptions.retrieve(
      typeof subscriptionId === 'string' ? subscriptionId : subscriptionId.id
    );

    const customerId = subscription.customer;
    if (!customerId) {
      console.log('No customer ID in subscription:', subscription.id);
      return;
    }

    // Find user by Stripe customer ID
    const users = await strapi.entityService.findMany('plugin::users-permissions.user', {
      filters: {
        stripeCustomerId: typeof customerId === 'string' ? customerId : customerId.id
      },
      fields: ['id', 'email', 'packages', 'plan', 'stripeSubscriptionId'],
      limit: 1
    });

    if (users.length === 0) {
      console.log('No user found for customer:', customerId);
      return;
    }

    const user = users[0];
    
    // Get the price to check if it's a 4-month subscription
    const priceId = subscription.items.data[0]?.price?.id;
    const price = await stripe.prices.retrieve(priceId);
    const packageSlug = getPackageSlugFromPrice(price);
    const is4Month = is4MonthSubscription(price);
    
    const attemptCount = invoice.attempt_count || 0;

    // Always deactivate on first payment failure
    await deactivateUserAccount(user.id, 'payment_failed', {
      subscriptionId: subscription.id,
      invoiceId: invoice.id,
      attemptCount,
      is4Month,
      packageSlug
    });

    // Track payment failure event
    await strapi.service('api::analytics.analytics').trackEvent(user.id.toString(), {
      event: 'payment_failed',
      attemptCount,
      subscriptionId: subscription.id,
      invoiceId: invoice.id,
      is4Month,
      packageSlug,
      timestamp: new Date().toISOString()
    });

    // Send appropriate notification based on subscription type
    if (is4Month) {
      // 4-month subscription: Send guarantee redemption email
      await strapi.service('api::notifications.notifications').sendGuaranteeRedemptionNotification({
        userId: user.id,
        email: user.email,
        subscriptionId: subscription.id,
        invoiceId: invoice.id,
        packageSlug
      });
    } else {
      // Regular subscription: Send payment review email
      await strapi.service('api::notifications.notifications').sendSubscriptionFailureNotification({
        userId: user.id,
        email: user.email,
        subscriptionId: subscription.id,
        invoiceId: invoice.id,
        reason: 'payment_failed_review',
        attemptCount
      });
    }
  } catch (error) {
    console.error('Error processing invoice payment failed:', error);
    throw error;
  }
}

/**
 * Handle subscription deleted/cancelled
 */
async function handleSubscriptionDeleted(subscription: any) {
  console.log('Processing subscription deleted:', subscription.id);

  try {
    const customerId = subscription.customer;
    if (!customerId) {
      console.log('No customer ID in subscription:', subscription.id);
      return;
    }

    // Find user by Stripe customer ID
    const users = await strapi.entityService.findMany('plugin::users-permissions.user', {
      filters: {
        stripeCustomerId: typeof customerId === 'string' ? customerId : customerId.id
      },
      fields: ['id', 'email', 'packages', 'plan'],
      limit: 1
    });

    if (users.length === 0) {
      console.log('No user found for customer:', customerId);
      return;
    }

    const user = users[0];
    
    // Deactivate account
    await deactivateUserAccount(user.id, 'subscription_cancelled', {
      subscriptionId: subscription.id,
      cancelAtPeriodEnd: subscription.cancel_at_period_end
    });

    // Track cancellation event
    await strapi.service('api::analytics.analytics').trackEvent(user.id.toString(), {
      event: 'subscription_cancelled',
      subscriptionId: subscription.id,
      cancelAtPeriodEnd: subscription.cancel_at_period_end,
      timestamp: new Date().toISOString()
    });

    // Send cancellation notification to n8n
    await strapi.service('api::notifications.notifications').sendSubscriptionCancellationNotification({
      userId: user.id,
      email: user.email,
      subscriptionId: subscription.id,
      cancelAtPeriodEnd: subscription.cancel_at_period_end
    });
  } catch (error) {
    console.error('Error processing subscription deleted:', error);
    throw error;
  }
}

/**
 * Handle subscription updated (e.g., plan changes, renewals)
 */
async function handleSubscriptionUpdated(subscription: any) {
  console.log('Processing subscription updated:', subscription.id);

  try {
    const customerId = subscription.customer;
    if (!customerId) {
      return;
    }

    // Find user by Stripe customer ID
    const users = await strapi.entityService.findMany('plugin::users-permissions.user', {
      filters: {
        stripeCustomerId: typeof customerId === 'string' ? customerId : customerId.id
      },
      fields: ['id'],
      limit: 1
    });

    if (users.length === 0) {
      return;
    }

    const user = users[0];

    // Track subscription update
    await strapi.service('api::analytics.analytics').trackEvent(user.id.toString(), {
      event: 'subscription_updated',
      subscriptionId: subscription.id,
      status: subscription.status,
      cancelAtPeriodEnd: subscription.cancel_at_period_end,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error processing subscription updated:', error);
    // Don't throw - subscription updates are non-critical
  }
}

/**
 * Deactivate user account (remove packages, reset plan)
 */
async function deactivateUserAccount(
  userId: string | number,
  reason: 'payment_failed' | 'subscription_cancelled',
  metadata?: any
) {
  try {
    const user = await strapi.entityService.findOne('plugin::users-permissions.user', userId, {
      fields: ['id', 'packages', 'plan', 'stripeSubscriptionId']
    });

    if (!user) {
      console.error(`User not found: ${userId}`);
      return;
    }

    // Update user - remove packages and reset plan
    const updateData: any = {
      packages: [],
      plan: 'none'
    };

    // Optionally clear subscription ID if reason is cancellation
    if (reason === 'subscription_cancelled') {
      updateData.stripeSubscriptionId = null;
    }

    await strapi.entityService.update('plugin::users-permissions.user', userId, {
      data: updateData
    });

    console.log(`Account deactivated for user ${userId}, reason: ${reason}`);

    // Track deactivation event
    await strapi.service('api::analytics.analytics').trackEvent(userId.toString(), {
      event: 'account_deactivated',
      reason,
      metadata,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error(`Error deactivating account for user ${userId}:`, error);
    throw error;
  }
}
