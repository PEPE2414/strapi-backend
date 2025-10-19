/**
 * Error Handler Webhook Routes
 */

export default {
  routes: [
    {
      method: 'POST',
      path: '/webhooks/error-handler',
      handler: 'error-handler.handleError',
      config: {
        auth: false // Webhooks don't use JWT auth
      }
    }
  ]
};
