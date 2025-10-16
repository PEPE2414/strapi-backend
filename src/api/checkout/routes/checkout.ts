// src/api/checkout/routes/checkout.ts
export default {
  routes: [
    {
      method: 'POST',
      path: '/checkout/session',
      handler: 'checkout.createSession',
      config: {
        auth: {
          scope: ['authenticated']
        }
      }
    }
  ]
};
