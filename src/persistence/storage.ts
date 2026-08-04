export type PersistenceMode = 'database' | 'local'
export type PersistentStateScope = 'platform' | 'workspace' | 'user'

type PendingMutation =
  | {
      operation: 'upsert'
      key: string
      scope: PersistentStateScope
      value: unknown
    }
  | {
      operation: 'delete'
      key: string
      scope: PersistentStateScope
    }

type BootstrapResponse = {
  values: Record<string, unknown>
}

const platformStateKeys = new Set([
  'bconomics-platform-config-v1',
  'bconomics-synced-funding-programs-v1',
  'bconomics-synced-resource-records-v1',
])

const userStateKeys = new Set([
  'bconomics-user-settings-v1',
  'bconomics-billing-transactions-v1',
  'bconomics-quick-build-preferences-v1',
  'bconomics-pinned-social-resources-v1',
  'bconomics-saved-tools-v1',
  'bconomics-workspaces-v2',
  'bconomics-active-workspace-v2',
])

const workspaceStateKeys = new Set([
  'bconomics-company-portfolio-v1',
  'bconomics-applications-v1',
  'bconomics-saved-programs-v1',
  'bconomics-selected-funding-program-v1',
  'bconomics-selected-template-v1',
  'bconomics-quick-build-draft-v1',
])

const persistentStateKeys = new Set([
  ...platformStateKeys,
  ...userStateKeys,
  ...workspaceStateKeys,
])

const localOnlyStateKeys = new Set([
  'bconomics-user-settings-v1',
  'bconomics-billing-transactions-v1',
])

const apiBaseUrl = import.meta.env.VITE_API_URL ?? '/api'
const persistenceEnabled =
  import.meta.env.VITE_PERSISTENCE_ENABLED !== 'false'
const pendingMutations = new Map<string, PendingMutation>()
let remotePersistenceReady = false
let flushTimer: ReturnType<typeof setTimeout> | undefined

export function getPersistentStateScope(
  key: string,
): PersistentStateScope {
  if (platformStateKeys.has(key)) return 'platform'
  if (userStateKeys.has(key)) return 'user'
  return 'workspace'
}

export function isPersistentStateKey(key: string) {
  return persistentStateKeys.has(key)
}

export function isRemotePersistentStateKey(key: string) {
  return isPersistentStateKey(key) && !localOnlyStateKeys.has(key)
}

function parseStoredValue(value: string): unknown {
  try {
    return JSON.parse(value) as unknown
  } catch {
    return value
  }
}

function serializeStoredValue(value: unknown) {
  return typeof value === 'string' ? value : JSON.stringify(value)
}

function collectLocalState() {
  const values: Record<string, unknown> = {}
  for (let index = 0; index < window.localStorage.length; index += 1) {
    const key = window.localStorage.key(index)
    if (!key || !isRemotePersistentStateKey(key)) continue

    const value = window.localStorage.getItem(key)
    if (value !== null) values[key] = parseStoredValue(value)
  }
  return values
}

async function sendMutations(mutations: PendingMutation[]) {
  const response = await fetch(`${apiBaseUrl}/state/batch`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
    },
    credentials: 'include',
    body: JSON.stringify({ mutations }),
    keepalive: true,
  })
  if (!response.ok) {
    throw new Error(`Persistence request failed with ${response.status}.`)
  }
}

async function flushPendingMutations() {
  flushTimer = undefined
  if (!remotePersistenceReady || pendingMutations.size === 0) return

  const mutations = [...pendingMutations.values()]
  pendingMutations.clear()
  try {
    await sendMutations(mutations)
  } catch {
    for (const mutation of mutations) {
      if (!pendingMutations.has(mutation.key)) {
        pendingMutations.set(mutation.key, mutation)
      }
    }
    flushTimer = setTimeout(flushPendingMutations, 2_000)
  }
}

function queueMutation(mutation: PendingMutation) {
  if (!remotePersistenceReady) return
  pendingMutations.set(mutation.key, mutation)
  if (flushTimer) clearTimeout(flushTimer)
  flushTimer = setTimeout(flushPendingMutations, 180)
}

export function setPersistentItem(key: string, value: string) {
  window.localStorage.setItem(key, value)
  if (!isRemotePersistentStateKey(key)) return

  queueMutation({
    operation: 'upsert',
    key,
    scope: getPersistentStateScope(key),
    value: parseStoredValue(value),
  })
}

export function setPersistentItemWithRemoteValue(
  key: string,
  localValue: string,
  remoteValue: unknown,
) {
  window.localStorage.setItem(key, localValue)
  if (!isRemotePersistentStateKey(key)) return

  queueMutation({
    operation: 'upsert',
    key,
    scope: getPersistentStateScope(key),
    value: remoteValue,
  })
}

export function removePersistentItem(key: string) {
  window.localStorage.removeItem(key)
  if (!isRemotePersistentStateKey(key)) return

  queueMutation({
    operation: 'delete',
    key,
    scope: getPersistentStateScope(key),
  })
}

export async function hydratePersistentStorage(): Promise<PersistenceMode> {
  if (!persistenceEnabled) return 'local'

  const localValues = collectLocalState()
  try {
    const response = await fetch(`${apiBaseUrl}/bootstrap`, {
      signal: AbortSignal.timeout(3_000),
      credentials: 'include',
    })
    if (!response.ok) return 'local'

    const bootstrap = (await response.json()) as BootstrapResponse
    const remoteValues = bootstrap.values ?? {}
    for (const [key, value] of Object.entries(remoteValues)) {
      window.localStorage.setItem(key, serializeStoredValue(value))
    }

    const localOnlyMutations = Object.entries(localValues)
      .filter(([key]) => !(key in remoteValues))
      .map(
        ([key, value]): PendingMutation => ({
          operation: 'upsert',
          key,
          scope: getPersistentStateScope(key),
          value,
        }),
      )
    if (localOnlyMutations.length > 0) {
      await sendMutations(localOnlyMutations)
    }

    remotePersistenceReady = true
    return 'database'
  } catch {
    return 'local'
  }
}
