/**
 * LinkedIn Results Webhook Routes
 */

export default {
  routes: [
    {
      method: 'POST',
      path: '/webhooks/linkedin-results',
      handler: 'linkedin-results.handleLinkedInResults',
      config: {
        auth: false, // Webhooks don't use JWT auth
        policies: [],
        middlewares: [],
      }
    }
  ]
};
