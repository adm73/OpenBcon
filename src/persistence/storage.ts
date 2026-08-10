import {
  getClientEnvironmentMode,
  platformConfigStorageKey,
} from '../lib/environmentMode'

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
  'bconomics-billing-transactions-v1',
])

const apiBaseUrl = import.meta.env.VITE_API_URL ?? '/api'
const companyPortfolioStorageKey = 'bconomics-company-portfolio-v1'
const fundingProgramStorageKey = 'bconomics-synced-funding-programs-v1'
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
    headers: { 'content-type': 'application/json' },
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

export async function persistPersistentItem(
  key: string,
  value: string,
): Promise<PersistenceMode> {
  window.localStorage.setItem(key, value)
  if (!isRemotePersistentStateKey(key) || !remotePersistenceReady) {
    return 'local'
  }

  const mutation: PendingMutation = {
    operation: 'upsert',
    key,
    scope: getPersistentStateScope(key),
    value: parseStoredValue(value),
  }
  pendingMutations.delete(key)

  try {
    await sendMutations([mutation])
    return 'database'
  } catch (error) {
    pendingMutations.set(key, mutation)
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
  let mode = getClientEnvironmentMode()
  try {
    const runtimeResponse = await fetch(`${apiBaseUrl}/runtime/environment`, {
      signal: AbortSignal.timeout(3_000),
      credentials: 'include',
    })
    if (runtimeResponse.ok) {
      const runtime = (await runtimeResponse.json()) as {
        activeEnvironmentMode?: unknown
        environmentMode?: unknown
      }
      const activeMode = runtime.activeEnvironmentMode ?? runtime.environmentMode
      mode = activeMode === 'live' ? 'live' : 'test'
    }

    const response = await fetch(`${apiBaseUrl}/bootstrap`, {
      signal: AbortSignal.timeout(3_000),
      credentials: 'include',
    })
    if (!response.ok) return 'local'

    const bootstrap = (await response.json()) as BootstrapResponse
    const remoteValues = bootstrap.values ?? {}
    let companiesLoaded = false
    let fundingProgramsLoaded = false
    const companiesResponse = await fetch(`${apiBaseUrl}/companies`, {
      signal: AbortSignal.timeout(3_000),
      credentials: 'include',
    })
    if (companiesResponse.ok) {
      const companiesBody = (await companiesResponse.json()) as {
        companies?: unknown[]
      }
      remoteValues[companyPortfolioStorageKey] = Array.isArray(companiesBody.companies)
        ? companiesBody.companies
        : []
      companiesLoaded = true
    }
    const fundingProgramsResponse = await fetch(`${apiBaseUrl}/funding-programs`, {
      signal: AbortSignal.timeout(3_000),
      credentials: 'include',
    })
    if (fundingProgramsResponse.ok) {
      const fundingProgramsBody = (await fundingProgramsResponse.json()) as {
        programs?: unknown[]
      }
      remoteValues[fundingProgramStorageKey] = Array.isArray(fundingProgramsBody.programs)
        ? fundingProgramsBody.programs
        : []
      fundingProgramsLoaded = true
    }
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
      if (
        key !== platformConfigStorageKey &&
        !(key in remoteValues) &&
        !(key === companyPortfolioStorageKey && !companiesLoaded) &&
        !(key === fundingProgramStorageKey && !fundingProgramsLoaded)
      ) {
        if (key === 'bconomics-user-settings-v1') {
          localValuesToSync.push({
            operation: 'upsert',
            key,
            scope: 'user',
            value: localValues[key],
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
