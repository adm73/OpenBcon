import {
  getClientEnvironmentMode,
  getEnvironmentModeHeaders,
  environmentModeHeader,
  platformConfigStorageKey,
  type EnvironmentMode,
} from '../lib/environmentMode'

export type PersistenceMode = 'database' | 'local'
export type PersistentStateScope = 'platform' | 'workspace' | 'user'

type PendingMutation =
  | {
      operation: 'upsert'
      key: string
      scope: PersistentStateScope
      value: unknown
      mode: EnvironmentMode
    }
  | {
      operation: 'delete'
      key: string
      scope: PersistentStateScope
      mode: EnvironmentMode
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

async function sendMutations(mutations: PendingMutation[], mode: EnvironmentMode) {
  const response = await fetch(`${apiBaseUrl}/state/batch`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      [environmentModeHeader]: mode,
    },
    credentials: 'include',
    body: JSON.stringify({
      mutations: mutations.map(({ mode: _mode, ...mutation }) => mutation),
    }),
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
  const mutationsByMode = new Map<EnvironmentMode, PendingMutation[]>()
  for (const mutation of mutations) {
    const modeMutations = mutationsByMode.get(mutation.mode) ?? []
    modeMutations.push(mutation)
    mutationsByMode.set(mutation.mode, modeMutations)
  }

  for (const [mode, modeMutations] of mutationsByMode) {
    try {
      await sendMutations(modeMutations, mode)
    } catch {
      for (const mutation of modeMutations) {
        const mutationKey = `${mutation.mode}:${mutation.key}`
        if (!pendingMutations.has(mutationKey)) {
          pendingMutations.set(mutationKey, mutation)
        }
      }
      flushTimer = setTimeout(flushPendingMutations, 2_000)
    }
  }
}

function queueMutation(mutation: PendingMutation) {
  if (!remotePersistenceReady) return
  pendingMutations.set(`${mutation.mode}:${mutation.key}`, mutation)
  if (flushTimer) clearTimeout(flushTimer)
  flushTimer = setTimeout(flushPendingMutations, 180)
}

export function setPersistentItem(key: string, value: string) {
  window.localStorage.setItem(key, value)
  if (!isRemotePersistentStateKey(key)) return

  const mode = getClientEnvironmentMode()
  queueMutation({
    operation: 'upsert',
    key,
    scope: getPersistentStateScope(key),
    value: parseStoredValue(value),
    mode,
  })
}

export async function persistPersistentItem(
  key: string,
  value: string,
): Promise<PersistenceMode> {
  window.localStorage.setItem(key, value)
  if (!isRemotePersistentStateKey(key) || !remotePersistenceReady) {
    return 'local'
  }

  const mode = getClientEnvironmentMode()
  const mutation: PendingMutation = {
    operation: 'upsert',
    key,
    scope: getPersistentStateScope(key),
    value: parseStoredValue(value),
    mode,
  }
  pendingMutations.delete(`${mode}:${key}`)

  try {
    await sendMutations([mutation], mode)
    return 'database'
  } catch (error) {
    pendingMutations.set(`${mode}:${key}`, mutation)
    if (flushTimer) clearTimeout(flushTimer)
    flushTimer = setTimeout(flushPendingMutations, 2_000)
    throw error
  }
}

export function setPersistentItemWithRemoteValue(
  key: string,
  localValue: string,
  remoteValue: unknown,
) {
  window.localStorage.setItem(key, localValue)
  if (!isRemotePersistentStateKey(key)) return

  const mode = getClientEnvironmentMode()
  queueMutation({
    operation: 'upsert',
    key,
    scope: getPersistentStateScope(key),
    value: remoteValue,
    mode,
  })
}

export function removePersistentItem(key: string) {
  window.localStorage.removeItem(key)
  if (!isRemotePersistentStateKey(key)) return

  const mode = getClientEnvironmentMode()
  queueMutation({
    operation: 'delete',
    key,
    scope: getPersistentStateScope(key),
    mode,
  })
}

export async function hydratePersistentStorage(): Promise<PersistenceMode> {
  if (!persistenceEnabled) return 'local'

  const localValues = collectLocalState()
  const mode = getClientEnvironmentMode()
  try {
    const response = await fetch(`${apiBaseUrl}/bootstrap`, {
      signal: AbortSignal.timeout(3_000),
      credentials: 'include',
      headers: getEnvironmentModeHeaders(),
    })
    if (!response.ok) return 'local'

    const bootstrap = (await response.json()) as BootstrapResponse
    const remoteValues = bootstrap.values ?? {}
    const localPlatformConfig = localValues[platformConfigStorageKey]
    for (const [key, value] of Object.entries(remoteValues)) {
      const nextValue =
        key === platformConfigStorageKey && value && typeof value === 'object'
          ? {
              ...(value as Record<string, unknown>),
              environmentMode: mode,
            }
          : value
      window.localStorage.setItem(key, serializeStoredValue(nextValue))
    }

    // The selected mode is the cache namespace. Never copy a missing value
    // from one mode into the other mode's database during hydration.
    const localValuesToSync: PendingMutation[] = []
    for (const key of Object.keys(localValues)) {
      if (key !== platformConfigStorageKey && !(key in remoteValues)) {
        if (key === 'bconomics-user-settings-v1') {
          localValuesToSync.push({
            operation: 'upsert',
            key,
            scope: 'user',
            value: localValues[key],
            mode,
          })
          continue
        }
        window.localStorage.removeItem(key)
      }
    }
    if (!(platformConfigStorageKey in remoteValues) && localPlatformConfig) {
      window.localStorage.setItem(
        platformConfigStorageKey,
        serializeStoredValue({
          ...(localPlatformConfig as Record<string, unknown>),
          environmentMode: mode,
        }),
      )
    }

    remotePersistenceReady = true
    for (const mutation of localValuesToSync) {
      queueMutation(mutation)
    }
    return 'database'
  } catch {
    return 'local'
  }
}
