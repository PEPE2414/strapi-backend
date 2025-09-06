export default {
  type: 'content-api',
  routes: [
    { method: 'GET',    path: '/applications',                handler: 'apptracker.find',       config: { auth: false } },
    { method: 'GET',    path: '/applications/:id',            handler: 'apptracker.findOne',    config: { auth: false } },
    { method: 'POST',   path: '/applications',                handler: 'apptracker.create',     config: { auth: false } },
    { method: 'PUT',    path: '/applications/:id',            handler: 'apptracker.update',     config: { auth: false } },
    { method: 'DELETE', path: '/applications/:id',            handler: 'apptracker.delete',     config: { auth: false } },

    { method: 'GET',    path: '/applications/stats',          handler: 'apptracker.stats',      config: { auth: false } },
    { method: 'GET',    path: '/applications/weekly',         handler: 'apptracker.weekly',     config: { auth: false } },
    { method: 'POST',   path: '/applications/:id/transition', handler: 'apptracker.transition', config: { auth: false } },
    { method: 'POST',   path: '/applications/:id/verify',     handler: 'apptracker.verify',     config: { auth: false } },

    // Debug probe
    { method: 'GET',    path: '/applications/whoami',         handler: 'apptracker.whoami',     config: { auth: false } },
  ],
};
