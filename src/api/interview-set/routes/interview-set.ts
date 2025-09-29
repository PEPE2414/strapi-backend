export default {
  routes: [
    { method: 'GET', path: '/interview-sets/me', handler: 'interview-set.listMine', config: { policies: ['global::is-authenticated'] } },
    { method: 'POST', path: '/interview-sets/generate', handler: 'interview-set.generate', config: { policies: ['global::is-authenticated'] } }
  ]
};
