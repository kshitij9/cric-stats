import { Pool } from 'pg';

/**
 * The database of what people create in the app (db/app/001-teams.sql), apart
 * from the match data in lib/db.ts. Connected to on first use, so the app builds
 * and its other screens work where it is not set up.
 */
let pool: Pool | null = null;

export function appDb(): Pool | null {
  const connectionString = process.env.APP_DATABASE_URL;
  if (!connectionString) return null;
  if (!pool) {
    pool = new Pool({ connectionString });
    // an idle connection dropped by the server must not stop the app
    pool.on('error', (err) => console.error(err));
  }
  return pool;
}
