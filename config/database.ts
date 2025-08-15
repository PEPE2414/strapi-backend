// config/database.ts
export default ({ env }) => ({
  connection: env('DATABASE_URL')
    ? {
        client: 'postgres',
        connection: {
          connectionString: env('DATABASE_URL'),
          ssl: env.bool('DATABASE_SSL', true) ? { rejectUnauthorized: false } : false,
        },
        pool: { min: 0, max: 10 },
      }
    : {
        // sensible dev default if DATABASE_URL is not set
        client: 'sqlite',
        connection: { filename: env('SQLITE_FILENAME', '.tmp/dev.db') },
        useNullAsDefault: true,
      },
});
