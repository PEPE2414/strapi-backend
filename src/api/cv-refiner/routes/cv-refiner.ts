export default {
  routes: [
    {
      method: 'POST',
      path: '/cv-refiner/refine',
      handler: 'cvRefiner.refine',
      config: {
        policies: ['global::is-authenticated'],
      },
    },
  ],
};


