// config/server.js
module.exports = ({ env }) => ({
  host: '0.0.0.0',
  port: env.int('PORT', 1337),

  // Use the value you set in Railway (temporary Railway URL first, then your custom domain later).
  // Accept either URL or PUBLIC_URL to match different guides/envs.
  url: env('URL') || env('PUBLIC_URL') || undefined,

  proxy: true,
  app: { keys: env.array('APP_KEYS', ['a5654b742c18fe0ba770100f45565a1c388dd3b54d8e3aceb9d2c52d78697763','e4b90338982a0d95f22740fda161aa54a73b68a1c66f402829e4706235fd4eba','178657ee0b4546aae42c13235fe9d2679171b7153fc558f897f5236cd81ea541','devkey425b877d72887a3ec3ac61c1379a5486b70fa9037f383ce79f8904a408db0b629']) },
});
