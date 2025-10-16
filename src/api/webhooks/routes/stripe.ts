// src/api/webhooks/routes/stripe.ts
export default {
  routes: [
    {
      method: 'POST',
      path: '/webhooks/stripe',
      handler: 'stripe.handleWebhook',
      config: {
        auth: false // Webhooks don't use JWT auth
      }
    }
  ]
};
