import { stripe } from '../../../utils/stripe';

type JWTPayload = { id?: number; sub?: number };

export default {
  async updateMe(ctx) {
    // 1) Extract bearer token
    const auth = ctx.request.header.authorization || '';
    const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;
    if (!token) {
      return ctx.unauthorized('Missing Authorization header');
    }

    // 2) Verify via users-permissions JWT service
    let payload: JWTPayload | undefined;
    try {
      const jwtService = (strapi as any).plugin('users-permissions').service('jwt');
      payload = await jwtService.verify(token);
    } catch {
      return ctx.unauthorized('Invalid token');
    }

    const userId = payload?.id ?? payload?.sub;
    if (!userId) {
      return ctx.unauthorized('Invalid token payload');
    }

    // 3) Validate input
    const body = ctx.request.body || {};
    const { jobPrefs } = body;
    if (jobPrefs !== undefined && typeof jobPrefs !== 'object') {
      return ctx.badRequest('jobPrefs must be an object');
    }

    // 4) Update only jobPrefs on the authenticated user
    try {
      const updated = await (strapi as any).entityService.update(
        'plugin::users-permissions.user',
        userId,
        { data: { jobPrefs } }
      );

      ctx.body = {
        ok: true,
        user: {
          id: updated.id,
          username: updated.username,
          email: updated.email,
          jobPrefs: updated.jobPrefs ?? null,
        },
      };
    } catch (err) {
      (strapi as any).log.error('updateMe error', err);
      ctx.throw(500, 'Failed to update preferences');
    }
  },

  async startTrial(ctx) {
    // 1) Extract bearer token
    const auth = ctx.request.header.authorization || '';
    const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;
    if (!token) {
      return ctx.unauthorized('Missing Authorization header');
    }

    // 2) Verify via users-permissions JWT service
    let payload: JWTPayload | undefined;
    try {
      const jwtService = (strapi as any).plugin('users-permissions').service('jwt');
      payload = await jwtService.verify(token);
    } catch {
      return ctx.unauthorized('Invalid token');
    }

    const userId = payload?.id ?? payload?.sub;
    if (!userId) {
      return ctx.unauthorized('Invalid token payload');
    }

    try {
      // 3) Get current user to check if they already have a plan or trial
      const user = await (strapi as any).entityService.findOne(
        'plugin::users-permissions.user',
        userId
      );

      // 4) Check if user already has a plan or packages
      if (user.plan && user.plan !== 'none') {
        return ctx.badRequest('You already have an active plan');
      }

      const packagesArr = Array.isArray(user.packages) ? user.packages : [];
      if (packagesArr.length > 0) {
        return ctx.badRequest('You already have an active plan');
      }

      // 5) Check if user already has an active trial
      if (user.trialActive && user.trialEndsAt) {
        const trialEndsAt = new Date(user.trialEndsAt);
        const now = new Date();
        if (trialEndsAt > now) {
          return ctx.badRequest('You already have an active trial');
        }
      }

      // 6) Start new trial: 14 days from now
      const trialEndsAt = new Date();
      trialEndsAt.setDate(trialEndsAt.getDate() + 14);

      const updated = await (strapi as any).entityService.update(
        'plugin::users-permissions.user',
        userId,
        {
          data: {
            trialActive: true,
            trialEndsAt: trialEndsAt.toISOString(),
            trialLimits: {
              coverLetters: 10,
              recruiterLookups: 10,
              savedJobs: 20,
            },
          },
        }
      );

      ctx.body = {
        ok: true,
        user: {
          id: updated.id,
          trialActive: updated.trialActive,
          trialEndsAt: updated.trialEndsAt,
          trialLimits: updated.trialLimits,
        },
      };
    } catch (err) {
      (strapi as any).log.error('startTrial error', err);
      ctx.throw(500, 'Failed to start trial');
    }
  },

  async getBillingSummary(ctx) {
    // 1) Extract bearer token
    const auth = ctx.request.header.authorization || '';
    const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;
    if (!token) {
      return ctx.unauthorized('Missing Authorization header');
    }

    // 2) Verify via users-permissions JWT service
    let payload: JWTPayload | undefined;
    try {
      const jwtService = (strapi as any).plugin('users-permissions').service('jwt');
      payload = await jwtService.verify(token);
    } catch {
      return ctx.unauthorized('Invalid token');
    }

    const userId = payload?.id ?? payload?.sub;
    if (!userId) {
      return ctx.unauthorized('Invalid token payload');
    }

    try {
      const user = await (strapi as any).entityService.findOne(
        'plugin::users-permissions.user',
        userId,
        {}
      );

      if (!user) {
        return ctx.notFound('User not found');
      }

      const summary: any = {
        plan: {
          slug: user.plan || null,
          status: 'inactive',
          nickname: null,
          productName: null,
          amount: null,
          currency: null,
          interval: null,
          intervalCount: null,
          currentPeriodEnd: null,
          trialEnd: null,
          startedAt: null,
          cancelAtPeriodEnd: false,
        },
        paymentMethod: null,
        customerPortalUrl: null,
        meta: {
          stripeCustomerId: user.stripeCustomerId || null,
          stripeSubscriptionId: user.stripeSubscriptionId || null,
          subscriptionStatus: null,
          fetchedAt: new Date().toISOString(),
        },
        trial: user.trialActive
          ? {
              active: !!user.trialActive,
              endsAt: user.trialEndsAt,
            }
          : null,
        packages: Array.isArray(user.packages) ? user.packages : [],
      };

      let subscription: any = null;

      if (user.stripeSubscriptionId) {
        try {
          subscription = await stripe.subscriptions.retrieve(user.stripeSubscriptionId, {
            expand: [
              'default_payment_method',
              'items.data.price.product',
              'latest_invoice.payment_intent',
            ],
          });
        } catch (error) {
          (strapi as any).log.error(
            `getBillingSummary: Failed to retrieve subscription ${user.stripeSubscriptionId}`,
            error
          );
        }
      }

      if (subscription) {
        const price = subscription.items?.data?.[0]?.price;
        const product = price?.product as any;
        const amount =
          typeof price?.unit_amount === 'number'
            ? price.unit_amount
            : price?.unit_amount_decimal
              ? Number(price.unit_amount_decimal)
              : null;

        summary.plan = {
          slug: user.plan || subscription.metadata?.package_slug || null,
          status: subscription.status || 'inactive',
          nickname: price?.nickname || null,
          productName: product?.name || null,
          amount,
          currency: price?.currency || null,
          interval: price?.recurring?.interval || null,
          intervalCount: price?.recurring?.interval_count || null,
          currentPeriodEnd: subscription.current_period_end
            ? new Date(subscription.current_period_end * 1000).toISOString()
            : null,
          trialEnd: subscription.trial_end
            ? new Date(subscription.trial_end * 1000).toISOString()
            : null,
          startedAt: subscription.start_date
            ? new Date(subscription.start_date * 1000).toISOString()
            : null,
          cancelAtPeriodEnd: !!subscription.cancel_at_period_end,
        };

        summary.meta.subscriptionStatus = subscription.status || null;
      }

      let paymentMethod: any = null;
      try {
        if (subscription?.default_payment_method) {
          if (typeof subscription.default_payment_method === 'string') {
            paymentMethod = await stripe.paymentMethods.retrieve(
              subscription.default_payment_method
            );
          } else {
            paymentMethod = subscription.default_payment_method;
          }
        } else if (subscription?.customer) {
          const customerId =
            typeof subscription.customer === 'string'
              ? subscription.customer
              : subscription.customer.id;

          const customerRaw = await stripe.customers.retrieve(customerId, {
            expand: ['invoice_settings.default_payment_method'],
          });

          const customer: any = (customerRaw as any)?.deleted ? null : (customerRaw as any);
          const defaultPm = customer?.invoice_settings?.default_payment_method;

          if (defaultPm) {
            if (typeof defaultPm === 'string') {
              paymentMethod = await stripe.paymentMethods.retrieve(defaultPm);
            } else {
              paymentMethod = defaultPm;
            }
          } else if (customer) {
            const methods = await stripe.paymentMethods.list({
              customer: customerId,
              type: 'card',
              limit: 1,
            });
            paymentMethod = methods.data[0] || null;
          }
        }
      } catch (pmError) {
        (strapi as any).log.warn('getBillingSummary: Failed to load payment method', pmError);
      }

      if (paymentMethod) {
        summary.paymentMethod = {
          brand: paymentMethod.card?.brand || null,
          last4: paymentMethod.card?.last4 || null,
          expMonth: paymentMethod.card?.exp_month || null,
          expYear: paymentMethod.card?.exp_year || null,
          billingName: paymentMethod.billing_details?.name || null,
          billingEmail: paymentMethod.billing_details?.email || null,
        };
      }

      if (user.stripeCustomerId) {
        const frontendUrl = process.env.FRONTEND_URL;

        if (frontendUrl) {
          try {
            const trimmedFrontend = frontendUrl.replace(/\/$/, '');
            const normalisedReturnUrl =
              trimmedFrontend.startsWith('http://') || trimmedFrontend.startsWith('https://')
                ? `${trimmedFrontend}/app/settings?tab=billing`
                : `https://${trimmedFrontend}/app/settings?tab=billing`;

            const portalSession = await stripe.billingPortal.sessions.create({
              customer: user.stripeCustomerId,
              return_url: normalisedReturnUrl,
            });

            summary.customerPortalUrl = portalSession.url;
          } catch (portalError) {
            (strapi as any).log.warn(
              `getBillingSummary: Failed to create billing portal session for customer ${user.stripeCustomerId}`,
              portalError
            );
          }
        } else {
          (strapi as any).log.warn(
            'getBillingSummary: FRONTEND_URL environment variable is not set'
          );
        }
      }

      ctx.body = summary;
    } catch (err) {
      (strapi as any).log.error('getBillingSummary error', err);
      ctx.throw(500, 'Failed to load billing summary');
    }
  },
};
