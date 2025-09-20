export default {
  routes: [
    {
      method: 'POST',
      path: '/cover-letters/generate',
      handler: 'cover-letter.generate',
      config: { auth: false } // self-auth inside controller
    },
    {
      method: 'POST',
      path: '/cover-letters/:id/complete',
      handler: 'cover-letter.complete',
      config: { auth: false } // guarded by x-cl-secret
    },
    {
      method: 'POST',
      path: '/cover-letters/:id/fail',
      handler: 'cover-letter.fail',
      config: { auth: false } // guarded by x-cl-secret
    }
  ]
};
