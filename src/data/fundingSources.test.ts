import { describe, expect, it, vi } from 'vitest'
import {
  buildGoogleSheetsCsvUrl,
  defaultFundingDataSources,
  normalizeFundingRecords,
  normalizeResourceRecords,
  parseJsonFundingCatalog,
  parseCsv,
  syncFundingDataSource,
  type FundingDataSource,
} from './fundingSources'

const source: FundingDataSource = {
  id: 'test-source',
  name: 'Test source',
  module: 'grants-loans',
  provider: 'google-sheets',
  enabled: true,
  frequency: 'manual',
  spreadsheetUrl:
    'https://docs.google.com/spreadsheets/d/abc123/edit#gid=12345',
  sheetName: 'Funding Programs',
  airtableBaseId: '',
  airtableTableName: '',
  airtableView: '',
  proxyUrl: '',
  credentialReference: '',
  status: 'draft',
  recordCount: 0,
  lastSyncedAt: '',
  lastError: '',
}

describe('funding data sources', () => {
  it('includes the China grant and loan catalogs as enabled Chinese sources', () => {
    expect(defaultFundingDataSources).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'china-grants-zh-CN',
          name: 'China Grants (中文)',
          jsonFileName: 'china_grants.json',
          language: 'zh-CN',
          recordCount: 13605,
        }),
        expect.objectContaining({
          id: 'china-loans-zh-CN',
          name: 'China Loans (中文)',
          jsonFileName: 'china_loans.json',
          language: 'zh-CN',
          recordCount: 448,
        }),
      ]),
    )
  })

  it('validates scraped JSON catalogs and preserves structured records', () => {
    const catalog = parseJsonFundingCatalog({
      category: 'Loans',
      source_url: 'https://example.ca/loans',
      records: [{
        program_name: 'Community Loan',
        eligibility: ['Canadian business', 'Repayment capacity'],
      }],
    })

    expect(catalog).toEqual({
      category: 'Loan',
      language: 'en-CA',
      sourceUrl: 'https://example.ca/loans',
      records: [{
        program_name: 'Community Loan',
        eligibility: ['Canadian business', 'Repayment capacity'],
      }],
    })
  })

  it('converts a Google Sheets sharing URL into a CSV endpoint', () => {
    expect(buildGoogleSheetsCsvUrl(source)).toBe(
      'https://docs.google.com/spreadsheets/d/abc123/gviz/tq?tqx=out:csv&sheet=Funding%20Programs',
    )
  })

  it('parses quoted CSV and maps common funding column names', () => {
    const rows = parseCsv(
      'Program Name,Funding Type,Agency,Maximum Amount,Closing Date,Match Score,Link,Region\n' +
        '"Growth, Innovation Fund",Grant,Ontario Agency,"$125,000",2026-08-30,92%,https://example.ca,Ontario',
    )
    const [program] = normalizeFundingRecords(rows, source)

    expect(program).toMatchObject({
      name: 'Growth, Innovation Fund',
      type: 'Grant',
      provider: 'Ontario Agency',
      amount: 125000,
      deadline: '2026-08-30',
      match: 92,
      location: 'Ontario',
      sourceId: 'test-source',
    })
    expect(program?.process).toContain('Contact the program administrator')
  })

  it('uses configured source field mappings before alias detection', () => {
    const [program] = normalizeFundingRecords(
      [{
        catalogue_title: 'Mapped Growth Grant',
        sponsor_name: 'Mapped Agency',
        award_value: '$240,000',
      }],
      {
        ...source,
        fieldMapping: {
          name: 'catalogue_title',
          provider: 'sponsor_name',
          amount: 'award_value',
        },
      },
    )

    expect(program).toMatchObject({
      name: 'Mapped Growth Grant',
      provider: 'Mapped Agency',
      amount: 240000,
    })
  })

  it('sends Airtable metadata to the secure proxy and maps returned fields', async () => {
    const airtableSource: FundingDataSource = {
      ...source,
      provider: 'airtable',
      spreadsheetUrl: '',
      sheetName: '',
      airtableBaseId: 'app123',
      airtableTableName: 'Programs',
      airtableView: 'Published',
      proxyUrl: '/api/integrations/airtable/sync',
      credentialReference: 'AIRTABLE_ACCESS_TOKEN',
    }
    const request = vi.fn(async () =>
      new Response(
        JSON.stringify({
          records: [
            {
              fields: {
                Name: 'Community Loan',
                Type: 'Loan',
                Provider: 'Regional Fund',
                Amount: 50000,
              },
            },
          ],
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    )

    const programs = await syncFundingDataSource(airtableSource, request)

    expect(request).toHaveBeenCalledWith(
      '/api/integrations/airtable/sync',
      expect.objectContaining({ method: 'POST' }),
    )
    expect(programs[0]).toMatchObject({
      name: 'Community Loan',
      type: 'Loan',
      amount: 50000,
    })
  })

  it('maps generic rows into module-specific resource records', () => {
    const templateSource: FundingDataSource = {
      ...source,
      module: 'templates',
      name: 'Template catalog',
    }
    const [template] = normalizeResourceRecords(
      [
        {
          'Template Name': 'Lender Business Plan',
          Summary: 'Editable plan for financing applications',
          Format: 'DOCX',
          Status: 'Published',
          Link: 'https://example.com/template',
        },
      ],
      templateSource,
    )

    expect(template).toMatchObject({
      module: 'templates',
      title: 'Lender Business Plan',
      category: 'DOCX',
      status: 'Active',
      sourceName: 'Template catalog',
    })
  })
})
