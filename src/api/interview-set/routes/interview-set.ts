export default {
  routes: [
    { 
      method: 'GET', 
      path: '/interview-sets/me', 
      handler: 'interview-set.listMine', 
      config: { 
        auth: false,
        policies: [],
        middlewares: []
      } 
    },
    { 
      method: 'POST', 
      path: '/interview-sets/generate', 
      handler: 'interview-set.generate', 
      config: { 
        auth: false,
        policies: [],
        middlewares: []
      } 
    }
  ]
};
