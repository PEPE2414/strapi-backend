import { factories } from '@strapi/strapi';

// Default built-in questions with their target word counts
const DEFAULT_QUESTIONS = [
  { id: 'why-company', label: 'Why this company?', tags: ['motivation'], target: 150, text: '', history: [], pinned: false, builtin: true },
  { id: 'why-role', label: 'Why this role or programme?', tags: ['motivation'], target: 150, text: '', history: [], pinned: false, builtin: true },
  { id: 'strength', label: 'Strength questions', tags: ['competency'], target: 200, text: '', history: [], pinned: false, builtin: true },
  { id: 'values-fit', label: 'Values fit', tags: ['culture'], target: 150, text: '', history: [], pinned: false, builtin: true },
  { id: 'star-teamwork', label: 'Top skills or examples (STAR) – Teamwork', tags: ['star', 'competency'], target: 250, text: '', history: [], pinned: false, builtin: true },
  { id: 'star-leadership', label: 'Top skills or examples (STAR) – Leadership', tags: ['star', 'competency'], target: 250, text: '', history: [], pinned: false, builtin: true },
  { id: 'star-problem-solving', label: 'Top skills or examples (STAR) – Problem solving', tags: ['star', 'competency'], target: 250, text: '', history: [], pinned: false, builtin: true },
  { id: 'diversity-inclusion', label: 'Diversity and inclusion contribution', tags: ['values'], target: 200, text: '', history: [], pinned: false, builtin: true },
  { id: 'failure-learning', label: 'Failure or learning example', tags: ['growth'], target: 200, text: '', history: [], pinned: false, builtin: true },
  { id: 'ethical-judgement', label: 'Ethical judgement or integrity example', tags: ['values'], target: 200, text: '', history: [], pinned: false, builtin: true },
  { id: 'time-pressure', label: 'Time pressure or prioritisation example', tags: ['competency'], target: 200, text: '', history: [], pinned: false, builtin: true },
  { id: 'customer-focus', label: 'Customer or client focus example', tags: ['competency'], target: 200, text: '', history: [], pinned: false, builtin: true },
  { id: 'anything-else', label: 'Anything else they usually ask (freeform)', tags: ['general'], target: 300, text: '', history: [], pinned: false, builtin: true }
];

