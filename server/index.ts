import { createApp } from './app'
import { environment } from './config'
import { runMigrations } from './db/migrate'
import { createDatabasePool, databasePool } from './db/pool'
import { seedDatabase } from './db/seed'
import { createDocumentStore, createSharedDocumentStore } from './documentStore'

let liveDatabasePool: ReturnType<typeof createDatabasePool> | undefined
let sharedDatabasePool: ReturnType<typeof createDatabasePool> | undefined

async function startServer() {
  const sharedDatabaseUrl =
    environment.DATABASE_URL_SHARED ?? environment.DATABASE_URL_TEST ?? environment.DATABASE_URL
  const testDatabaseUrl = environment.DATABASE_URL_TEST ?? environment.DATABASE_URL
  sharedDatabasePool =
    sharedDatabaseUrl === testDatabaseUrl
      ? databasePool
      : createDatabasePool(sharedDatabaseUrl)
  if (environment.AUTO_MIGRATE) await runMigrations(databasePool)
  if (sharedDatabasePool !== databasePool && environment.AUTO_MIGRATE) {
    await runMigrations(sharedDatabasePool)
  }
  if (environment.SEED_DEMO_DATA) {
    await seedDatabase(databasePool, sharedDatabasePool)
  }

  const testDocumentStore = createDocumentStore(
    environment.MONGODB_DATABASE_TEST ?? environment.MONGODB_DATABASE,
  )
  const sharedDocumentStore = createSharedDocumentStore()
  liveDatabasePool = environment.DATABASE_URL_LIVE
    ? createDatabasePool(environment.DATABASE_URL_LIVE)
    : undefined
  if (liveDatabasePool && environment.AUTO_MIGRATE) {
    await runMigrations(liveDatabasePool)
  }
  const liveDocumentStore = environment.MONGODB_DATABASE_LIVE
    ? createDocumentStore(environment.MONGODB_DATABASE_LIVE)
    : undefined
  const app = createApp(databasePool, testDocumentStore, {
    live:
      liveDatabasePool && liveDocumentStore
        ? { database: liveDatabasePool, documentStore: liveDocumentStore }
        : undefined,
  }, sharedDatabasePool, sharedDocumentStore)
  const server = app.listen(
    environment.API_PORT,
    environment.API_HOST,
    () => {
      process.stdout.write(
        `Bconomics API listening on http://${environment.API_HOST}:${environment.API_PORT}\n`,
      )
    },
  )

  async function shutDown() {
    server.close(async () => {
      await databasePool.end()
      await liveDatabasePool?.end()
      if (sharedDatabasePool && sharedDatabasePool !== databasePool && sharedDatabasePool !== liveDatabasePool) {
        await sharedDatabasePool.end()
      }
      process.exit(0)
    })
  }

  process.on('SIGINT', shutDown)
  process.on('SIGTERM', shutDown)
}

startServer().catch(async (error: unknown) => {
  process.stderr.write(
    `Bconomics API failed to start: ${
      error instanceof Error ? error.message : String(error)
    }\n`,
  )
  await databasePool.end()
  await liveDatabasePool?.end()
  process.exitCode = 1
})
