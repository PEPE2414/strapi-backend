// src/api/cover-letter/routes/cover-letter.ts
export default {
  routes: [
    // List current user's cover letters
    {
      method: 'GET',
      path: '/cover-letters',
      handler: 'api::cover-letter.cover-letter.find',
      config: { policies: ['global::is-authenticated'], middlewares: [] },
    },
    // Get one (owner)
    {
      method: 'GET',
      path: '/cover-letters/:id',
      handler: 'api::cover-letter.cover-letter.findOne',
      config: { policies: ['global::is-authenticated'], middlewares: [] },
    },
    // Create + forward to webhook
    {
      method: 'POST',
      path: '/cover-letters/generate',
      handler: 'api::cover-letter.cover-letter.generate',
      config: { policies: ['global::is-authenticated'], middlewares: [] },
    },
    // Mark complete / attach file (secret OR owner)
    {
      method: 'POST',
      path: '/cover-letters/:id/complete',
      handler: 'api::cover-letter.cover-letter.complete',
      config: { policies: [], middlewares: [] }, // auth checked inside controller (secret OR owner)
    },
  ],
};
