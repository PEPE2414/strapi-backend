export default {
  async search(ctx) {
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

    const { company, roleKeywords, location, limit } = ctx.request.body;

    if (!company || !company.trim()) {
      return ctx.badRequest('Company is required');
    }

    // Basic rate limiting: Check for recent searches in the last 20 seconds
    const twentySecondsAgo = new Date(Date.now() - 20000);
    const recentSearches = await strapi.entityService.findMany('api::linkedin-recruiter.linkedin-recruiter' as any, {
      filters: { 
        owner: user.id,
        createdAt: { $gte: twentySecondsAgo }
      },
      limit: 1
    });
    
    if (recentSearches.length > 0) {
      return ctx.tooManyRequests('Rate limit exceeded. Please wait 20 seconds between searches.');
    }

    try {

      // Call n8n webhook
      const n8nUrl = process.env.N8N_LINKEDIN_RECRUITER_WEBHOOK_URL;
      const webhookSecret = process.env.N8N_WEBHOOK_SECRET;

      if (!n8nUrl) {
        console.error('Missing N8N_LINKEDIN_RECRUITER_WEBHOOK_URL');
        return ctx.internalServerError('Service configuration error');
      }

      const payload = {
        userId: user.id,
        company: company.trim(),
        roleKeywords: roleKeywords?.trim() || undefined,
        location: location?.trim() || undefined,
        limit: Math.min(Math.max(limit || 25, 5), 100)
      };

      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };

      if (webhookSecret) {
        headers.Authorization = `Bearer ${webhookSecret}`;
      }

      const n8nResponse = await fetch(n8nUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
      });

      if (!n8nResponse.ok) {
        console.error('N8N webhook failed:', n8nResponse.status, await n8nResponse.text());
        return ctx.internalServerError('Failed to dispatch search');
      }

      return { ok: true };
    } catch (error) {
      console.error('Failed to dispatch search:', error);
      return ctx.internalServerError('Failed to dispatch search');
    }
  },

  async results(ctx) {
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
      const results = await strapi.db.query('api::linkedin-recruiter.linkedin-recruiter').findMany({
        where: { owner: user.id },
        orderBy: { createdAt: 'desc' },
        populate: { owner: true },
      });

      // Transform data to match expected format
      const transformedData = results.map((item: any) => ({
        id: item.id,
        name: item.name,
        title: item.title,
        company: item.company,
        location: item.location,
        linkedinUrl: item.linkedinUrl,
        fetchedAt: item.createdAt
      }));

      ctx.body = { data: transformedData };
    } catch (error) {
      console.error('Failed to fetch recruiter results:', error);
      // If content type doesn't exist, return empty results
      ctx.body = { data: [] };
    }
  },
};
