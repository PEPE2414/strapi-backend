// config/database.js
module.exports = ({ env }) => {
  const databaseUrl = env('DATABASE_URL');

  if (databaseUrl) {
    return {
      connection: {
        client: 'postgres',
        connection: {
          connectionString: databaseUrl,
          ssl: { rejectUnauthorized: false },
        },
      },
    };
  }

  return {
    connection: {
      client: 'postgres',
      connection: {
        host: env('PGHOST', env('DATABASE_HOST', 'localhost')),
        port: env.int('PGPORT', env.int('DATABASE_PORT', 5432)),
        database: env('PGDATABASE', env('DATABASE_NAME')),
        user: env('PGUSER', env('DATABASE_USERNAME')),
        password: env('PGPASSWORD', env('DATABASE_PASSWORD')),
        ssl: env.bool('DATABASE_SSL', true) ? { rejectUnauthorized: false } : false,
      },
    },
  };
};
