import { describe, expect, it } from 'vitest'
import { builtInTemplates, mapSyncedTemplates } from './templates'

describe('templates', () => {
  it('provides a varied built-in library', () => {
    expect(builtInTemplates).toHaveLength(8)
    expect(new Set(builtInTemplates.map((template) => template.format))).toEqual(
      new Set(['DOCX', 'XLSX', 'PDF', 'Notion']),
    )
  })

  it('maps synchronized resources and infers spreadsheet formats', () => {
    const [template] = mapSyncedTemplates([
      {
        id: 'external-cash-flow',
        module: 'templates',
        title: 'Cash Flow Model',
        description: 'Editable forecast',
        category: 'Financial',
        status: 'Active',
        url: 'https://example.com/cash-flow',
        updatedAt: 'Today',
        sourceId: 'sheet-1',
        sourceName: 'Finance sheet',
      },
    ])

    expect(template).toMatchObject({
      format: 'XLSX',
      sourceName: 'Finance sheet',
      tier: 'Free',
    })
  })
})
