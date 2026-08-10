export type EnvironmentMode = 'test' | 'live'

export const platformConfigStorageKey = 'bconomics-platform-config-v1'

// This value is only used for browser cache/display state. The server chooses
// the database boundary from OPENBCON_ENVIRONMENT_MODE and ignores client mode.
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
