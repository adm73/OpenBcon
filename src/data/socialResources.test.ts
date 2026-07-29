import { describe, expect, it } from 'vitest'
import {
  builtInSocialResources,
  mapSyncedSocialResources,
} from './socialResources'

describe('social resource catalog', () => {
  it('provides a varied people and organization network', () => {
    expect(builtInSocialResources).toHaveLength(8)
    expect(new Set(builtInSocialResources.map((resource) => resource.type))).toContain(
      'Investor',
    )
    expect(new Set(builtInSocialResources.map((resource) => resource.type))).toContain(
      'VC Fund',
    )
    expect(builtInSocialResources.every((resource) => resource.sectors.length > 0)).toBe(
      true,
    )
  })

  it('classifies synchronized network records', () => {
    const [resource] = mapSyncedSocialResources([
      {
        id: 'social-1',
        module: 'social-resources',
        title: 'Northern Seed Ventures',
        description: 'A venture fund investing in Canadian founders.',
        category: 'Investment firm',
        status: 'Active',
        url: 'https://example.com/resource',
        updatedAt: 'Today',
        sourceId: 'airtable-social',
        sourceName: 'Social library',
      },
    ])

    expect(resource.type).toBe('VC Fund')
    expect(resource.verified).toBe(true)
    expect(resource.connection).toBe('Open to introductions')
    expect(resource.sourceName).toBe('Social library')
  })
})
