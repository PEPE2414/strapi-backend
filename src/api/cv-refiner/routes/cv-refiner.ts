export default {
  routes: [
    {
      method: 'POST',
      path: '/cv-refiner/refine',
      handler: 'cv-refiner.refine',
      config: {
        policies: ['global::is-authenticated'],
      },
    },
    {
      method: 'GET',
      path: '/cv-refiner/me',
      handler: 'cv-refiner.me',
      config: {
        policies: ['global::is-authenticated'],
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


