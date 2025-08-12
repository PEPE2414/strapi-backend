// config/server.js
module.exports = ({ env }) => ({
  host: '0.0.0.0',
  port: env.int('PORT', 1337),

  // Use the value you set in Railway (temporary Railway URL first, then your custom domain later).
  // Accept either URL or PUBLIC_URL to match different guides/envs.
  url: env('URL') || env('PUBLIC_URL') || undefined,

  proxy: true,
  app: { keys: env.array('APP_KEYS') },
});
