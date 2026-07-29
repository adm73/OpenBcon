import type { Pool, PoolClient } from 'pg'
import { platformOwnerId } from './config'
import { persistentStateKeys, type StateScope } from './stateScope'

type QueryClient = Pick<Pool, 'query'> | Pick<PoolClient, 'query'>

export type RequestContext = {
  userId: string
  workspaceId: string
}

export type StateMutation =
  | {
      operation: 'upsert'
      key: string
      scope: StateScope
      value: unknown
    }
  | {
      operation: 'delete'
      key: string
      scope: StateScope
    }

type StateRow = {
  scope: StateScope
  key: string
  value: unknown
  updated_at: Date
}

function getOwnerId(scope: StateScope, context: RequestContext) {
  if (scope === 'platform') return platformOwnerId
  if (scope === 'user') return context.userId
  return context.workspaceId
}

export async function readBootstrapState(
  database: QueryClient,
  context: RequestContext,
) {
  const result = await database.query<StateRow>(
    `
      SELECT scope, key, value, updated_at
      FROM app_state
      WHERE (
        (scope = 'platform' AND owner_id = $1)
        OR (scope = 'workspace' AND owner_id = $2)
        OR (scope = 'user' AND owner_id = $3)
      )
      AND key = ANY($4::text[])
      ORDER BY
        CASE scope
          WHEN 'platform' THEN 1
          WHEN 'workspace' THEN 2
          WHEN 'user' THEN 3
        END,
        updated_at ASC
    `,
    [
      platformOwnerId,
      context.workspaceId,
      context.userId,
      persistentStateKeys,
    ],
  )

  const values: Record<string, unknown> = {}
  let updatedAt: Date | null = null
  for (const row of result.rows) {
    values[row.key] = row.value
    if (!updatedAt || row.updated_at > updatedAt) updatedAt = row.updated_at
  }

  return {
    values,
    updatedAt: updatedAt?.toISOString() ?? null,
  }
}

async function writeAuditLog(
  database: QueryClient,
  context: RequestContext,
  mutation: StateMutation,
) {
  await database.query(
    `
      INSERT INTO audit_logs (
        workspace_id,
        actor_user_id,
        action,
        entity_type,
        entity_key,
        metadata
      )
      VALUES ($1, $2, $3, 'app_state', $4, $5::jsonb)
    `,
    [
      context.workspaceId,
      context.userId,
      mutation.operation === 'upsert' ? 'state.updated' : 'state.deleted',
      mutation.key,
      JSON.stringify({ scope: mutation.scope }),
    ],
  )
}

export async function applyStateMutation(
  database: QueryClient,
  context: RequestContext,
  mutation: StateMutation,
) {
  const ownerId = getOwnerId(mutation.scope, context)

  if (mutation.operation === 'delete') {
    await database.query(
      'DELETE FROM app_state WHERE scope = $1 AND owner_id = $2 AND key = $3',
      [mutation.scope, ownerId, mutation.key],
    )
  } else {
    await database.query(
      `
        INSERT INTO app_state (
          scope,
          owner_id,
          key,
          value,
          updated_by
        )
        VALUES ($1, $2, $3, $4::jsonb, $5)
        ON CONFLICT (scope, owner_id, key)
        DO UPDATE SET
          value = EXCLUDED.value,
          version = app_state.version + 1,
          updated_by = EXCLUDED.updated_by
      `,
      [
        mutation.scope,
        ownerId,
        mutation.key,
        JSON.stringify(mutation.value),
        context.userId,
      ],
    )
  }

  await writeAuditLog(database, context, mutation)
}

export async function applyStateBatch(
  database: Pool,
  context: RequestContext,
  mutations: StateMutation[],
) {
  const client = await database.connect()
  try {
    await client.query('BEGIN')
    for (const mutation of mutations) {
      await applyStateMutation(client, context, mutation)
    }
    await client.query('COMMIT')
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
  }
}
