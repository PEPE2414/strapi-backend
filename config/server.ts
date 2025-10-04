// config/server.ts
export default ({ env }) => ({
  host: '0.0.0.0',
  port: env.int('PORT', 1337),

  // Base public URL of your Strapi app (NO trailing slash; NO paths)
  url: env('URL') || env('PUBLIC_URL'),

  // Trust X-Forwarded-* headers from the platform proxy
  proxy: true,

  app: {
    // Don’t hard-code keys; read from env in Railway
    keys: env.array('APP_KEYS'),
  },

});
