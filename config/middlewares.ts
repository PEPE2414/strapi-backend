// config/middlewares.ts
export default [
  'strapi::errors',

  {
    name: 'strapi::security',
    config: {
      contentSecurityPolicy: {
        useDefaults: true,
        directives: {
          // Keep this minimal to avoid duplicates with Helmet defaults
          'connect-src': ["'self'", 'https:', 'http:'],
          'img-src': ["'self'", 'data:', 'blob:', 'https:'],
          'media-src': ["'self'", 'data:', 'blob:', 'https:'],
          // DO NOT set 'upgrade-insecure-requests' here; Helmet adds it.
        },
      },
    },
  },

  {
    name: 'strapi::cors',
    config: {
      origin: (ctx) => {
        const allowList = [
          'http://localhost:3000',
          ...(process.env.FRONTEND_URLS || '')
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean),
        ];
        const origin = String(ctx.request.header.origin || '');
        if (
          process.env.ALLOW_VERCEL_PREVIEWS === 'true' &&
          /\.vercel\.app$/.test(origin)
        ) {
          return origin;
        }
        return allowList;
      },
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      headers: ['Content-Type', 'Authorization', 'Origin', 'Accept'],
      keepHeaderOnError: true,
    },
  },

  'strapi::poweredBy',
  'strapi::logger',
  'strapi::query',
  'strapi::body',
  'strapi::session',
  'strapi::favicon',
  'strapi::public',
];
