// config/plugins.ts
export default ({ env }) => ({
  encryption: {
    enabled: true,
    key: env('ENCRYPTION_KEY'),
  },
});
