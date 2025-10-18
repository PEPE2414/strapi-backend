// strapi-backend/src/api/audio-analysis/routes/audio-analysis.ts
'use strict';

import { factories } from '@strapi/strapi';

export default factories.createCoreRouter('api::audio-analysis.audio-analysis');

// Custom routes for audio analysis
export const customRoutes = [
  {
    method: 'POST',
    path: '/audio-analysis/process',
    handler: 'audio-analysis.processAudio',
    config: {
      auth: false, // Manual JWT verification in controller
      policies: [],
      middlewares: []
    }
  },
  {
    method: 'GET',
    path: '/audio-analysis/history',
    handler: 'audio-analysis.getHistory',
    config: {
      auth: false, // Manual JWT verification in controller
      policies: [],
      middlewares: []
    }
  }
];
