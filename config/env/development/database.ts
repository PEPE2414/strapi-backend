// config/env/development/database.ts
export default ({ env }) => ({
  connection: {
    client: 'sqlite',
    connection: {
      filename: env('SQLITE_FILENAME', '.tmp/data.db'),
    },
    useNullAsDefault: true,
  },
});
