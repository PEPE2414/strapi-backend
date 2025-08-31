import { factories } from '@strapi/strapi';
const UID = 'api::ats-term.ats-term' as const;

export default factories.createCoreService(UID as any);
