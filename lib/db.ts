import { Pool, types } from 'pg';

// node-postgres returns NUMERIC (1700) and BIGINT (20, what SUM()/COUNT() yield)
// as strings to avoid precision loss. The ClickHouse client this replaced handed
// back plain numbers, and the frontend still expects numbers (r.era_index.toFixed,
// arithmetic on runs/innings, etc.). Cricket aggregates are well within IEEE-754
// safe-integer range, so parse both as Number.
types.setTypeParser(1700, (v) => (v === null ? null : parseFloat(v)));
types.setTypeParser(20, (v) => (v === null ? null : parseInt(v, 10)));

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

export async function query<T = any>(text: string, values: any[] = []): Promise<T[]> {
  const result = await pool.query(text, values);
  return result.rows;
}

export default pool;
