import { createApp } from './app'
import { environment } from './config'
import { runMigrations } from './db/migrate'
import { databasePool } from './db/pool'
import { seedDatabase } from './db/seed'

async function startServer() {
  if (environment.AUTO_MIGRATE) await runMigrations()
  if (environment.SEED_DEMO_DATA) await seedDatabase()

  const app = createApp(databasePool)
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
  process.exitCode = 1
})