export default factories.createCoreController('api::application-note.application-note' as any, ({ strapi }) => ({
  /**
   * GET /api/application-notes/me
   * Returns the current user's application notes, creating a default set if none exists
   */
  async me(ctx) {
    const authHeader = ctx.request.header.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return ctx.unauthorized('Authentication required');
    }
    
    const token = authHeader.slice(7);
    let user = null;
    
    try {
      const jwtService = strapi.plugin('users-permissions').service('jwt');
      user = await jwtService.verify(token);
    } catch (jwtError) {
      return ctx.unauthorized('Invalid token');
    }

    // Ensure userId is a number
    const userId = Number(user.id);
    
    if (!userId || !Number.isInteger(userId)) {
      strapi.log.error(`[application-note] Invalid user ID: ${user.id} (type: ${typeof user.id})`);
      return ctx.badRequest('Invalid user ID');
    }

    // Try to find existing application note for this user
    let applicationNote = await strapi.db.query('api::application-note.application-note').findOne({
      where: { user: userId },
    });

    // If no existing note, create one with default questions
    if (!applicationNote) {
      applicationNote = await strapi.entityService.create('api::application-note.application-note' as any, {
        data: {
          user: userId,
          questions: DEFAULT_QUESTIONS,
        },
      });
    }

    ctx.body = { data: applicationNote };
  },

  /**
   * PUT /api/application-notes/me
   * Updates the current user's application notes
   * Body: { questions: Question[] }
   */
  async updateMe(ctx) {
    const authHeader = ctx.request.header.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return ctx.unauthorized('Authentication required');
    }
    
    const token = authHeader.slice(7);
    let user = null;
    
    try {
      const jwtService = strapi.plugin('users-permissions').service('jwt');
      user = await jwtService.verify(token);
    } catch (jwtError) {
      return ctx.unauthorized('Invalid token');
    }

    // Ensure userId is a number
    const userId = Number(user.id);
    
    if (!userId || !Number.isInteger(userId)) {
      strapi.log.error(`[application-note] Invalid user ID in updateMe: ${user.id} (type: ${typeof user.id})`);
      return ctx.badRequest('Invalid user ID');
    }

    const { questions } = ctx.request.body || {};
    if (!questions || !Array.isArray(questions)) {
      return ctx.badRequest('questions array is required');
    }

    // Validate questions structure
    for (const question of questions) {
      if (!question.id || !question.label || typeof question.builtin !== 'boolean') {
        return ctx.badRequest('Each question must have id, label, and builtin fields');
      }
    }

    // Find existing application note
    let applicationNote = await strapi.db.query('api::application-note.application-note').findOne({
      where: { user: userId },
    });

    // Create if doesn't exist
    if (!applicationNote) {
      applicationNote = await strapi.entityService.create('api::application-note.application-note' as any, {
        data: {
          user: userId,
          questions: questions,
        },
      });
    } else {
      // Update existing
      applicationNote = await strapi.entityService.update('api::application-note.application-note' as any, applicationNote.id, {
        data: {
          questions: questions,
        } as any,
      });
    }

    ctx.body = { data: applicationNote };
  },

  /**
   * Override default find to ensure users can only access their own notes
   */
  async find(ctx) {
    const authHeader = ctx.request.header.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return ctx.unauthorized('Authentication required');
    }
    
    const token = authHeader.slice(7);
    let user = null;
    
    try {
      const jwtService = strapi.plugin('users-permissions').service('jwt');
      user = await jwtService.verify(token);
    } catch (jwtError) {
      return ctx.unauthorized('Invalid token');
    }

    // Ensure userId is a number
    const userId = Number(user.id);
    
    if (!userId || !Number.isInteger(userId)) {
      strapi.log.error(`[application-note] Invalid user ID in find: ${user.id} (type: ${typeof user.id})`);
      return ctx.badRequest('Invalid user ID');
    }

    // Only return the current user's application note
    const applicationNote = await strapi.db.query('api::application-note.application-note').findOne({
      where: { user: userId },
    });

    if (!applicationNote) {
      // Create default if none exists
      const newNote = await strapi.entityService.create('api::application-note.application-note' as any, {
        data: {
          user: userId,
          questions: DEFAULT_QUESTIONS,
        },
      });
      ctx.body = { data: [newNote] };
    } else {
      ctx.body = { data: [applicationNote] };
    }
  },

  /**
   * Override default findOne to ensure users can only access their own notes
   */
  async findOne(ctx) {
    const authHeader = ctx.request.header.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return ctx.unauthorized('Authentication required');
    }
    
    const token = authHeader.slice(7);
    let user = null;
    
    try {
      const jwtService = strapi.plugin('users-permissions').service('jwt');
      user = await jwtService.verify(token);
    } catch (jwtError) {
      return ctx.unauthorized('Invalid token');
    }

    // Ensure userId is a number
    const userId = Number(user.id);
    
    if (!userId || !Number.isInteger(userId)) {
      strapi.log.error(`[application-note] Invalid user ID in findOne: ${user.id} (type: ${typeof user.id})`);
      return ctx.badRequest('Invalid user ID');
    }

    const { id } = ctx.params;

    const applicationNote = await strapi.db.query('api::application-note.application-note').findOne({
      where: { id, user: userId },
    });

    if (!applicationNote) {
      return ctx.notFound('Application note not found');
    }

    ctx.body = { data: applicationNote };
  },

  /**
   * Override create to ensure proper user association
   */
  async create(ctx) {
    const authHeader = ctx.request.header.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return ctx.unauthorized('Authentication required');
    }
    
    const token = authHeader.slice(7);
    let user = null;
    
    try {
      const jwtService = strapi.plugin('users-permissions').service('jwt');
      user = await jwtService.verify(token);
    } catch (jwtError) {
      return ctx.unauthorized('Invalid token');
    }

    // Ensure userId is a number
    const userId = Number(user.id);
    
    if (!userId || !Number.isInteger(userId)) {
      strapi.log.error(`[application-note] Invalid user ID in create: ${user.id} (type: ${typeof user.id})`);
      return ctx.badRequest('Invalid user ID');
    }

    const { questions } = ctx.request.body || {};
    
    // Check if user already has an application note
    const existing = await strapi.db.query('api::application-note.application-note').findOne({
      where: { user: userId },
    });

    if (existing) {
      return ctx.badRequest('User already has an application note');
    }

    const applicationNote = await strapi.entityService.create('api::application-note.application-note' as any, {
      data: {
        user: userId,
        questions: questions || DEFAULT_QUESTIONS,
      },
    });

    ctx.body = { data: applicationNote };
  },

  /**
   * Override update to ensure users can only update their own notes
   */
  async update(ctx) {
    const authHeader = ctx.request.header.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return ctx.unauthorized('Authentication required');
    }
    
    const token = authHeader.slice(7);
    let user = null;
    
    try {
      const jwtService = strapi.plugin('users-permissions').service('jwt');
      user = await jwtService.verify(token);
    } catch (jwtError) {
      return ctx.unauthorized('Invalid token');
    }

    // Ensure userId is a number
    const userId = Number(user.id);
    
    if (!userId || !Number.isInteger(userId)) {
      strapi.log.error(`[application-note] Invalid user ID in update: ${user.id} (type: ${typeof user.id})`);
      return ctx.badRequest('Invalid user ID');
    }

    const { id } = ctx.params;

    // Ensure user owns this application note
    const existing = await strapi.db.query('api::application-note.application-note').findOne({
      where: { id, user: userId },
    });

    if (!existing) {
      return ctx.notFound('Application note not found');
    }

    const applicationNote = await strapi.entityService.update('api::application-note.application-note' as any, id, {
      data: ctx.request.body,
    });

    ctx.body = { data: applicationNote };
  },

  /**
   * Override delete to ensure users can only delete their own notes
   */
  async delete(ctx) {
    const authHeader = ctx.request.header.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return ctx.unauthorized('Authentication required');
    }
    
    const token = authHeader.slice(7);
    let user = null;
    
    try {
      const jwtService = strapi.plugin('users-permissions').service('jwt');
      user = await jwtService.verify(token);
    } catch (jwtError) {
      return ctx.unauthorized('Invalid token');
    }

    // Ensure userId is a number
    const userId = Number(user.id);
    
    if (!userId || !Number.isInteger(userId)) {
      strapi.log.error(`[application-note] Invalid user ID in delete: ${user.id} (type: ${typeof user.id})`);
      return ctx.badRequest('Invalid user ID');
    }

    const { id } = ctx.params;

    // Ensure user owns this application note
    const existing = await strapi.db.query('api::application-note.application-note').findOne({
      where: { id, user: userId },
    });

    if (!existing) {
      return ctx.notFound('Application note not found');
    }

    await strapi.entityService.delete('api::application-note.application-note' as any, id);

    ctx.body = { data: null };
  },
}));
