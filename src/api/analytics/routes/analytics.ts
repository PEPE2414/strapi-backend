// src/api/analytics/routes/analytics.ts
export default {
  routes: [
    {
      method: 'GET',
      path: '/analytics/usage',
      handler: 'analytics.getMyUsage',
      config: {
        auth: false // Manual JWT verification in controller
      }
    },
    {
      method: 'GET',
      path: '/analytics/my-analytics',
      handler: 'analytics.getMyAnalytics',
      config: {
        auth: false // Manual JWT verification in controller
      }
    },
    {
      method: 'GET',
      path: '/analytics/churn',
      handler: 'analytics.getChurnMetrics',
      config: {
        auth: false // Manual JWT verification in controller
      }
    }
  ]
};

