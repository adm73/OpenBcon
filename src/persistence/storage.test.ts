import { describe, expect, it } from 'vitest'
import {
  getPersistentStateScope,
  isPersistentStateKey,
  isRemotePersistentStateKey,
} from './storage'

describe('browser persistence scopes', () => {
  it('routes configuration to the platform', () => {
    expect(getPersistentStateScope('bconomics-platform-config-v1')).toBe(
      'platform',
    )
  })

  it('routes personal settings to the user', () => {
    expect(getPersistentStateScope('bconomics-user-settings-v1')).toBe('user')
    expect(getPersistentStateScope('bconomics-billing-transactions-v1')).toBe(
      'user',
    )
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

  it('keeps settings local without sending them to the remote store', () => {
    expect(isPersistentStateKey('bconomics-platform-config-v1')).toBe(true)
    expect(isPersistentStateKey('bconomics-user-settings-v1')).toBe(true)
    expect(isPersistentStateKey('bconomics-billing-transactions-v1')).toBe(true)

    expect(isRemotePersistentStateKey('bconomics-platform-config-v1')).toBe(
      false,
    )
    expect(isRemotePersistentStateKey('bconomics-user-settings-v1')).toBe(
      false,
    )
    expect(
      isRemotePersistentStateKey('bconomics-billing-transactions-v1'),
    ).toBe(false)
  })
})
