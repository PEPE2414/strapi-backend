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
        client: 'postgres',
        connection: {
          host: env('PGHOST', env('DATABASE_HOST', 'localhost')),
          port: env.int('PGPORT', env.int('DATABASE_PORT', 5432)),
          database: env('PGDATABASE', env('DATABASE_NAME', 'strapi')),
          user: env('PGUSER', env('DATABASE_USERNAME', 'strapi')),
          password: env('PGPASSWORD', env('DATABASE_PASSWORD', 'strapi')),
          ssl: env.bool('DATABASE_SSL', true) ? { rejectUnauthorized: false } : false,
        },
        pool: { min: 0, max: 10 },
      },
});
