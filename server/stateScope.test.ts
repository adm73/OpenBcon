import { describe, expect, it } from 'vitest'
import { getStateScope, isPersistentStateKey } from './stateScope'

describe('state scope routing', () => {
  it('keeps administrator configuration at platform scope', () => {
    expect(getStateScope('bconomics-platform-config-v1')).toBe('platform')
  })

  it('keeps personal preferences at user scope', () => {
    expect(getStateScope('bconomics-user-settings-v1')).toBe('user')
    expect(getStateScope('bconomics-billing-transactions-v1')).toBe('user')
    expect(getStateScope('bconomics-active-workspace-v2')).toBe('user')
  })

  it('defaults domain data to workspace scope', () => {
    expect(getStateScope('bconomics-company-portfolio-v1')).toBe('workspace')
    expect(getStateScope('bconomics-applications-v1')).toBe('workspace')
  })

  it('rejects authentication secrets from persistent state', () => {
    expect(isPersistentStateKey('bconomics-access-token')).toBe(false)
    expect(isPersistentStateKey('bconomics-session')).toBe(false)
  })

  it('treats settings state as local-only rather than remote-persisted', () => {
    expect(isPersistentStateKey('bconomics-platform-config-v1')).toBe(false)
    expect(isPersistentStateKey('bconomics-user-settings-v1')).toBe(false)
    expect(isPersistentStateKey('bconomics-billing-transactions-v1')).toBe(
      false,
    )
  })
})
