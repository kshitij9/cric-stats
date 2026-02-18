import { createClient } from '@clickhouse/client';

const clickhouse = createClient({
  host: process.env.CH_HOST,
  username: process.env.CH_USER,
  password: process.env.CH_PASS,
  database: 'cricket',
});

export default clickhouse;