// src/api/notifications/services/notifications.ts
// Service for sending notifications to n8n

interface SubscriptionFailureNotification {
  userId: string | number;
  email: string;
  subscriptionId: string;
  invoiceId: string;
  reason: 'payment_failed_review' | 'payment_failed_final' | 'payment_failed_warning';
  attemptCount?: number;
}

interface SubscriptionCancellationNotification {
  userId: string | number;
  email: string;
  subscriptionId: string;
  cancelAtPeriodEnd: boolean;
}

interface GuaranteeRedemptionNotification {
  userId: string | number;
  email: string;
  subscriptionId: string;
  invoiceId: string;
  packageSlug: string;
}

export default {
  /**
   * Send subscription failure notification to n8n
   */
  async sendSubscriptionFailureNotification(data: SubscriptionFailureNotification): Promise<void> {
    // Support both single URL with path and separate URLs
    const n8nWebhookUrl = process.env.N8N_WEBHOOK_URL_SubscriptionFailure || 
                         (process.env.N8N_WEBHOOK_URL ? `${process.env.N8N_WEBHOOK_URL}/subscription-failure` : null);
    
    if (!n8nWebhookUrl) {
      console.warn('N8N_WEBHOOK_URL_SubscriptionFailure or N8N_WEBHOOK_URL not set, skipping notification');
      return;
    }

    try {
      const response = await fetch(n8nWebhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-webhook-secret': process.env.N8N_WEBHOOK_SECRET || ''
        },
        body: JSON.stringify({
          event: 'subscription_failure',
          userId: data.userId,
          email: data.email,
          subscriptionId: data.subscriptionId,
          invoiceId: data.invoiceId,
          reason: data.reason,
          attemptCount: data.attemptCount,
          timestamp: new Date().toISOString()
        })
      });

      if (!response.ok) {
        console.error(`Failed to send notification to n8n: ${response.status} ${response.statusText}`);
      } else {
        console.log(`Notification sent to n8n for user ${data.userId}`);
      }
    } catch (error) {
      console.error('Error sending notification to n8n:', error);
      // Don't throw - notification failures shouldn't break the main flow
    }
  },

  /**
   * Send subscription cancellation notification to n8n
   */
  async sendSubscriptionCancellationNotification(data: SubscriptionCancellationNotification): Promise<void> {
    // Support both single URL with path and separate URLs
    const n8nWebhookUrl = process.env.N8N_WEBHOOK_URL_SubscriptionCancellation || 
                         (process.env.N8N_WEBHOOK_URL ? `${process.env.N8N_WEBHOOK_URL}/subscription-cancellation` : null);
    
    if (!n8nWebhookUrl) {
      console.warn('N8N_WEBHOOK_URL_SubscriptionCancellation or N8N_WEBHOOK_URL not set, skipping notification');
      return;
    }

    try {
      const response = await fetch(n8nWebhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-webhook-secret': process.env.N8N_WEBHOOK_SECRET || ''
        },
        body: JSON.stringify({
          event: 'subscription_cancellation',
          userId: data.userId,
          email: data.email,
          subscriptionId: data.subscriptionId,
          cancelAtPeriodEnd: data.cancelAtPeriodEnd,
          timestamp: new Date().toISOString()
        })
      });

      if (!response.ok) {
        console.error(`Failed to send notification to n8n: ${response.status} ${response.statusText}`);
      } else {
        console.log(`Cancellation notification sent to n8n for user ${data.userId}`);
      }
    } catch (error) {
      console.error('Error sending cancellation notification to n8n:', error);
      // Don't throw - notification failures shouldn't break the main flow
    }
  },

  /**
   * Send guarantee redemption notification to n8n (for 4-month subscriptions)
   */
  async sendGuaranteeRedemptionNotification(data: GuaranteeRedemptionNotification): Promise<void> {
    // Support both single URL with path and separate URLs
    // Note: Fix typo in env var name (Guranatee -> Guarantee)
    const n8nWebhookUrl = process.env.N8N_WEBHOOK_URL_GuaranteeRedemption || 
                         process.env.N8N_WEBHOOK_URL_GuranateeRedemption || 
                         (process.env.N8N_WEBHOOK_URL ? `${process.env.N8N_WEBHOOK_URL}/guarantee-redemption` : null);
    
    if (!n8nWebhookUrl) {
      console.warn('N8N_WEBHOOK_URL_GuaranteeRedemption or N8N_WEBHOOK_URL not set, skipping notification');
      return;
    }

    try {
      // Determine guarantee type based on package
      const guaranteeType = data.packageSlug === 'fast-track' || data.packageSlug === 'offer-fast-track' 
        ? 'offers' 
        : 'interviews';

      const response = await fetch(n8nWebhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-webhook-secret': process.env.N8N_WEBHOOK_SECRET || ''
        },
        body: JSON.stringify({
          event: 'guarantee_redemption',
          userId: data.userId,
          email: data.email,
          subscriptionId: data.subscriptionId,
          invoiceId: data.invoiceId,
          packageSlug: data.packageSlug,
          guaranteeType, // 'offers' or 'interviews'
          timestamp: new Date().toISOString()
        })
      });

      if (!response.ok) {
        console.error(`Failed to send guarantee redemption notification to n8n: ${response.status} ${response.statusText}`);
      } else {
        console.log(`Guarantee redemption notification sent to n8n for user ${data.userId}`);
      }
    } catch (error) {
      console.error('Error sending guarantee redemption notification to n8n:', error);
      // Don't throw - notification failures shouldn't break the main flow
    }
  }
};

