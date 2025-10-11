export default {
  async me(ctx) {
    // Manual JWT verification since auth: false bypasses built-in auth
    const authHeader = ctx.request.header.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return ctx.unauthorized('Authentication required');
    }
    
    const token = authHeader.slice(7);
    let user = null;
    
    try {
      // Use Strapi's JWT service to verify the token
      const jwtService = strapi.plugin('users-permissions').service('jwt');
      user = await jwtService.verify(token);
    } catch (jwtError) {
      return ctx.unauthorized('Invalid token');
    }

    try {
      // Use direct database query like the working saved-job controller
      const results = await strapi.db.query('api::cheat-sheet.cheat-sheet').findMany({
        where: { userId: user.id },
        orderBy: { createdAt: 'desc' },
      });

      ctx.body = { data: results };
    } catch (error) {
      console.error('Failed to fetch cheat sheets:', error);
      // If content type doesn't exist, return empty results
      ctx.body = { data: [] };
    }
  },

  async generate(ctx) {
    // Manual JWT verification since auth: false bypasses built-in auth
    const authHeader = ctx.request.header.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return ctx.unauthorized('Authentication required');
    }
    
    const token = authHeader.slice(7);
    let user = null;
    
    try {
      // Use Strapi's JWT service to verify the token
      const jwtService = strapi.plugin('users-permissions').service('jwt');
      user = await jwtService.verify(token);
    } catch (jwtError) {
      return ctx.unauthorized('Invalid token');
    }

    const { jobId, jobTitle, company, jdText } = ctx.request.body;

    if (!jobTitle || !company) {
      return ctx.badRequest('jobTitle and company are required');
    }

    try {
      // Check for existing cheat sheet (idempotency)
      const existing = await strapi.db.query('api::cheat-sheet.cheat-sheet').findMany({
        where: {
          userId: user.id,
          jobTitle,
          company,
        },
        orderBy: { createdAt: 'desc' },
        limit: 1,
      });

      if (existing.length > 0) {
        const recent = existing[0];
        const hoursSinceCreated = (Date.now() - new Date(recent.createdAt).getTime()) / (1000 * 60 * 60);
        
        // Return existing if created within last 24 hours
        if (hoursSinceCreated < 24) {
          ctx.body = { data: recent };
          return;
        }
      }

      // Fetch user's CV text
      let cvText = '';
      try {
        const fullUser = await strapi.entityService.findOne('plugin::users-permissions.user', user.id, {
          populate: ['cv']
        } as any);
        
        if (fullUser?.cv?.id) {
          const cvFile = await strapi.entityService.findOne('plugin::upload.file', fullUser.cv.id);
          // Extract text from CV file
          // Note: You may need a PDF parsing library like pdf-parse or mammoth for DOCX
          // For now, we'll try to get the text content if available
          if (cvFile?.url) {
            try {
              const cvResponse = await fetch(`${strapi.config.get('server.url')}${cvFile.url}`);
              const cvBuffer = await cvResponse.arrayBuffer();
              
              // If you have pdf-parse or similar installed, use it here
              // For now, we'll just note that text extraction is needed
              cvText = '[CV text extraction requires pdf-parse library]';
            } catch (cvError) {
              strapi.log.warn('Failed to fetch CV file:', cvError);
            }
          }
        }
      } catch (cvError) {
        strapi.log.warn('Failed to fetch user CV:', cvError);
      }

      // Fetch user's cover letter points
      let coverLetterPoints: string[] = [];
      try {
        const fullUser = await strapi.entityService.findOne('plugin::users-permissions.user', user.id);
        if (Array.isArray(fullUser?.coverLetterPoints)) {
          coverLetterPoints = fullUser.coverLetterPoints;
        }
      } catch (pointsError) {
        strapi.log.warn('Failed to fetch cover letter points:', pointsError);
      }

      // Fetch user's previous cover letters
      let previousCoverLetters: string[] = [];
      try {
        const coverLetters = await strapi.entityService.findMany('api::cover-letter.cover-letter' as any, {
          filters: { user: user.id, status: 'ready' },
          sort: { createdAt: 'desc' },
          limit: 5
        } as any);
        
        if (Array.isArray(coverLetters)) {
          previousCoverLetters = coverLetters
            .map((cl: any) => cl.contentText)
            .filter((text: any) => text && typeof text === 'string');
        }
      } catch (clError) {
        strapi.log.warn('Failed to fetch previous cover letters:', clError);
      }

      // Call n8n webhook
      const n8nUrl = process.env.N8N_CHEATSHEET_URL;
      const sharedSecret = process.env.N8N_SHARED_SECRET;

      if (!n8nUrl || !sharedSecret) {
        console.error('Missing N8N_CHEATSHEET_URL or N8N_SHARED_SECRET');
        return ctx.internalServerError('Service configuration error');
      }

      const n8nPayload = {
        jobId,
        jobTitle,
        company,
        jdText: jdText || '',
        userId: user.id,
        cvText,
        coverLetterPoints,
        previousCoverLetters,
      };

      const n8nResponse = await fetch(n8nUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-cl-secret': sharedSecret,
        },
        body: JSON.stringify(n8nPayload),
      });

      if (!n8nResponse.ok) {
        console.error('N8N webhook failed:', n8nResponse.status, await n8nResponse.text());
        return ctx.internalServerError('Failed to generate cheat sheet');
      }

      const n8nData = await n8nResponse.json() as any;

      // Save to Strapi
      const created = await strapi.db.query('api::cheat-sheet.cheat-sheet').create({
        data: {
          userId: user.id,
          jobId,
          jobTitle,
          company,
          sections: n8nData.sections || {},
          sources: n8nData.sources || null,
        },
      });

      ctx.body = { data: created };
    } catch (error) {
      console.error('Failed to generate cheat sheet:', error);
      return ctx.internalServerError('Failed to generate cheat sheet');
    }
  },
};
