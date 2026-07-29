import { describe, expect, it } from 'vitest'
import { getPersistentStateScope, isPersistentStateKey } from './storage'

describe('browser persistence scopes', () => {
  it('routes configuration to the platform', () => {
    expect(getPersistentStateScope('bconomics-platform-config-v1')).toBe(
      'platform',
    )
  })

  it('routes personal settings to the user', () => {
    expect(getPersistentStateScope('bconomics-user-settings-v1')).toBe('user')
  })

  it('routes domain data to the workspace', () => {
    expect(getPersistentStateScope('bconomics-company-portfolio-v1')).toBe(
      'workspace',
    )
    expect(getPersistentStateScope('bconomics-applications-v1')).toBe(
      'workspace',
    )
  })

  it('never persists authentication credentials', () => {
    expect(isPersistentStateKey('bconomics-access-token')).toBe(false)
    expect(isPersistentStateKey('bconomics-refresh-token')).toBe(false)
    expect(isPersistentStateKey('bconomics-session')).toBe(false)
  })
})
