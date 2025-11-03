// backend/src/api/account/routes/account.ts
export default {
  routes: [
    {
      method: 'PUT',
      path: '/account/me',
      handler: 'account.updateMe',
      config: {
        // We verify the JWT inside the controller, so no public access here.
        // (No need to toggle any Strapi "Permissions" in Admin for this custom route.)
      },
    },
    {
      method: 'POST',
      path: '/account/start-trial',
      handler: 'account.startTrial',
      config: {
        // We verify the JWT inside the controller, so no public access here.
      },
    },
  ],
};
