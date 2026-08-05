import pg from 'pg'
import { environment } from '../config'

const { Pool } = pg

export function createDatabasePool(connectionString: string) {
  return new Pool({
    connectionString,
    max: 10,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 5_000,
    ssl: environment.DATABASE_SSL
      ? {
          rejectUnauthorized: false,
        }
      : undefined,
  })
}

export const databasePool = createDatabasePool(
  environment.DATABASE_URL_TEST ?? environment.DATABASE_URL,
)
