export default {
  type: 'content-api',
  routes: [
    { method: 'GET',    path: '/applications',                handler: 'application.find',
      config: { middlewares: ['global::with-user'] } },
    { method: 'GET',    path: '/applications/:id',            handler: 'application.findOne',
      config: { middlewares: ['global::with-user'] } },
    { method: 'POST',   path: '/applications',                handler: 'application.create',
      config: { middlewares: ['global::with-user'] } },
    { method: 'PUT',    path: '/applications/:id',            handler: 'application.update',
      config: { middlewares: ['global::with-user'] } },
    { method: 'DELETE', path: '/applications/:id',            handler: 'application.delete',
      config: { middlewares: ['global::with-user'] } },
    { method: 'GET',    path: '/applications/stats',          handler: 'application.stats',
      config: { middlewares: ['global::with-user'] } },
    { method: 'GET',    path: '/applications/weekly',         handler: 'application.weekly',
      config: { middlewares: ['global::with-user'] } },
    { method: 'POST',   path: '/applications/:id/transition', handler: 'application.transition',
      config: { middlewares: ['global::with-user'] } },
    { method: 'POST',   path: '/applications/:id/verify',     handler: 'application.verify',
      config: { middlewares: ['global::with-user'] } },

    // TEMP: whoami debug (no policy) — remove after testing
    { method: 'GET',    path: '/applications/whoami',         handler: 'application.whoami' }
  ]
};
