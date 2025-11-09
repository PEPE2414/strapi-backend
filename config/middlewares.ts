// config/middlewares.ts
export default [
  'strapi::errors',

  {
    name: 'strapi::security',
    config: {
      contentSecurityPolicy: {
        useDefaults: true,
        directives: {
          'connect-src': ["'self'", 'https:', 'http:'],
          'img-src': ["'self'", 'data:', 'blob:', 'https:'],
          'media-src': ["'self'", 'data:', 'blob:', 'https:'],
        },
      },
    },
  },

{
  name: 'strapi::cors',
  config: {
    origin: (ctx) => {
      const requestOrigin = String(ctx.request.header.origin || '');
      const allowList = new Set([
        'https://www.effort-free.co.uk',
        'https://effort-free.co.uk',
        'http://localhost:3000',
      ]);

      // Allow Vercel previews dynamically if toggled
      if (
        process.env.ALLOW_VERCEL_PREVIEWS === 'true' &&
        requestOrigin &&
        /^https:\/\/[a-z0-9-]+\.vercel\.app$/i.test(requestOrigin)
      ) {
        return requestOrigin; // must be a single string (NOT an array, NOT '*')
      }

      // Prod/local: return the exact request origin if allowed
      if (allowList.has(requestOrigin)) {
        return requestOrigin;
      }

      // Otherwise: return empty string => no CORS header
      return '';
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
  {
    name: 'strapi::body',
    config: {
      includeUnparsed: true,
    },
  },

  // IMPORTANT: trust proxy so secure cookies work behind HTTPS terminators
  {
    name: 'strapi::session',
    config: {
      key: 'strapi.sid',
      httpOnly: true,
      sameSite: 'lax',
      secure: true,   // keep secure cookies in prod
      proxy: true,    // <— tells koa-session to trust X-Forwarded-Proto
    },
  },

  'strapi::favicon',
  'global::with-jwt-id',
  'strapi::public',
];
