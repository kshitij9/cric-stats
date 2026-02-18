import { createClient } from '@clickhouse/client'

const clickhouse = createClient({
  host: process.env.CH_HOST,
  username: process.env.CH_USER || 'default',
  password: process.env.CH_PASS,
  database: 'cricket',
  // Cloud requires specific settings:
  request_timeout: 30000,
  clickhouse_settings: {
    full_column_types: 1,
  },
  // Ensure the client doesn't try to reuse a broken socket
  max_open_connections: 10,
})

export default clickhouse;