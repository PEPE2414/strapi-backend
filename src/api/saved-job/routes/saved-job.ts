export default {
  type: 'content-api',
  routes: [
    { method: 'GET',    path: '/saved-jobs',     handler: 'savedtracker.find',     config: { auth: true } },
    { method: 'GET',    path: '/saved-jobs/:id', handler: 'savedtracker.findOne',  config: { auth: true } },
    { method: 'POST',   path: '/saved-jobs',     handler: 'savedtracker.create',   config: { auth: true } },
    { method: 'PUT',    path: '/saved-jobs/:id', handler: 'savedtracker.update',   config: { auth: true } },
    { method: 'DELETE', path: '/saved-jobs/:id', handler: 'savedtracker.delete',   config: { auth: true } },
  ],
};
