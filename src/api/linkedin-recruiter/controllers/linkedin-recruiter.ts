import { factories } from '@strapi/strapi';

export default factories.createCoreController('api::linkedin-recruiter.linkedin-recruiter' as any, ({ strapi }) => ({
  async search(ctx) {
    const { user } = ctx.state;
    if (!user) {
      return ctx.unauthorized('Authentication required');
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
    const { user } = ctx.state;
    if (!user) {
      return ctx.unauthorized('Authentication required');
    }

    try {
      // Check if the content type exists
      const contentType = strapi.contentTypes['api::linkedin-recruiter.linkedin-recruiter'];
      if (!contentType) {
        console.warn('LinkedIn recruiter content type not found, returning empty results');
        return { data: [] };
      }

      const data = await strapi.entityService.findMany('api::linkedin-recruiter.linkedin-recruiter' as any, {
        filters: { owner: user.id },
        sort: { createdAt: 'desc' },
        populate: {
          owner: {
            fields: ['id']
          }
        }
      });

      // Transform data to match expected format
      const transformedData = data.map((item: any) => ({
        id: item.id,
        name: item.name,
        title: item.title,
        company: item.company,
        location: item.location,
        linkedinUrl: item.linkedinUrl,
        fetchedAt: item.createdAt
      }));

      return { data: transformedData };
    } catch (error) {
      console.error('Failed to fetch recruiter results:', error);
      // If it's a 403 or content type not found error, return empty results instead of error
      if (error.message?.includes('403') || error.message?.includes('not found')) {
        console.warn('Content type not accessible, returning empty results');
        return { data: [] };
      }
      return { data: [] };
    }
  },
}));
