export default {
  routes: [
    { method: 'POST', path: '/cover-letters/generate', handler: 'cover-letter.generate' },
    { method: 'POST', path: '/cover-letters/:id/complete', handler: 'cover-letter.complete' },
    { method: 'POST', path: '/cover-letters/:id/fail', handler: 'cover-letter.fail' }
  ]
};
