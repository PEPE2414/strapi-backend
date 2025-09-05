export default {
  type: 'content-api',
  routes: [
    { method: 'GET',    path: '/applications',                handler: 'application.find',       config: { auth: false } },
    { method: 'GET',    path: '/applications/:id',            handler: 'application.findOne',    config: { auth: false } },
    { method: 'POST',   path: '/applications',                handler: 'application.create',     config: { auth: false } },
    { method: 'PUT',    path: '/applications/:id',            handler: 'application.update',     config: { auth: false } },
    { method: 'DELETE', path: '/applications/:id',            handler: 'application.delete',     config: { auth: false } },

    { method: 'GET',    path: '/applications/stats',          handler: 'application.stats',      config: { auth: false } },
    { method: 'GET',    path: '/applications/weekly',         handler: 'application.weekly',     config: { auth: false } },
    { method: 'POST',   path: '/applications/:id/transition', handler: 'application.transition', config: { auth: false } },
    { method: 'POST',   path: '/applications/:id/verify',     handler: 'application.verify',     config: { auth: false } },

    // Debug probe
    { method: 'GET',    path: '/applications/whoami',         handler: 'application.whoami',     config: { auth: false } },
  ],
};
