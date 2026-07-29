import { describe, expect, it } from 'vitest'
import { builtInTools, mapSyncedTools } from './tools'

describe('tool catalog', () => {
  it('provides a varied entrepreneur software and services directory', () => {
    expect(builtInTools).toHaveLength(8)
    expect(new Set(builtInTools.map((tool) => tool.type))).toContain('Cloud Service')
    expect(new Set(builtInTools.map((tool) => tool.type))).toContain('Credit Card')
    expect(builtInTools.every((tool) => tool.url.startsWith('https://'))).toBe(true)
  })

  it('classifies synchronized tool records', () => {
    const [tool] = mapSyncedTools([
      {
        id: 'tool-1',
        module: 'tools',
        title: 'Founder Business Visa',
        description: 'A credit card for business expenses.',
        category: 'Business banking',
        status: 'Active',
        url: 'https://example.com/cards/founder',
        updatedAt: 'Today',
        sourceId: 'sheet-tools',
        sourceName: 'Tools directory',
      },
    ])

    expect(tool.type).toBe('Credit Card')
    expect(tool.featured).toBe(true)
    expect(tool.sourceName).toBe('Tools directory')
  })
})
