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
  // random_page_cost: the data is on an SSD, so use the indexes rather than read
  // every ball. enable_parallel_hash: shared hash tables overrun the database
  // container's 64 MB of shared memory when several searches run at once.
  // jit: compiling a query takes longer here than it saves.
  options: '-c random_page_cost=1.1 -c enable_parallel_hash=off -c jit=off',
});

export async function query<T = any>(text: string, values: any[] = []): Promise<T[]> {
  const result = await pool.query(text, values);
  return result.rows;
}

/**
 * For a query that totals every ball of a format. Looking each wicket's ball up
 * one at a time, which the planner may prefer, is several times slower there.
 */
export const queryWholeFormat: typeof query = async (text, values = []) => {
  const client = await pool.connect();
  let failed = true;
  try {
    await client.query('BEGIN READ ONLY; SET LOCAL enable_nestloop = off');
    const result = await client.query(text, values);
    await client.query('COMMIT');
    failed = false;
    return result.rows;
  } finally {
    // a connection left in a failed transaction is thrown away
    client.release(failed);
  }
};

export default pool;
