import { factories } from '@strapi/strapi';

export default factories.createCoreRouter('api::application-note.application-note' as any, {
  config: {
    find: {
      auth: false, // We handle auth manually in controller
    },
    findOne: {
      auth: false, // We handle auth manually in controller
    },
    create: {
      auth: false, // We handle auth manually in controller
    },
    update: {
      auth: false, // We handle auth manually in controller
    },
    delete: {
      auth: false, // We handle auth manually in controller
    },
  },
});
