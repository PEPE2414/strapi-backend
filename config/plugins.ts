// config/plugins.ts
export default ({ env }) => ({
  'users-permissions': {
    config: {
      register: {
        // Extra fields you want to allow on /auth/local/register
        allowedFields: ['preferredName', 'university', 'course', 'keyStats'],
      },
      jwt: { expiresIn: '7d' },
    },
  },
});
