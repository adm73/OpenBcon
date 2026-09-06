import { describe, expect, it } from 'vitest'
import { createInMemoryDocumentStore } from './documentStore'
import {
  readNewsPipelineState,
  runNewsPipeline,
} from './newsPipeline'

const csv = [
  'title,content,author,date,website,image',
  'New grant opens for AI exporters,"A new government grant supports AI companies with equipment and hiring.",OpenBcon,2026-08-18,https://example.test/grant,https://example.test/grant.png',
  'A practical AI operations update,"Teams are using AI automation to reduce repetitive work and improve delivery.",OpenBcon,2026-08-17,https://example.test/ai,https://example.test/ai.png',
  'Startup capital signals this month,"Investors are watching resilient founders and practical growth plans.",OpenBcon,2026-08-16,https://example.test/startup,https://example.test/startup.png',
].join('\n')

function seedConfig(store: ReturnType<typeof createInMemoryDocumentStore>) {
  return store.upsertState({
    scope: 'platform',
    ownerId: 'platform',
    key: 'bconomics-platform-config-v1',
    value: {
      dataSources: [{
        id: 'test-news-source',
        name: 'Test News',
        module: 'news',
        provider: 'google-sheets',
        enabled: true,
        spreadsheetUrl: 'https://docs.google.com/spreadsheets/d/test-sheet/edit',
        sheetName: 'News',
      }],
    },
    updatedAt: new Date('2026-08-18T12:00:00Z'),
  })
}

describe('news pipeline', () => {
  it('classifies, normalizes, and deduplicates synced news records', async () => {
    const store = createInMemoryDocumentStore()
    await seedConfig(store)
    const fetcher = async () => new Response(csv, { status: 200 })

    const first = await runNewsPipeline(store, {
      fetcher,
      now: new Date('2026-08-18T12:00:00Z'),
    })
    const second = await runNewsPipeline(store, {
      fetcher,
      now: new Date('2026-08-18T18:00:00Z'),
    })
    const records = await store.findStateValue(
      'platform',
      'platform',
      'bconomics-synced-resource-records-v1',
    )

    expect(first.status).toBe('success')
    expect(first.lastRunSummary).toMatchObject({ sources: 1, records: 3, added: 3 })
    expect(second.lastRunSummary).toMatchObject({ sources: 1, records: 3, added: 0, removed: 0 })
    expect(records).toHaveLength(3)
    expect(records).toEqual(expect.arrayContaining([
      expect.objectContaining({ category: 'fundingAlerts', readMinutes: 1, imageUrl: 'https://example.test/grant.png' }),
      expect.objectContaining({ category: 'aiBusiness' }),
      expect.objectContaining({ category: 'startupCapital' }),
    ]))
  })

  it('records a failed source request for the admin status page', async () => {
    const store = createInMemoryDocumentStore()
    await seedConfig(store)

    await expect(runNewsPipeline(store, {
      fetcher: async () => new Response('upstream failed', { status: 502 }),
    })).rejects.toThrow('Test News returned HTTP 502.')

    const state = await readNewsPipelineState(store)
    expect(state.status).toBe('error')
    expect(state.lastError).toBe('Test News returned HTTP 502.')
  })
})
