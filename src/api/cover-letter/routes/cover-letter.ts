export default {
  routes: [
    // Core reads
    { 
      method: 'GET', 
      path: '/cover-letters', 
      handler: 'cover-letter.find',
      config: { 
        auth: false,
        policies: [],
        middlewares: []
      }
    },
    { 
      method: 'GET', 
      path: '/cover-letters/:id', 
      handler: 'cover-letter.findOne',
      config: { 
        auth: false,
        policies: [],
        middlewares: []
      }
    },

    // Custom actions
    { 
      method: 'POST', 
      path: '/cover-letters/generate', 
      handler: 'cover-letter.generate',
      config: { 
        auth: false,
        policies: [],
        middlewares: []
      }
    },
    { 
      method: 'POST', 
      path: '/cover-letters/:id/complete', 
      handler: 'cover-letter.complete',
      config: { 
        auth: false,
        policies: [],
        middlewares: []
      }
    },
    { 
      method: 'POST', 
      path: '/cover-letters/:id/fail', 
      handler: 'cover-letter.fail',
      config: { 
        auth: false,
        policies: [],
        middlewares: []
      }
    }
  ]
};
