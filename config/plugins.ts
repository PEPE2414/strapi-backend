// config/plugins.ts
export default ({ env }) => {
  const mode = env('UPLOAD_PROVIDER', 'local');
  const frontendUrl = env('FRONTEND_URL') || env('PUBLIC_URL') || 'http://localhost:3000';

  return {
    'users-permissions': {
      config: {
        register: {
          allowedFields: ['preferredName','fullName','university','course','studyField','keyStats','weeklyGoal','notificationPrefs','deadlineCheckboxes','deadlineTodos'],
        },
        jwt: { expiresIn: '7d' },
        // Reset password page URL - where users will be redirected from email link
        resetPassword: {
          frontendUrl: `${frontendUrl}/reset-password`,
        },
      },
    },

    email: {
      config: {
        // For SMTP, you may need to install: npm install @strapi/provider-email-nodemailer
        // Then set EMAIL_PROVIDER=nodemailer
        provider: env('EMAIL_PROVIDER', 'sendmail'), // 'sendmail' (default), 'nodemailer' (for SMTP)
        providerOptions: env('EMAIL_PROVIDER') === 'nodemailer' ? {
          host: env('SMTP_HOST', 'smtp.gmail.com'),
          port: env.int('SMTP_PORT', 587),
          secure: env.bool('SMTP_SECURE', false), // true for 465, false for other ports
          auth: {
            user: env('SMTP_USERNAME'),
            pass: env('SMTP_PASSWORD'),
          },
          // Optional: for providers that need different settings
          ...(env('SMTP_REJECT_UNAUTHORIZED') !== undefined && {
            tls: {
              rejectUnauthorized: env.bool('SMTP_REJECT_UNAUTHORIZED', true),
            },
          }),
        } : {},
        settings: {
          defaultFrom: env('EMAIL_FROM', 'noreply@effort-free.co.uk'),
          defaultReplyTo: env('EMAIL_REPLY_TO', 'noreply@effort-free.co.uk'),
        },
      },
    },

    upload: {
      config: mode === 'aws'
        ? {
            provider: 'aws-s3', // v5 style id
            providerOptions: {
              baseUrl: env('CDN_URL'),      // optional (CloudFront etc.)
              rootPath: env('CDN_ROOT_PATH'), // optional
              s3Options: {
                credentials: {
                  accessKeyId: env('S3_ACCESS_KEY_ID'),
                  secretAccessKey: env('S3_SECRET_ACCESS_KEY'),
                },
                region: env('S3_REGION'),
                params: {
                  Bucket: env('S3_BUCKET'),
                  // ACL: 'private',           // uncomment if bucket is private
                  // signedUrlExpires: 900,    // seconds (optional)
                },
              },
            },
            actionOptions: { upload: {}, uploadStream: {}, delete: {} },
          }
        : {}, // local in dev
    },
  };
};
