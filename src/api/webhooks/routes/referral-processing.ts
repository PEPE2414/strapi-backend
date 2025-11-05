// src/api/webhooks/routes/referral-processing.ts
export default {
  routes: [
    {
      method: 'POST',
      path: '/webhooks/referral-processing',
      handler: 'referral-processing.processReferral',
      config: {
        auth: false // Uses webhook secret instead
      }
    }
  ]
};

