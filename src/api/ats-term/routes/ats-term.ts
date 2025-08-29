import { factories } from '@strapi/strapi';

export default factories.createCoreRouter('api::ats-term.ats-term', {
  config: {
    find:    { auth: false }, // GET /api/ats-terms
    findOne: { auth: false }, // GET /api/ats-terms/:id
  },
});
