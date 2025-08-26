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

      // Allowed list from env
      const allowList = [
        'http://localhost:3000',
        ...(process.env.FRONTEND_URLS || '')
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean),
      ];

      // Allow dynamic Vercel previews if toggled
      if (
        process.env.ALLOW_VERCEL_PREVIEWS === 'true' &&
        /\.vercel\.app$/.test(requestOrigin)
      ) {
        return requestOrigin; // must return a single origin string
      }

      // For production, return the exact origin if it’s allowed
      if (allowList.includes(requestOrigin)) {
        return requestOrigin;
      }

      // Otherwise, disable CORS for this origin
      return ''; // returning empty string = no Access-Control-Allow-Origin header
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
  'strapi::public',
];
