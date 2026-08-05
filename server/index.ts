import { createApp } from './app'
import { environment } from './config'
import { runMigrations } from './db/migrate'
import { createDatabasePool, databasePool } from './db/pool'
import { seedDatabase } from './db/seed'
import { createDocumentStore } from './documentStore'

let liveDatabasePool: ReturnType<typeof createDatabasePool> | undefined

async function startServer() {
  if (environment.AUTO_MIGRATE) await runMigrations()
  if (environment.SEED_DEMO_DATA) await seedDatabase()

  const testDocumentStore = createDocumentStore(
    environment.MONGODB_DATABASE_TEST ?? environment.MONGODB_DATABASE,
  )
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
  })
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
