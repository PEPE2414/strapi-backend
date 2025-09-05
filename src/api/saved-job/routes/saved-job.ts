export default {
  type: 'content-api', // ✅ content API
  routes: [
    {
      method: 'GET',
      path: '/saved-jobs',
      handler: 'saved-job.find',
      config: { policies: ['plugin::users-permissions.isAuthenticated'] }
    },
    {
      method: 'GET',
      path: '/saved-jobs/:id',
      handler: 'saved-job.findOne',
      config: { policies: ['plugin::users-permissions.isAuthenticated'] }
    },
    {
      method: 'POST',
      path: '/saved-jobs',
      handler: 'saved-job.create',
      config: { policies: ['plugin::users-permissions.isAuthenticated'] }
    },
    {
      method: 'PUT',
      path: '/saved-jobs/:id',
      handler: 'saved-job.update',
      config: { policies: ['plugin::users-permissions.isAuthenticated'] }
    },
    {
      method: 'DELETE',
      path: '/saved-jobs/:id',
      handler: 'saved-job.delete',
      config: { policies: ['plugin::users-permissions.isAuthenticated'] }
    }
  ]
};
