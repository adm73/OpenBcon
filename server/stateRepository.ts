import type { Pool } from 'pg'
import { platformOwnerId } from './config'
import type { DocumentStore } from './documentStore'
import { readApplicationsForWorkspace, syncApplicationsSnapshot } from './applicationRepository'
import {
  redactPlatformConfigForClient,
  securePlatformConfigForPersistence,
} from './secureState'
import { persistentStateKeys, type StateScope } from './stateScope'

export type QueryClient = Pick<Pool, 'query'>

export type RequestContext = {
  userId: string
  workspaceId: string
  role: string
}

export class AuthorizationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'AuthorizationError'
  }
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

function getOwnerId(scope: StateScope, context: RequestContext) {
  if (scope === 'platform') return platformOwnerId
  if (scope === 'user') return context.userId
  return context.workspaceId
}

export async function readBootstrapState(
  database: QueryClient,
  documentStore: DocumentStore,
  context: RequestContext,
) {
  const rows = await documentStore.findState({
    scopes: ['platform', 'workspace', 'user'],
    ownerIds: [platformOwnerId, context.workspaceId, context.userId],
    keys: [...persistentStateKeys],
  })

  const values: Record<string, unknown> = {}
  let updatedAt: Date | null = null
  for (const row of rows) {
    values[row.key] =
      row.key === 'bconomics-platform-config-v1'
        ? redactPlatformConfigForClient(row.value)
        : row.value
    if (!updatedAt || row.updatedAt > updatedAt) updatedAt = row.updatedAt
  }

  const applications = await readApplicationsForWorkspace(database, context.workspaceId)
  if (applications.length > 0) {
    values['bconomics-applications-v1'] = applications
  }

  return {
    values,
    updatedAt: updatedAt?.toISOString() ?? null,
  }
}

export async function readPlatformStateValue(
  documentStore: DocumentStore,
  key: string,
) {
  return documentStore.findStateValue('platform', platformOwnerId, key)
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
      VALUES ($1, $2, $3, $4, $5, $6::jsonb)
    `,
    [
      context.workspaceId,
      context.userId,
      mutation.operation === 'upsert' ? 'state.updated' : 'state.deleted',
      mutation.key === 'bconomics-applications-v1' ? 'applications' : 'dynamic_state',
      mutation.key,
      JSON.stringify({ scope: mutation.scope }),
    ],
  )
}

export async function applyStateMutation(
  database: QueryClient,
  documentStore: DocumentStore,
  context: RequestContext,
  mutation: StateMutation,
) {
  if (
    mutation.scope === 'platform' &&
    context.role !== 'admin' &&
    context.role !== 'owner'
  ) {
    throw new AuthorizationError(
      'Only platform administrators can change platform settings.',
    )
  }

  const ownerId = getOwnerId(mutation.scope, context)

  if (mutation.operation === 'delete') {
    await documentStore.deleteState(mutation.scope, ownerId, mutation.key)
  } else {
    const value =
      mutation.scope === 'platform' &&
      mutation.key === 'bconomics-platform-config-v1'
        ? securePlatformConfigForPersistence(
            mutation.value,
            await documentStore.findStateValue('platform', platformOwnerId, mutation.key),
          )
        : mutation.value
    await documentStore.upsertState({
      scope: mutation.scope,
      ownerId,
      key: mutation.key,
      value,
      updatedAt: new Date(),
    })
    if (mutation.key === 'bconomics-applications-v1') {
      await syncApplicationsSnapshot(database, context.workspaceId, mutation.value)
    }
  }

  await writeAuditLog(database, context, mutation)
}

export async function applyStateBatch(
  database: QueryClient,
  documentStore: DocumentStore,
  context: RequestContext,
  mutations: StateMutation[],
) {
  if (
    context.role !== 'admin' &&
    context.role !== 'owner' &&
    mutations.some((mutation) => mutation.scope === 'platform')
  ) {
    throw new AuthorizationError(
      'Only platform administrators can change platform settings.',
    )
  }

  for (const mutation of mutations) {
    await applyStateMutation(database, documentStore, context, mutation)
  }
}
