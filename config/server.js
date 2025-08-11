// config/server.js
module.exports = ({ env }) => {
  const keys = env.array('APP_KEYS', [
    'k1_default','k2_default','k3_default','k4_default'
  ]);

  return {
    host: '0.0.0.0',
    port: env.int('PORT', 1337),
    url: env('PUBLIC_URL', 'https://api.effort-free.co.uk'),
    proxy: true,
    app: { keys },
  };
};
