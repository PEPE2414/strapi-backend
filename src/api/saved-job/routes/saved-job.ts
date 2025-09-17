export default {
  type: 'content-api',
  routes: [
    { method: 'GET',    path: '/saved-jobs',     handler: 'savedtracker.find', 
    { method: 'GET',    path: '/saved-jobs/:id', handler: 'savedtracker.findOne', 
    { method: 'POST',   path: '/saved-jobs',     handler: 'savedtracker.create',  
    { method: 'PUT',    path: '/saved-jobs/:id', handler: 'savedtracker.update',  
    { method: 'DELETE', path: '/saved-jobs/:id', handler: 'savedtracker.delete',  
  ],
};
