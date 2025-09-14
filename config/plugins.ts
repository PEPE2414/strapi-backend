// config/plugins.ts
export default ({ env }) => ({
  'users-permissions': {
    config: {
      register: {
        allowedFields: ['preferredName','university','course','studyField','keyStats'],
      },
      jwt: { expiresIn: '7d' },
    },
  },

  upload: {
    // Use local in dev by default; switch to S3 in prod by setting UPLOAD_PROVIDER=aws
    config: env('UPLOAD_PROVIDER', 'local') === 'aws'
      ? {
          provider: '@strapi/provider-upload-aws-s3',
          providerOptions: {
            accessKeyId: env('S3_ACCESS_KEY_ID'),
            secretAccessKey: env('S3_SECRET_ACCESS_KEY'),
            region: env('S3_REGION'),
            params: { Bucket: env('S3_BUCKET') },
          },
          actionOptions: {
            upload: {},
            uploadStream: {},
            delete: {},
          },
        }
      : {},
  },
});
