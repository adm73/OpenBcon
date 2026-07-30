export type StateScope = 'platform' | 'workspace' | 'user'

const remotePlatformStateKeys = new Set([
  'bconomics-synced-funding-programs-v1',
  'bconomics-synced-resource-records-v1',
])

const localOnlyPlatformStateKeys = new Set(['bconomics-platform-config-v1'])

const remoteUserStateKeys = new Set([
  'bconomics-quick-generate-preferences-v1',
  'bconomics-pinned-social-resources-v1',
  'bconomics-saved-tools-v1',
  'bconomics-workspaces-v2',
  'bconomics-active-workspace-v2',
])

const localOnlyUserStateKeys = new Set([
  'bconomics-user-settings-v1',
  'bconomics-billing-transactions-v1',
])

const workspaceStateKeys = new Set([
  'bconomics-company-portfolio-v1',
  'bconomics-applications-v1',
  'bconomics-saved-programs-v1',
  'bconomics-selected-funding-program-v1',
  'bconomics-selected-template-v1',
  'bconomics-quick-generate-draft-v1',
])

export const persistentStateKeys = [
  ...remotePlatformStateKeys,
  ...remoteUserStateKeys,
  ...workspaceStateKeys,
]

export function isPersistentStateKey(key: string) {
  return (
    remotePlatformStateKeys.has(key) ||
    remoteUserStateKeys.has(key) ||
    workspaceStateKeys.has(key)
  )
}

export function getStateScope(key: string): StateScope {
  if (remotePlatformStateKeys.has(key) || localOnlyPlatformStateKeys.has(key)) {
    return 'platform'
  }
  if (remoteUserStateKeys.has(key) || localOnlyUserStateKeys.has(key)) {
    return 'user'
  }
  return 'workspace'
}
