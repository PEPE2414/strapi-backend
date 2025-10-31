export default {
  routes: [
    {
      method: 'POST',
      path: '/cv-refiner/refine',
      handler: 'cv-refiner.refine',
      config: {
        auth: false, // Bypass permission checks, verify auth in controller
        policies: [],
        middlewares: [],
      },
    },
    {
      method: 'GET',
      path: '/cv-refiner/me',
      handler: 'cv-refiner.me',
      config: {
        auth: false, // Bypass permission checks, verify auth in controller
        policies: [],
        middlewares: [],
      },
    },
    {
      method: 'POST',
      path: '/cv-refiner/complete',
      handler: 'cv-refiner.complete',
      config: {
        auth: false,
      },
    },
  ],
};


