import { databasePool } from './pool'
import { createDocumentStore } from '../documentStore'

async function migrateAppStateToMongo() {
  const documentStore = createDocumentStore()
  const tableResult = await databasePool.query<{ table_name: string | null }>(
    `SELECT to_regclass('public.app_state') AS table_name`,
  )
  if (!tableResult.rows[0]?.table_name) {
    process.stdout.write('No PostgreSQL app_state table found; nothing to migrate.\n')
    return
  }

  const result = await databasePool.query<{
    scope: 'platform' | 'workspace' | 'user'
    owner_id: string
    key: string
    value: unknown
    updated_at: Date
  }>(
    `
      SELECT scope, owner_id, key, value, updated_at
      FROM app_state
      ORDER BY updated_at ASC
    `,
  )

  for (const row of result.rows) {
    await documentStore.upsertState({
      scope: row.scope,
      ownerId: row.owner_id,
      key: row.key,
      value: row.value,
      updatedAt: row.updated_at,
    })
  }

  process.stdout.write(`Migrated ${result.rows.length} app_state documents to MongoDB.\n`)
}

migrateAppStateToMongo()
  .then(async () => {
    await databasePool.end()
  })
  .catch(async (error: unknown) => {
    process.stderr.write(
      `MongoDB state migration failed: ${
        error instanceof Error ? error.message : String(error)
      }\n`,
    )
    await databasePool.end()
    process.exitCode = 1
  })
