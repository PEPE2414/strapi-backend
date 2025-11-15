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
        // For Postmark: Just provide POSTMARK_API_TOKEN (automatically uses nodemailer)
        // For other SMTP: Set EMAIL_PROVIDER=nodemailer with SMTP_HOST, etc.
        // For sendmail: Set EMAIL_PROVIDER=sendmail (default)
        // Note: For nodemailer, you may need: npm install @strapi/provider-email-nodemailer
        provider: (() => {
          // If Postmark token is set, use nodemailer (Postmark works via SMTP)
          if (env('POSTMARK_API_TOKEN')) {
            return 'nodemailer';
          }
          return env('EMAIL_PROVIDER', 'sendmail');
        })(),
        providerOptions: (() => {
          // Postmark configuration (uses SMTP via nodemailer)
          const postmarkToken = env('POSTMARK_API_TOKEN');
          if (postmarkToken) {
            return {
              host: 'smtp.postmarkapp.com',
              port: 587,
              secure: false,
              auth: {
                user: postmarkToken,
                pass: postmarkToken, // Postmark uses the same token for both user and pass
              },
            };
          }
          
          // Nodemailer/SMTP configuration (when POSTMARK_API_TOKEN is not set)
          const provider = env('EMAIL_PROVIDER', 'sendmail');
          if (provider === 'nodemailer') {
            return {
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
            };
          }
          
          // Sendmail (default) - no provider options needed
          return {};
        })(),
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
