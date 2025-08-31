export default {
  routes: [
    { method: 'POST', path: '/ats-terms/bulk', handler: 'bulk.bulkUpsert', config: { auth: false } },
  ],
} as const;
