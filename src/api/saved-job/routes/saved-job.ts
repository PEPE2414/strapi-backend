export default {
  type: 'content-api',
  routes: [
    { method: 'GET',    path: '/saved-jobs',     handler: 'saved-job.find',     config: { auth: false } },
    { method: 'GET',    path: '/saved-jobs/:id', handler: 'saved-job.findOne',  config: { auth: false } },
    { method: 'POST',   path: '/saved-jobs',     handler: 'saved-job.create',   config: { auth: false } },
    { method: 'PUT',    path: '/saved-jobs/:id', handler: 'saved-job.update',   config: { auth: false } },
    { method: 'DELETE', path: '/saved-jobs/:id', handler: 'saved-job.delete',   config: { auth: false } },
  ],
};
