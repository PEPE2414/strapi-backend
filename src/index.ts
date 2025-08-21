// src/index.ts
import type { Core } from '@strapi/strapi';

export default {
  register({ strapi }: { strapi: Core.Strapi }) {
    // Ensure Koa trusts the reverse proxy for HTTPS detection
    strapi.server.app.proxy = true;
  },
  bootstrap() {},
};
