import { describe, expect, it } from 'vitest'
import {
  allDashboardItems,
  dashboardGroups,
  findDashboardItem,
  footerItems,
  quickActionRoutes,
} from './dashboard'

describe('dashboard navigation data', () => {
  it('uses unique, flat route identifiers', () => {
    const ids = allDashboardItems.map((item) => item.id)

    expect(new Set(ids).size).toBe(ids.length)
    expect(ids.every((id) => id.length > 0 && !id.includes('/'))).toBe(true)
  })

  it('uses the public Discovery and Strategic Reports route identifiers', () => {
    const ids = allDashboardItems.map((item) => item.id)

    expect(ids).toContain('discovery')
    expect(ids).toContain('strategic-reports')
    expect(ids).not.toContain('funding-readiness')
    expect(ids).not.toContain('advisory-hub')
  })

  it('resolves every configured dashboard item', () => {
    for (const item of allDashboardItems) {
      expect(findDashboardItem(item.id)).toBe(item)
    }
  })

  it('keeps quick actions linked to known modules', () => {
    const knownIds = new Set(
      dashboardGroups.flatMap((group) => group.items.map((item) => item.id)),
    )

    for (const action of quickActionRoutes) {
      expect(action.path.startsWith('/')).toBe(true)
      expect(knownIds.has(action.path.slice(1))).toBe(true)
    }
  })

  it('keeps subscription management inside settings', () => {
    expect(footerItems.map((item) => item.id)).toEqual(['settings'])
    expect(findDashboardItem('my-subscriptions')).toBeNull()
  })
})
