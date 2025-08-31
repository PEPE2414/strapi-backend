import { factories } from '@strapi/strapi';

const UID = 'api::ats-term.ats-term' as const;

export default (factories.createCoreRouter as any)(UID, {
  config: {
    find:    { auth: false },
    findOne: { auth: false },
  },
});
