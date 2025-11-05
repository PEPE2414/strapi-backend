// src/api/webhooks/routes/account-activation.ts
export default {
  routes: [
    {
      method: 'POST',
      path: '/webhooks/account-activation',
      handler: 'account-activation.activateAccount',
      config: {
        auth: false // Uses webhook secret instead
      }
    }
  ]
};

