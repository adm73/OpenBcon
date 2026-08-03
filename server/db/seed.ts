import { environment } from '../config'
import { databasePool } from './pool'

export async function seedDatabase() {
  const client = await databasePool.connect()
  try {
    await client.query('BEGIN')
    const userResult = await client.query<{ id: string }>(
      `
        INSERT INTO app_users (email, display_name, role, password_hash)
        VALUES (
          'alex@northstarfoods.ca',
          'Alex Morgan',
          'owner',
          CASE
            WHEN NULLIF($1, '') IS NULL THEN NULL
            ELSE crypt($1, gen_salt('bf'))
          END
        )
        ON CONFLICT (email) DO UPDATE SET
          email = EXCLUDED.email,
          display_name = EXCLUDED.display_name,
          role = EXCLUDED.role,
          password_hash = COALESCE(EXCLUDED.password_hash, app_users.password_hash)
        RETURNING id
      `,
      [environment.DEMO_USER_PASSWORD ?? ''],
    )
    const userId = userResult.rows[0]?.id ?? environment.DEMO_USER_ID
    await client.query(
      `
        SELECT setval(
          pg_get_serial_sequence('app_users', 'id'),
          GREATEST((SELECT COALESCE(MAX(id), 1) FROM app_users), 1),
          true
        )
      `,
    )
    await client.query(
      `
        INSERT INTO workspaces (id, name, slug, kind, created_by)
        VALUES ($1, 'Community workspace', 'community-workspace', 'founder', $2)
        ON CONFLICT (id) DO UPDATE SET
          name = EXCLUDED.name,
          kind = EXCLUDED.kind
      `,
      [environment.DEMO_WORKSPACE_ID, userId],
    )
    await client.query(
      `
        INSERT INTO workspace_members (workspace_id, user_id, role)
        VALUES ($1, $2, 'owner')
        ON CONFLICT (workspace_id, user_id) DO UPDATE SET role = EXCLUDED.role
      `,
      [environment.DEMO_WORKSPACE_ID, userId],
    )
    await client.query('COMMIT')
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  seedDatabase()
    .then(async () => {
      await databasePool.end()
    })
    .catch(async (error: unknown) => {
      process.stderr.write(
        `Database seed failed: ${
          error instanceof Error ? error.message : String(error)
        }\n`,
      )
      await databasePool.end()
      process.exitCode = 1
    })
}
