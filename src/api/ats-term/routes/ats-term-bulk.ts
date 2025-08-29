// src/api/ats-term/routes/ats-term-bulk.ts
export default {
  routes: [
    {
      method: 'POST',
      path: '/ats-terms/bulk',
      handler: 'api::ats-term.bulk.bulkUpsert',
      config: { auth: { required: false } } // protected by header secret
    },
  ],
};
