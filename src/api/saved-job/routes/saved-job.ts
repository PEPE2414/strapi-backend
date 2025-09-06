export default {
  type: 'content-api',
  routes: [
    { method: 'GET',    path: '/saved-jobs',     handler: 'savedtracker.find',     config: { auth: false } },
    { method: 'GET',    path: '/saved-jobs/:id', handler: 'savedtracker.findOne',  config: { auth: false } },
    { method: 'POST',   path: '/saved-jobs',     handler: 'savedtracker.create',   config: { auth: false } },
    { method: 'PUT',    path: '/saved-jobs/:id', handler: 'savedtracker.update',   config: { auth: false } },
    { method: 'DELETE', path: '/saved-jobs/:id', handler: 'savedtracker.delete',   config: { auth: false } },
  ],
};
