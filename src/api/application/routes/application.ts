export default {
  type: 'content-api',
  routes: [
    // 🔎 Specific routes FIRST (so they don't get captured by :id)
    { method: 'GET',  path: '/applications/ping',    handler: 'api::application.apptracker.ping',    config: { auth: true } },
    { method: 'GET',  path: '/applications/whoami',  handler: 'api::application.apptracker.whoami',  config: { auth: true } },
    { method: 'GET',  path: '/applications/stats',   handler: 'api::application.apptracker.stats',   config: { auth: true } },
    { method: 'GET',  path: '/applications/weekly',  handler: 'api::application.apptracker.weekly',  config: { auth: true } },
    { method: 'POST', path: '/applications/:id/transition', handler: 'api::application.apptracker.transition', config: { auth: true } },
    { method: 'POST', path: '/applications/:id/verify',     handler: 'api::application.apptracker.verify',     config: { auth: true } },

    // 📦 Generic CRUD after
    { method: 'GET',    path: '/applications',     handler: 'api::application.apptracker.find',     config: { auth: true } },
    { method: 'GET',    path: '/applications/:id', handler: 'api::application.apptracker.findOne',  config: { auth: true } },
    { method: 'POST',   path: '/applications',     handler: 'api::application.apptracker.create',   config: { auth: true } },
    { method: 'PUT',    path: '/applications/:id', handler: 'api::application.apptracker.update',   config: { auth: true } },
    { method: 'DELETE', path: '/applications/:id', handler: 'api::application.apptracker.delete',   config: { auth: true } },
  ],
};
