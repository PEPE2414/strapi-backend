export default {
  type: 'content-api',
  routes: [
    { method: 'GET',    path: '/saved-jobs',     handler: 'saved-job.find',
      config: { middlewares: ['global::with-user'] } },
    { method: 'GET',    path: '/saved-jobs/:id', handler: 'saved-job.findOne',
      config: { middlewares: ['global::with-user'] } },
    { method: 'POST',   path: '/saved-jobs',     handler: 'saved-job.create',
      config: { middlewares: ['global::with-user'] } },
    { method: 'PUT',    path: '/saved-jobs/:id', handler: 'saved-job.update',
      config: { middlewares: ['global::with-user'] } },
    { method: 'DELETE', path: '/saved-jobs/:id', handler: 'saved-job.delete',
      config: { middlewares: ['global::with-user'] } }
  ]
};
