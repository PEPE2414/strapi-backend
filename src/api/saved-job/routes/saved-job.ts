export default {
  type: 'content-api',
  routes: [
    { method: 'GET',    path: '/saved-jobs',     handler: 'savedtracker.find',     config: { policies: [] },
    { method: 'GET',    path: '/saved-jobs/:id', handler: 'savedtracker.findOne',  config: { policies: [] },
    { method: 'POST',   path: '/saved-jobs',     handler: 'savedtracker.create',   config: { policies: [] },
    { method: 'PUT',    path: '/saved-jobs/:id', handler: 'savedtracker.update',   config: { policies: [] },
    { method: 'DELETE', path: '/saved-jobs/:id', handler: 'savedtracker.delete',   config: { policies: [] },
  ],
};
