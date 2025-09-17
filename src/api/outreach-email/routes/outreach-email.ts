import { factories } from '@strapi/strapi';
import type { UID } from '@strapi/types';
const OUTREACH_UID = 'api::outreach-email.outreach-email' as UID.ContentType;

export default factories.createCoreRouter(OUTREACH_UID);
