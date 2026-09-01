import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

export async function query<T = any>(text: string, values: any[] = []): Promise<T[]> {
  const result = await pool.query(text, values);
  return result.rows;
}

export default pool;
