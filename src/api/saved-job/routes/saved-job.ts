export default {
  type: 'content-api',
  routes: [
    { method: 'GET',    path: '/saved-jobs',       handler: 'saved-job.find',     config: { policies: ['global::is-authenticated'] } },
    { method: 'GET',    path: '/saved-jobs/:id',   handler: 'saved-job.findOne',  config: { policies: ['global::is-authenticated'] } },
    { method: 'POST',   path: '/saved-jobs',       handler: 'saved-job.create',   config: { policies: ['global::is-authenticated'] } },
    { method: 'PUT',    path: '/saved-jobs/:id',   handler: 'saved-job.update',   config: { policies: ['global::is-authenticated'] } },
    { method: 'DELETE', path: '/saved-jobs/:id',   handler: 'saved-job.delete',   config: { policies: ['global::is-authenticated'] } }
  ]
};
