import { factories } from '@strapi/strapi';

const UID = 'api::ats-term.ats-term' as const;

// Cast to any so TS doesn't require generated ContentType typings yet.
export default (factories.createCoreController as any)(UID);
