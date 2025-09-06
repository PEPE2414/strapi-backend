export default {
  type: 'content-api',
  routes: [
    // simple ping inside THIS API/controller to confirm resolution
    { method: 'GET', path: '/applications/ping', handler: 'api::application.apptracker.ping', config: { auth: false } },

    { method: 'GET',    path: '/applications',                handler: 'api::application.apptracker.find',       config: { auth: false } },
    { method: 'GET',    path: '/applications/:id',            handler: 'api::application.apptracker.findOne',    config: { auth: false } },
    { method: 'POST',   path: '/applications',                handler: 'api::application.apptracker.create',     config: { auth: false } },
    { method: 'PUT',    path: '/applications/:id',            handler: 'api::application.apptracker.update',     config: { auth: false } },
    { method: 'DELETE', path: '/applications/:id',            handler: 'api::application.apptracker.delete',     config: { auth: false } },

    { method: 'GET',    path: '/applications/stats',          handler: 'api::application.apptracker.stats',      config: { auth: false } },
    { method: 'GET',    path: '/applications/weekly',         handler: 'api::application.apptracker.weekly',     config: { auth: false } },
    { method: 'POST',   path: '/applications/:id/transition', handler: 'api::application.apptracker.transition', config: { auth: false } },
    { method: 'POST',   path: '/applications/:id/verify',     handler: 'api::application.apptracker.verify',     config: { auth: false } },

    { method: 'GET',    path: '/applications/whoami',         handler: 'api::application.apptracker.whoami',     config: { auth: false } },
  ],
};
