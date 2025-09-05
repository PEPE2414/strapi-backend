export default {
  type: 'content-api',
  routes: [
    { method: 'GET',    path: '/applications',              handler: 'application.find',      config: { policies: ['global::is-authenticated'] } },
    { method: 'GET',    path: '/applications/:id',          handler: 'application.findOne',   config: { policies: ['global::is-authenticated'] } },
    { method: 'POST',   path: '/applications',              handler: 'application.create',    config: { policies: ['global::is-authenticated'] } },
    { method: 'PUT',    path: '/applications/:id',          handler: 'application.update',    config: { policies: ['global::is-authenticated'] } },
    { method: 'DELETE', path: '/applications/:id',          handler: 'application.delete',    config: { policies: ['global::is-authenticated'] } },
    { method: 'GET',    path: '/applications/stats',        handler: 'application.stats',     config: { policies: ['global::is-authenticated'] } },
    { method: 'GET',    path: '/applications/weekly',       handler: 'application.weekly',    config: { policies: ['global::is-authenticated'] } },
    { method: 'POST',   path: '/applications/:id/transition', handler: 'application.transition', config: { policies: ['global::is-authenticated'] } },
    { method: 'POST',   path: '/applications/:id/verify',   handler: 'application.verify',    config: { policies: ['global::is-authenticated'] } }
  ]
};
