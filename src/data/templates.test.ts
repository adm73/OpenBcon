import { describe, expect, it } from 'vitest'
import {
  builtInTemplates,
  mapDocumentTypesToTemplates,
  mapSyncedTemplates,
} from './templates'

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

  it('maps configured Document Types into the template catalog', () => {
    expect(
      mapDocumentTypesToTemplates(
        [
          {
            id: 'business-analysis',
            name: 'Business Analysis',
            prompt: 'Analyze the company and its operating model.',
          },
        ],
        [
          { documentTypeId: 'business-analysis', enabled: true },
          { documentTypeId: 'business-analysis', enabled: false },
          { documentTypeId: 'financial-model', enabled: true },
        ],
      ),
    ).toMatchObject([
      {
        id: 'business-analysis',
        title: 'Business Analysis',
        description: 'Analyze the company and its operating model.',
        tier: 'Configured',
        sourceId: 'advisory-hub-document-types',
        sectionCount: 1,
      },
    ])
  })
})
