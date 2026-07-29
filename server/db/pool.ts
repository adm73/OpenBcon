import pg from 'pg'
import { environment } from '../config'

const { Pool } = pg

export const databasePool = new Pool({
  connectionString: environment.DATABASE_URL,
  max: 10,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 5_000,
  ssl: environment.DATABASE_SSL
    ? {
        rejectUnauthorized: false,
      }
    : undefined,
})
