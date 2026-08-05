export type EnvironmentMode = 'test' | 'live'

export const platformConfigStorageKey = 'bconomics-platform-config-v1'
export const environmentModeHeader = 'x-openbcon-environment-mode'

export function getClientEnvironmentMode(): EnvironmentMode {
  if (typeof window === 'undefined') return 'test'

  try {
    const raw = window.localStorage.getItem(platformConfigStorageKey)
    const parsed = raw ? (JSON.parse(raw) as { environmentMode?: unknown }) : null
    return parsed?.environmentMode === 'live' ? 'live' : 'test'
  } catch {
    return 'test'
  }
}

export function getEnvironmentModeHeaders() {
  return {
    [environmentModeHeader]: getClientEnvironmentMode(),
  }
}
