// config/database.js
module.exports = ({ env }) => {
  const ssl = env.bool('DATABASE_SSL', true) ? { rejectUnauthorized: false } : false;

  if (env('DATABASE_URL')) {
    return {
      connection: {
        client: 'postgres',
        connection: {
          connectionString: env('DATABASE_URL'),
          ssl,
        },
        pool: { min: 0, max: 10 },
      },
    };
  }

  return {
    connection: {
      client: 'postgres',
      connection: {
        host: env('PGHOST', env('DATABASE_HOST', 'localhost')),
        port: env.int('PGPORT', env.int('DATABASE_PORT', 5432)),
        database: env('PGDATABASE', env('DATABASE_NAME', 'strapi')),
        user: env('PGUSER', env('DATABASE_USERNAME', 'strapi')),
        password: env('PGPASSWORD', env('DATABASE_PASSWORD', 'strapi')),
        ssl,
      },
      pool: { min: 0, max: 10 },
    },
  };
};
