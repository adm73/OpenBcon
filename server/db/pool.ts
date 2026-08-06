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
          rejectUnauthorized: environment.DATABASE_SSL_REJECT_UNAUTHORIZED,
          ...(environment.DATABASE_SSL_CA
            ? { ca: environment.DATABASE_SSL_CA }
            : {}),
        }
      : undefined,
  })
}

export const databasePool = createDatabasePool(
  environment.DATABASE_URL_TEST ?? environment.DATABASE_URL,
)
