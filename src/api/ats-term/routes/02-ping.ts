export default {
  routes: [
    { method: 'GET', path: '/ats-terms/ping', handler: 'bulk.ping', config: { auth: false } },
  ],
} as const;
