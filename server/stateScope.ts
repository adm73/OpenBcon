export type StateScope = 'platform' | 'workspace' | 'user'

const platformStateKeys = new Set([
  'bconomics-platform-config-v1',
  'bconomics-synced-funding-programs-v1',
  'bconomics-synced-resource-records-v1',
])

const userStateKeys = new Set([
  'bconomics-user-settings-v1',
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
  'bconomics-quick-generate-draft-v1',
  'bconomics-generated-documents-v1',
])

export const persistentStateKeys = [
  ...platformStateKeys,
  ...userStateKeys,
  ...workspaceStateKeys,
]

export function isPersistentStateKey(key: string) {
  return (
    platformStateKeys.has(key) ||
    userStateKeys.has(key) ||
    workspaceStateKeys.has(key)
  )
}

export function getStateScope(key: string): StateScope {
  if (platformStateKeys.has(key)) return 'platform'
  if (userStateKeys.has(key)) return 'user'
  return 'workspace'
}
