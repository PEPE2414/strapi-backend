// src/api/profile/routes/profile.ts
export default {
  routes: [
    {
      method: 'PUT',
      path: '/user/profile',
      handler: 'api::profile.profile.updateProfile',
      config: { auth: true }, // requires JWT
    },
  ],
};
