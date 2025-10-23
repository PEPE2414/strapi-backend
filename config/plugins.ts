// config/plugins.ts
export default ({ env }) => {
  const mode = env('UPLOAD_PROVIDER', 'local');

  return {
    'users-permissions': {
      config: {
        register: {
          allowedFields: ['preferredName','fullName','university','course','studyField','keyStats','weeklyGoal','notificationPrefs','deadlineCheckboxes','deadlineTodos'],
        },
        jwt: { expiresIn: '7d' },
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
