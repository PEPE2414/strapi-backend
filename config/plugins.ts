// config/plugins.ts
export default ({ env }) => {
  const mode = env('UPLOAD_PROVIDER', 'local');
  const isAws = mode === 'aws' || mode === 'aws-s3';

  return {
    'users-permissions': {
      config: {
        register: {
          allowedFields: ['preferredName','university','course','studyField','keyStats'],
        },
        jwt: { expiresIn: '7d' },
      },
    },
    upload: {
      config: isAws
        ? {
            provider: '@strapi/provider-upload-aws-s3', // requires the package installed
            providerOptions: {
              accessKeyId: env('S3_ACCESS_KEY_ID'),
              secretAccessKey: env('S3_SECRET_ACCESS_KEY'),
              region: env('S3_REGION'),
              params: { Bucket: env('S3_BUCKET') },
            },
            actionOptions: { upload: {}, uploadStream: {}, delete: {} },
          }
        : {}, // local (dev)
    },
  };
};
