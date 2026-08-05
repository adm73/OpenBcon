import { readdir, readFile } from 'node:fs/promises'
import { join } from 'node:path'
import type { Pool } from 'pg'
import { databasePool } from './pool'

async function waitForDatabase(pool: Pool) {
  let lastError: unknown
  for (let attempt = 0; attempt < 30; attempt += 1) {
    try {
      await pool.query('SELECT 1')
      return
    } catch (error) {
      lastError = error
      await new Promise((resolve) => setTimeout(resolve, 500))
    }
  }
  throw lastError
}

export async function runMigrations(pool: Pool = databasePool) {
  await waitForDatabase(pool)
  await pool.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      name text PRIMARY KEY,
      applied_at timestamptz NOT NULL DEFAULT now()
    )
  `)

  const migrationsDirectory = join(
    process.cwd(),
    'server',
    'db',
    'migrations',
  )
  const migrationNames = (await readdir(migrationsDirectory))
    .filter((name) => name.endsWith('.sql'))
    .sort()

  for (const migrationName of migrationNames) {
    const applied = await pool.query<{ name: string }>(
      'SELECT name FROM schema_migrations WHERE name = $1',
      [migrationName],
    )
    if (applied.rowCount) continue

    const sql = await readFile(join(migrationsDirectory, migrationName), 'utf8')
    const client = await pool.connect()
    try {
      await client.query('BEGIN')
      await client.query(sql)
      await client.query(
        'INSERT INTO schema_migrations (name) VALUES ($1)',
        [migrationName],
      )
      await client.query('COMMIT')
    } catch (error) {
      await client.query('ROLLBACK')
      throw error
    } finally {
      client.release()
    }
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runMigrations()
    .then(async () => {
      await databasePool.end()
    })
    .catch(async (error: unknown) => {
      process.stderr.write(
        `Database migration failed: ${
          error instanceof Error ? error.message : String(error)
        }\n`,
      )
      await databasePool.end()
      process.exitCode = 1
    })
}
