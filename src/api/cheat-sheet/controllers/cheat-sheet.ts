export default ({ strapi }) => ({
  async me(ctx) {
    const { user } = ctx.state;
    if (!user) {
      return ctx.unauthorized('Authentication required');
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
    const { user } = ctx.state;
    if (!user) {
      return ctx.unauthorized('Authentication required');
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
});
