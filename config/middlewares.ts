// config/middlewares.js
module.exports = [
  'strapi::errors',
  {
    name: 'strapi::security',
    config: {
      contentSecurityPolicy: {
        useDefaults: true,
        directives: {
          // Allow API calls, images, and media via HTTPS/data/blob (uploads, etc.)
          'connect-src': ["'self'", 'https:', 'http:'],
          'img-src': ["'self'", 'data:', 'blob:', 'https:'],
          'media-src': ["'self'", 'data:', 'blob:', 'https:'],
          // Railway is HTTPS; we don't force upgrade here.
          'upgrade-insecure-requests': null,
        },
      },
    },
  },
  {
    name: 'strapi::cors',
    config: {
      // Allow your production domains + localhost,
      // and optionally any *.vercel.app preview if toggled via env.
      origin: (ctx) => {
        const allowList = [
          'http://localhost:3000',
          ...(process.env.FRONTEND_URLS || '')
            .split(',')
            .map(s => s.trim())
            .filter(Boolean),
        ];
        const origin = String(ctx.request.header.origin || '');
        if (
          process.env.ALLOW_VERCEL_PREVIEWS === 'true' &&
          /\.vercel\.app$/.test(origin)
        ) {
          return origin; // allow the specific preview domain making the request
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
