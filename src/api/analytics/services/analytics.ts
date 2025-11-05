// src/api/analytics/services/analytics.ts
// Service for tracking analytics events and calculating metrics

interface AnalyticsEvent {
  event: string;
  [key: string]: any;
}

interface UsageMetrics {
  totalCoverLetters: number;
  totalRecruiterLookups: number;
  totalMockInterviews: number;
  totalInterviewQuestions: number;
  totalCheatSheets: number;
  totalWarmUps: number;
  lastActivityDate: string | null;
}

interface ChurnMetrics {
  totalChurned: number;
  churnedFromTrial: number;
  churnedFromPaid: number;
  churnRate: number;
  trialChurnRate: number;
  paidChurnRate: number;
  period: 'day' | 'week' | 'month';
}

export default {
  /**
   * Track an analytics event for a user
   */
  async trackEvent(userId: string, event: AnalyticsEvent): Promise<void> {
    try {
      // Get or create usage log entry
      const user = await strapi.entityService.findOne('plugin::users-permissions.user', userId, {
        fields: ['id', 'usageLogs']
      });

      if (!user) {
        console.error(`User not found for analytics tracking: ${userId}`);
        return;
      }

      // Create usage log entry for analytics events
      // Note: We'll store analytics events in the meta field since the schema is resource-focused
      try {
        await strapi.entityService.create('api::usage-log.usage-log', {
          data: {
            user: userId,
            type: 'cover_letter', // Default type, actual event stored in meta
            resourceId: 0, // Placeholder, actual event data in meta
            meta: {
              eventType: event.event,
              eventData: event,
              timestamp: event.timestamp || new Date().toISOString()
            }
          }
        });
      } catch (error) {
        // If schema doesn't support this, log to console instead
        console.log(`Analytics event: ${event.event} for user ${userId}`, event);
      }

      // Update feature usage count if applicable
      if (event.event === 'cover_letter_generated') {
        await this.incrementFeatureUsage(userId, 'coverLetters');
      } else if (event.event === 'recruiter_lookup') {
        await this.incrementFeatureUsage(userId, 'recruiterLookups');
      } else if (event.event === 'mock_interview_completed') {
        await this.incrementFeatureUsage(userId, 'mockInterviews');
      } else if (event.event === 'interview_questions_generated') {
        await this.incrementFeatureUsage(userId, 'interviewQuestions');
      } else if (event.event === 'cheat_sheet_generated') {
        await this.incrementFeatureUsage(userId, 'cheatSheets');
      } else if (event.event === 'warm_up_completed') {
        await this.incrementFeatureUsage(userId, 'warmUps');
      }
    } catch (error) {
      console.error(`Error tracking event for user ${userId}:`, error);
      // Don't throw - analytics failures shouldn't break the main flow
    }
  },

  /**
   * Increment feature usage count
   */
  async incrementFeatureUsage(userId: string, feature: string): Promise<void> {
    try {
      const user = await strapi.entityService.findOne('plugin::users-permissions.user', userId, {
        fields: ['id', 'featureUsageCount']
      });

      if (!user) return;

      const usageCount = user.featureUsageCount || {};
      usageCount[feature] = (usageCount[feature] || 0) + 1;

      await strapi.entityService.update('plugin::users-permissions.user', userId, {
        data: {
          featureUsageCount: usageCount
        }
      });
    } catch (error) {
      console.error(`Error incrementing feature usage for user ${userId}:`, error);
    }
  },

  /**
   * Get usage metrics for a user
   */
  async getUserUsageMetrics(userId: string): Promise<UsageMetrics> {
    try {
      const user = await strapi.entityService.findOne('plugin::users-permissions.user', userId, {
        fields: ['id', 'featureUsageCount', 'usageLogs'],
        populate: ['usageLogs']
      });

      if (!user) {
        throw new Error('User not found');
      }

      const usageCount = user.featureUsageCount || {};
      const logs = user.usageLogs || [];

      // Find last activity date
      let lastActivityDate: string | null = null;
      if (logs.length > 0) {
        const sortedLogs = logs.sort((a: any, b: any) => 
          new Date(b.timestamp || b.createdAt).getTime() - new Date(a.timestamp || a.createdAt).getTime()
        );
        lastActivityDate = sortedLogs[0].timestamp || sortedLogs[0].createdAt;
      }

      return {
        totalCoverLetters: usageCount.coverLetters || 0,
        totalRecruiterLookups: usageCount.recruiterLookups || 0,
        totalMockInterviews: usageCount.mockInterviews || 0,
        totalInterviewQuestions: usageCount.interviewQuestions || 0,
        totalCheatSheets: usageCount.cheatSheets || 0,
        totalWarmUps: usageCount.warmUps || 0,
        lastActivityDate
      };
    } catch (error) {
      console.error(`Error getting usage metrics for user ${userId}:`, error);
      throw error;
    }
  },

  /**
   * Calculate churn metrics
   */
  async getChurnMetrics(period: 'day' | 'week' | 'month' = 'month'): Promise<ChurnMetrics> {
    try {
      const now = new Date();
      let startDate: Date;

      switch (period) {
        case 'day':
          startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
          break;
        case 'week':
          startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          break;
        case 'month':
          startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
          break;
      }

      // Get all users
      const allUsers = await strapi.entityService.findMany('plugin::users-permissions.user', {
        fields: ['id', 'packages', 'plan', 'trialActive', 'trialEndsAt', 'createdAt'],
        limit: -1
      });

      // Get churned users (deactivated accounts in the period)
      // Note: We'll check usage logs for deactivation events stored in meta
      const churnedUsers = await strapi.entityService.findMany('api::usage-log.usage-log', {
        filters: {
          createdAt: {
            $gte: startDate.toISOString()
          }
        },
        fields: ['id', 'meta', 'createdAt'],
        limit: -1
      });

      // Filter for deactivation events
      const deactivationEvents = churnedUsers.filter((log: any) => 
        log.meta?.eventType === 'account_deactivated'
      );

      // Calculate churn metrics
      let churnedFromTrial = 0;
      let churnedFromPaid = 0;

      // Get total users who started trial in period
      const trialUsers = allUsers.filter(user => {
        const createdAt = new Date(user.createdAt);
        return createdAt >= startDate && (user.trialActive || user.trialEndsAt);
      });

      // Get total paid users at start of period
      const paidUsers = allUsers.filter(user => {
        const packages = Array.isArray(user.packages) ? user.packages : [];
        return packages.length > 0 || (user.plan && user.plan !== 'none');
      });

      // Analyze churned users
      for (const log of deactivationEvents) {
        const eventData = log.meta?.eventData || {};
        // Check if user was on trial or paid before deactivation
        // This is a simplified check - you may want to enhance this
        if (eventData.metadata?.trialActive) {
          churnedFromTrial++;
        } else {
          churnedFromPaid++;
        }
      }

      const totalChurned = deactivationEvents.length;
      const totalUsers = allUsers.length;
      const churnRate = totalUsers > 0 ? (totalChurned / totalUsers) * 100 : 0;
      const trialChurnRate = trialUsers.length > 0 ? (churnedFromTrial / trialUsers.length) * 100 : 0;
      const paidChurnRate = paidUsers.length > 0 ? (churnedFromPaid / paidUsers.length) * 100 : 0;

      return {
        totalChurned,
        churnedFromTrial,
        churnedFromPaid,
        churnRate: Math.round(churnRate * 100) / 100,
        trialChurnRate: Math.round(trialChurnRate * 100) / 100,
        paidChurnRate: Math.round(paidChurnRate * 100) / 100,
        period
      };
    } catch (error) {
      console.error('Error calculating churn metrics:', error);
      throw error;
    }
  },

  /**
   * Get comprehensive analytics for a user
   */
  async getUserAnalytics(userId: string): Promise<any> {
    try {
      const user = await strapi.entityService.findOne('plugin::users-permissions.user', userId, {
        fields: ['id', 'createdAt', 'packages', 'plan', 'trialActive', 'trialEndsAt'],
        populate: ['usageLogs']
      });

      if (!user) {
        throw new Error('User not found');
      }

      const usageMetrics = await this.getUserUsageMetrics(userId);
      const logs = user.usageLogs || [];

      // Calculate days since signup
      const daysSinceSignup = Math.floor(
        (new Date().getTime() - new Date(user.createdAt).getTime()) / (1000 * 60 * 60 * 24)
      );

      // Check if user is on trial
      const isOnTrial = user.trialActive && user.trialEndsAt 
        ? new Date(user.trialEndsAt) > new Date()
        : false;

      // Check if user has active subscription
      const hasActiveSubscription = (Array.isArray(user.packages) && user.packages.length > 0) 
        || (user.plan && user.plan !== 'none');

      return {
        userId,
        daysSinceSignup,
        isOnTrial,
        hasActiveSubscription,
        currentPlan: user.plan || 'none',
        packages: user.packages || [],
        usage: usageMetrics,
        totalEvents: logs.length,
        accountStatus: hasActiveSubscription ? 'active' : (isOnTrial ? 'trial' : 'inactive')
      };
    } catch (error) {
      console.error(`Error getting analytics for user ${userId}:`, error);
      throw error;
    }
  }
};

