export default {
  type: 'content-api',
  routes: [
    { method: 'GET', path: '/ping', handler: 'health.ping', config: { auth: false } }
  ],
};
