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
})

export default clickhouse;