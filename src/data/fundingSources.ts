import { setPersistentItem } from '../persistence/storage'

export type FundingProgramRecord = {
  id: string
  pid?: string
  language?: 'en-CA' | 'fr-CA' | 'zh-CN'
  name: string
  type: 'Grant' | 'Loan'
  provider: string
  amount: number
  currency?: string
  deadline: string
  programStatus?: string
  match: number
  url: string
  location: string
  country: string
  description?: string
  process?: string
  sourceId?: string
  sourceName?: string
  sourceType?: 'builtin' | 'google-sheets' | 'airtable' | 'json-file' | 'manual'
  sourceRecordId?: string
  sourceVersion?: string
  recordVersion?: string
  status?: 'active' | 'archived'
  eligibility?: string
  eligibleUses?: string
  targetCompanyTypes?: string
  requiredEvidence?: string
}

export type SyncedResourceRecord = {
  id: string
  module: Exclude<DataSourceModule, 'grants-loans'>
  title: string
  description: string
  category: string
  status: 'Active' | 'In Review' | 'Saved'
  url: string
  updatedAt: string
  sourceId: string
  sourceName: string
}

export type FundingDataSourceProvider = 'google-sheets' | 'airtable' | 'json-file'
export type FundingDataSourceStatus = 'draft' | 'connected' | 'error'
export type FundingDataSourceFrequency = 'manual' | 'hourly' | 'daily'
export type FundingProgramMappingField =
  | 'name'
  | 'provider'
  | 'type'
  | 'amount'
  | 'deadline'
  | 'url'
  | 'location'
  | 'country'
  | 'description'
  | 'process'
  | 'eligibility'
  | 'eligibleUses'
  | 'targetCompanyTypes'
  | 'requiredEvidence'
  | 'match'
  | 'pid'
export type FundingProgramFieldMapping = Partial<
  Record<FundingProgramMappingField, string>
>
export type DataSourceModule =
  | 'grants-loans'
  | 'templates'
  | 'social-resources'
  | 'tools'

export type FundingDataSource = {
  id: string
  name: string
  module: DataSourceModule
  provider: FundingDataSourceProvider
  enabled: boolean
  frequency: FundingDataSourceFrequency
  spreadsheetUrl: string
  sheetName: string
  airtableBaseId: string
  airtableTableName: string
  airtableView: string
  proxyUrl: string
  credentialReference: string
  status: FundingDataSourceStatus
  recordCount: number
  lastSyncedAt: string
  lastError: string
  isBuiltIn?: boolean
  jsonFileName?: string
  jsonSourceVersion?: string
  language?: 'en-CA' | 'fr-CA' | 'zh-CN'
  fieldMapping?: FundingProgramFieldMapping
}

export const fundingProgramMappingFields: Array<{
  key: FundingProgramMappingField
  label: string
  required?: boolean
}> = [
  { key: 'name', label: 'Program name', required: true },
  { key: 'provider', label: 'Funding provider' },
  { key: 'type', label: 'Funding type' },
  { key: 'amount', label: 'Maximum amount' },
  { key: 'deadline', label: 'Deadline' },
  { key: 'url', label: 'Official program URL' },
  { key: 'location', label: 'Location' },
  { key: 'country', label: 'Country' },
  { key: 'description', label: 'Description' },
  { key: 'process', label: 'How to start' },
  { key: 'eligibility', label: 'Eligibility' },
  { key: 'eligibleUses', label: 'Eligible uses' },
  { key: 'targetCompanyTypes', label: 'Target company types' },
  { key: 'requiredEvidence', label: 'Required evidence' },
  { key: 'match', label: 'Match score' },
  { key: 'pid', label: 'PID' },
]

export const defaultFundingProgramFieldMapping: FundingProgramFieldMapping = {
  name: 'name',
  provider: 'provider',
  type: 'type',
  amount: 'amount',
  deadline: 'deadline',
  url: 'url',
  location: 'location',
  country: 'country',
  description: 'description',
  process: 'process',
  eligibility: 'eligibility',
  eligibleUses: 'eligible_uses',
  targetCompanyTypes: 'target_company_types',
  requiredEvidence: 'required_evidence',
  match: 'match',
  pid: 'pid',
}

export const defaultJsonFundingProgramFieldMapping: FundingProgramFieldMapping = {
  name: 'program_name',
  provider: 'provider',
  amount: 'max_amount',
  url: 'official_program_site',
  location: 'location',
  country: 'country',
  description: 'description',
  process: 'how_to_start',
  eligibility: 'eligibility',
  eligibleUses: 'eligible_uses',
  targetCompanyTypes: 'target_company_types',
  requiredEvidence: 'required_evidence',
  pid: 'pid',
}

export function getFundingProgramFieldMapping(
  source: FundingDataSource,
): FundingProgramFieldMapping {
  const defaults = source.provider === 'json-file'
    ? defaultJsonFundingProgramFieldMapping
    : defaultFundingProgramFieldMapping
  return { ...defaults, ...source.fieldMapping }
}

export type JsonFundingCatalog = {
  sourceUrl?: string
  language?: 'en-CA' | 'fr-CA' | 'zh-CN'
  category: 'Grant' | 'Loan'
  records: Array<Record<string, unknown>>
}

export const canadianFundingDataSourceId = 'business-benefits-finder-funding-zh-CN'
export const canadianFundingDataSourceName = '加拿大政府补贴'

export const defaultFundingDataSources: FundingDataSource[] = [
  {
    id: 'google-sheets-funding-catalog',
    name: 'Google Sheets funding catalog',
    module: 'grants-loans',
    provider: 'google-sheets',
    enabled: true,
    frequency: 'daily',
    spreadsheetUrl: '/funding-programs-demo.csv',
    sheetName: 'Programs',
    airtableBaseId: '',
    airtableTableName: '',
    airtableView: '',
    proxyUrl: '',
    credentialReference: '',
    status: 'draft',
    recordCount: 0,
    lastSyncedAt: '',
    lastError: '',
  },
  {
    id: 'airtable-opportunity-pipeline',
    name: 'Airtable opportunity pipeline',
    module: 'grants-loans',
    provider: 'airtable',
    enabled: false,
    frequency: 'manual',
    spreadsheetUrl: '',
    sheetName: '',
    airtableBaseId: '',
    airtableTableName: 'Funding Programs',
    airtableView: 'Published',
    proxyUrl: '/api/integrations/airtable/sync',
    credentialReference: 'AIRTABLE_ACCESS_TOKEN',
    status: 'draft',
    recordCount: 0,
    lastSyncedAt: '',
    lastError: '',
  },
  {
    id: 'seed-demo-catalog',
    name: 'Seed demo catalog',
    module: 'grants-loans',
    provider: 'json-file',
    enabled: false,
    frequency: 'manual',
    spreadsheetUrl: '',
    sheetName: '',
    airtableBaseId: '',
    airtableTableName: '',
    airtableView: '',
    proxyUrl: '',
    credentialReference: '',
    status: 'connected',
    recordCount: 6,
    lastSyncedAt: '',
    lastError: '',
    isBuiltIn: true,
    language: 'en-CA',
  },
  {
    id: canadianFundingDataSourceId,
    name: canadianFundingDataSourceName,
    module: 'grants-loans',
    provider: 'json-file',
    enabled: true,
    frequency: 'daily',
    spreadsheetUrl: '',
    sheetName: '',
    airtableBaseId: '',
    airtableTableName: '',
    airtableView: '',
    proxyUrl: '',
    credentialReference: '',
    status: 'connected',
    recordCount: 624,
    lastSyncedAt: '',
    lastError: '',
    jsonFileName: 'funding_programs_complete.zh-CN.json',
    language: 'zh-CN',
  },
  {
    id: 'business-benefits-finder-loans-zh-CN',
    name: 'Business Benefits Finder - loans (中文)',
    module: 'grants-loans',
    provider: 'json-file',
    enabled: true,
    frequency: 'daily',
    spreadsheetUrl: '',
    sheetName: '',
    airtableBaseId: '',
    airtableTableName: '',
    airtableView: '',
    proxyUrl: '',
    credentialReference: '',
    status: 'connected',
    recordCount: 215,
    lastSyncedAt: '',
    lastError: '',
    jsonFileName: 'loan_programs_complete.zh-CN.json',
    language: 'zh-CN',
  },
  {
    id: 'us-grants',
    name: 'U.S. Grants',
    module: 'grants-loans',
    provider: 'json-file',
    enabled: true,
    frequency: 'daily',
    spreadsheetUrl: '',
    sheetName: '',
    airtableBaseId: '',
    airtableTableName: '',
    airtableView: '',
    proxyUrl: '',
    credentialReference: '',
    status: 'connected',
    recordCount: 1701,
    lastSyncedAt: '',
    lastError: '',
    jsonFileName: 'us_grant_programs.json',
    language: 'en-CA',
  },
  {
    id: 'us-grants-zh-CN',
    name: 'U.S. Grants (中文)',
    module: 'grants-loans',
    provider: 'json-file',
    enabled: true,
    frequency: 'daily',
    spreadsheetUrl: '',
    sheetName: '',
    airtableBaseId: '',
    airtableTableName: '',
    airtableView: '',
    proxyUrl: '',
    credentialReference: '',
    status: 'connected',
    recordCount: 1701,
    lastSyncedAt: '',
    lastError: '',
    jsonFileName: 'us_grant_programs.zh-CN.json',
    language: 'zh-CN',
  },
  {
    id: 'us-sba-loans',
    name: 'U.S. SBA Loans',
    module: 'grants-loans',
    provider: 'json-file',
    enabled: true,
    frequency: 'daily',
    spreadsheetUrl: '',
    sheetName: '',
    airtableBaseId: '',
    airtableTableName: '',
    airtableView: '',
    proxyUrl: '',
    credentialReference: '',
    status: 'connected',
    recordCount: 4,
    lastSyncedAt: '',
    lastError: '',
    jsonFileName: 'us_loan_programs_sba.json',
    language: 'en-CA',
  },
  {
    id: 'us-sba-loans-zh-CN',
    name: 'U.S. SBA Loans (中文)',
    module: 'grants-loans',
    provider: 'json-file',
    enabled: true,
    frequency: 'daily',
    spreadsheetUrl: '',
    sheetName: '',
    airtableBaseId: '',
    airtableTableName: '',
    airtableView: '',
    proxyUrl: '',
    credentialReference: '',
    status: 'connected',
    recordCount: 4,
    lastSyncedAt: '',
    lastError: '',
    jsonFileName: 'us_loan_programs_sba.zh-CN.json',
    language: 'zh-CN',
  },
  {
    id: 'china-grants-zh-CN',
    name: 'China Grants (中文)',
    module: 'grants-loans',
    provider: 'json-file',
    enabled: true,
    frequency: 'daily',
    spreadsheetUrl: '',
    sheetName: '',
    airtableBaseId: '',
    airtableTableName: '',
    airtableView: '',
    proxyUrl: '',
    credentialReference: '',
    status: 'connected',
    recordCount: 13605,
    lastSyncedAt: '',
    lastError: '',
    jsonFileName: 'china_grants.json',
    language: 'zh-CN',
  },
  {
    id: 'china-loans-zh-CN',
    name: 'China Loans (中文)',
    module: 'grants-loans',
    provider: 'json-file',
    enabled: true,
    frequency: 'daily',
    spreadsheetUrl: '',
    sheetName: '',
    airtableBaseId: '',
    airtableTableName: '',
    airtableView: '',
    proxyUrl: '',
    credentialReference: '',
    status: 'connected',
    recordCount: 448,
    lastSyncedAt: '',
    lastError: '',
    jsonFileName: 'china_loans.json',
    language: 'zh-CN',
  },
  {
    id: 'google-sheets-template-library',
    name: 'Template library',
    module: 'templates',
    provider: 'google-sheets',
    enabled: false,
    frequency: 'daily',
    spreadsheetUrl: '/template-resources-demo.csv',
    sheetName: 'Templates',
    airtableBaseId: '',
    airtableTableName: '',
    airtableView: '',
    proxyUrl: '',
    credentialReference: '',
    status: 'draft',
    recordCount: 0,
    lastSyncedAt: '',
    lastError: '',
  },
  {
    id: 'airtable-social-library',
    name: 'People & organization network',
    module: 'social-resources',
    provider: 'airtable',
    enabled: false,
    frequency: 'daily',
    spreadsheetUrl: '',
    sheetName: '',
    airtableBaseId: '',
    airtableTableName: 'Network Directory',
    airtableView: 'Published',
    proxyUrl: '/api/integrations/airtable/sync',
    credentialReference: 'AIRTABLE_ACCESS_TOKEN',
    status: 'draft',
    recordCount: 0,
    lastSyncedAt: '',
    lastError: '',
  },
  {
    id: 'google-sheets-tools-directory',
    name: 'Founder tools directory',
    module: 'tools',
    provider: 'google-sheets',
    enabled: false,
    frequency: 'daily',
    spreadsheetUrl: '/tools-resources-demo.csv',
    sheetName: 'Tools',
    airtableBaseId: '',
    airtableTableName: '',
    airtableView: '',
    proxyUrl: '',
    credentialReference: '',
    status: 'draft',
    recordCount: 0,
    lastSyncedAt: '',
    lastError: '',
  },
]

export function normalizeFundingDataSources(
  savedSources: FundingDataSource[] | undefined,
): FundingDataSource[] {
  return (savedSources ?? []).map((source) =>
    source.id === canadianFundingDataSourceId
      ? { ...source, name: canadianFundingDataSourceName }
      : source,
  )
}

export const builtInFundingPrograms: FundingProgramRecord[] = [
  {
    id: 'feddev-growth',
    pid: '1000000000000001',
    name: 'FedDev Ontario Growth Program',
    type: 'Grant',
    provider: 'Federal Economic Development Agency',
    amount: 250000,
    deadline: 'Aug 31, 2026',
    match: 94,
    url: 'https://feddev-ontario.canada.ca/en/funding',
    location: 'Ontario',
    country: 'Canada',
    description:
      'A mock growth funding opportunity for Ontario businesses commercializing products, expanding markets, and improving productivity.',
    sourceId: 'builtin-catalog',
    sourceName: 'Bconomics catalog',
    sourceType: 'builtin',
    sourceRecordId: 'feddev-growth',
    sourceVersion: 'mock-v1',
    recordVersion: 'mock-v1-feddev-growth',
    status: 'active',
    eligibility: 'Ontario-based incorporated businesses with a scalable growth project.',
    eligibleUses: 'Productivity improvements, commercialization, market expansion, and equipment.',
    targetCompanyTypes: 'Revenue-generating Ontario businesses pursuing growth.',
    requiredEvidence: 'Financial statements, project plan, vendor quotes, and milestones.',
  },
  {
    id: 'digital-adoption',
    pid: '1000000000000002',
    name: 'Canada Digital Adoption Program',
    type: 'Grant',
    provider: 'Government of Canada',
    amount: 15000,
    deadline: 'Rolling intake',
    match: 91,
    url: 'https://ised-isde.canada.ca/site/canada-digital-adoption-program/en',
    location: 'Canada',
    country: 'Canada',
    description:
      'A mock digital adoption grant helping Canadian small and medium-sized businesses plan, purchase, and implement practical technology improvements.',
    sourceId: 'builtin-catalog',
    sourceName: 'Bconomics catalog',
    sourceType: 'builtin',
    sourceRecordId: 'digital-adoption',
    sourceVersion: 'mock-v1',
    recordVersion: 'mock-v1-digital-adoption',
    status: 'active',
    eligibility: 'Canadian-owned small and medium-sized businesses adopting digital tools.',
    eligibleUses: 'Digital tools, e-commerce, cybersecurity, and technology advisory support.',
    targetCompanyTypes: 'Canadian small and medium-sized businesses ready to improve digital capability.',
    requiredEvidence: 'Business profile, digital plan, vendor estimates, and financial information.',
  },
  {
    id: 'ontario-expansion',
    pid: '1000000000000003',
    name: 'Ontario Business Expansion Fund',
    type: 'Grant',
    provider: 'Government of Ontario',
    amount: 100000,
    deadline: 'Sep 18, 2026',
    match: 86,
    url: 'https://www.ontario.ca/page/business-and-economy',
    location: 'Ontario',
    country: 'Canada',
    description:
      'A mock expansion grant for Ontario companies adding capacity, entering new markets, or scaling a proven operating model.',
    sourceId: 'builtin-catalog',
    sourceName: 'Bconomics catalog',
    sourceType: 'builtin',
    sourceRecordId: 'ontario-expansion',
    sourceVersion: 'mock-v1',
    recordVersion: 'mock-v1-ontario-expansion',
    status: 'active',
    eligibility: 'Ontario businesses expanding operations, markets, or production capacity.',
    eligibleUses: 'Expansion costs, equipment, hiring, market development, and implementation.',
    targetCompanyTypes: 'Ontario businesses with an operating history and a documented growth plan.',
    requiredEvidence: 'Growth plan, financial statements, project budget, and measurable outcomes.',
  },
  {
    id: 'bdc-small-business',
    pid: '1000000000000004',
    name: 'BDC Small Business Loan',
    type: 'Loan',
    provider: 'Business Development Bank of Canada',
    amount: 100000,
    deadline: 'Open',
    match: 89,
    url: 'https://www.bdc.ca/en/financing/small-business-loan',
    location: 'Canada',
    country: 'Canada',
    description:
      'A mock flexible financing option for established Canadian businesses funding working capital, equipment, and measured growth.',
    sourceId: 'builtin-catalog',
    sourceName: 'Bconomics catalog',
    sourceType: 'builtin',
    sourceRecordId: 'bdc-small-business',
    sourceVersion: 'mock-v1',
    recordVersion: 'mock-v1-bdc-small-business',
    status: 'active',
    eligibility: 'Canadian businesses with a viable plan and demonstrated ability to repay financing.',
    eligibleUses: 'Working capital, equipment, inventory, hiring, and business expansion.',
    targetCompanyTypes: 'Established Canadian businesses seeking flexible growth financing.',
    requiredEvidence: 'Financial statements, cash flow forecast, ownership details, and business plan.',
  },
  {
    id: 'futurpreneur-financing',
    pid: '1000000000000005',
    name: 'Futurpreneur Startup Financing',
    type: 'Loan',
    provider: 'Futurpreneur Canada',
    amount: 60000,
    deadline: 'Rolling intake',
    match: 82,
    url: 'https://futurpreneur.ca/en/offering/financing/',
    location: 'Canada',
    country: 'Canada',
    description:
      'A mock startup financing program for Canadian founders building an early-stage company with a practical launch plan.',
    sourceId: 'builtin-catalog',
    sourceName: 'Bconomics catalog',
    sourceType: 'builtin',
    sourceRecordId: 'futurpreneur-financing',
    sourceVersion: 'mock-v1',
    recordVersion: 'mock-v1-futurpreneur-financing',
    status: 'active',
    eligibility: 'Canadian founders building an early-stage business with a credible launch plan.',
    eligibleUses: 'Startup costs, working capital, equipment, and early customer acquisition.',
    targetCompanyTypes: 'Early-stage Canadian businesses and founders under the program age threshold.',
    requiredEvidence: 'Founder profile, business plan, budget, and startup assumptions.',
  },
  {
    id: 'women-enterprise-loan',
    pid: '1000000000000006',
    name: 'Women Enterprise Loan Fund',
    type: 'Loan',
    provider: 'Women Enterprise Organizations of Canada',
    amount: 50000,
    deadline: 'Open',
    match: 78,
    url: 'https://weoc.ca/',
    location: 'Canada',
    country: 'Canada',
    description:
      'A mock financing program for women-led Canadian businesses seeking capital for operations, marketing, hiring, or expansion.',
    sourceId: 'builtin-catalog',
    sourceName: 'Bconomics catalog',
    sourceType: 'builtin',
    sourceRecordId: 'women-enterprise-loan',
    sourceVersion: 'mock-v1',
    recordVersion: 'mock-v1-women-enterprise-loan',
    status: 'active',
    eligibility: 'Canadian women-led businesses seeking growth or operating capital.',
    eligibleUses: 'Working capital, equipment, hiring, marketing, and business development.',
    targetCompanyTypes: 'Women-led Canadian businesses with a clear financing need.',
    requiredEvidence: 'Ownership details, financial information, business plan, and use-of-funds budget.',
  },
]

export const fundingProgramStorageKey = 'bconomics-synced-funding-programs-v1'
export const resourceRecordStorageKey = 'bconomics-synced-resource-records-v1'

function normalizeHeader(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]/g, '')
}

function readField(record: Record<string, unknown>, aliases: string[]) {
  const normalized = new Map(
    Object.entries(record).map(([key, value]) => [normalizeHeader(key), value]),
  )

  for (const alias of aliases) {
    const value = normalized.get(normalizeHeader(alias))
    if (value !== undefined && value !== null && String(value).trim()) {
      return String(value).trim()
    }
  }

  return ''
}

export function parseJsonFundingCatalog(value: unknown): JsonFundingCatalog {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('The JSON catalog must contain an object with a records array.')
  }

  const catalog = value as Record<string, unknown>
  if (!Array.isArray(catalog.records) || catalog.records.length === 0) {
    throw new Error('The JSON catalog must contain at least one record in records.')
  }

  const category = String(catalog.category ?? '').toLowerCase().includes('loan')
    ? 'Loan'
    : 'Grant'
  const records = catalog.records.filter(
    (record): record is Record<string, unknown> =>
      Boolean(record) && typeof record === 'object' && !Array.isArray(record),
  )

  if (records.length !== catalog.records.length) {
    throw new Error('Every item in records must be a JSON object.')
  }

  return {
    sourceUrl: typeof catalog.source_url === 'string' ? catalog.source_url : undefined,
    language:
      catalog.language === 'zh-CN' || catalog.language === 'fr-CA'
        ? catalog.language
        : 'en-CA',
    category,
    records,
  }
}

function parseAmount(value: string) {
  const parsed = Number(value.replace(/[^0-9.-]/g, ''))
  return Number.isFinite(parsed) ? Math.max(0, parsed) : 0
}

function parseMatch(value: string) {
  const parsed = Number(value.replace(/[^0-9.-]/g, ''))
  return Number.isFinite(parsed) ? Math.min(100, Math.max(0, parsed)) : 75
}

function makeRecordId(sourceId: string, name: string, index: number) {
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
  return `${sourceId}-${slug || 'program'}-${index + 1}`
}

function makeMockProgramPid(seed: string) {
  let hash = 0
  for (const character of seed) {
    hash = (hash * 31 + character.charCodeAt(0)) % 9000000000000000
  }
  return String(1000000000000000 + hash)
}

function mockProgramDetails(
  name: string,
  type: FundingProgramRecord['type'],
  location: string,
  recordId: string,
) {
  const fundingLabel = type === 'Loan' ? 'financing' : 'funding'
  return {
    description: `Mock ${fundingLabel} opportunity for ${location} businesses seeking practical growth support through ${name}.`,
    process: type === 'Loan'
      ? 'Start with an eligibility and borrowing conversation with the funding provider. Prepare financial statements, a cash flow forecast, ownership details, and a use-of-funds plan. Contact the provider to confirm the application route, submit the package, and respond to underwriting questions.'
      : 'Review the eligibility requirements, confirm the program contact and intake route, and prepare the required evidence. Contact the program administrator before submitting the application, then follow the published review process and respond to any requests for clarification.',
    eligibility: `Businesses operating in ${location} with a documented need, an accountable owner, and a credible plan for using the funds.`,
    eligibleUses: type === 'Loan'
      ? 'Working capital, equipment, inventory, hiring, marketing, and business expansion.'
      : 'Equipment, technology, hiring, marketing, market development, and implementation costs.',
    targetCompanyTypes: `Small and medium-sized ${location} businesses with a clear operating model and measurable next steps.`,
    requiredEvidence: 'Business profile, ownership details, financial information, project budget, and measurable milestones.',
    sourceVersion: 'mock-v1',
    recordVersion: `mock-v1-${recordId}`,
    status: 'active' as const,
  }
}

function ensureFundingProgramCompleteness(
  program: FundingProgramRecord,
  index: number,
): FundingProgramRecord {
  const recordId = program.id || `stored-program-${index + 1}`
  const location = program.location || 'Canada'
  const details = mockProgramDetails(program.name, program.type, location, recordId)

  return {
    ...details,
    ...program,
    language: program.language ?? 'en-CA',
    pid: program.pid && /^[0-9]{16}$/.test(program.pid)
      ? program.pid
      : makeMockProgramPid(`stored:${recordId}`),
    deadline: program.deadline || 'Open',
    match: Number.isFinite(program.match) && program.match > 0 ? program.match : 75,
    url: program.url || `https://example.com/funding-programs/${recordId}`,
    location,
    country: program.country || 'Canada',
    description: program.description || details.description,
    process: program.process || details.process,
    sourceId: program.sourceId || 'manual-catalog',
    sourceName: program.sourceName || 'Mock funding catalog',
    sourceType: program.sourceType || 'manual',
    sourceRecordId: program.sourceRecordId || recordId,
    sourceVersion: program.sourceVersion || details.sourceVersion,
    recordVersion: program.recordVersion || details.recordVersion,
    status: program.status === 'archived' ? 'archived' : 'active',
    eligibility: program.eligibility || details.eligibility,
    eligibleUses: program.eligibleUses || details.eligibleUses,
    targetCompanyTypes: program.targetCompanyTypes || details.targetCompanyTypes,
    requiredEvidence: program.requiredEvidence || details.requiredEvidence,
  }
}

export function normalizeFundingRecords(
  rows: Array<Record<string, unknown>>,
  source: FundingDataSource,
) {
  return rows
    .map((row, index): FundingProgramRecord | null => {
      for (const [targetField, sourceField] of Object.entries(
        getFundingProgramFieldMapping(source),
      )) {
        if (!sourceField) continue
        const mappedValue = readField(row, [sourceField])
        if (mappedValue) row[targetField] = mappedValue
      }

      const name = readField(row, ['name', 'program name', 'program', 'title'])
      if (!name) return null

      const typeValue = readField(row, ['type', 'funding type', 'category'])
      const type = typeValue.toLowerCase().includes('loan') ? 'Loan' : 'Grant'

      return {
        id: makeRecordId(source.id, name, index),
        language: source.language ?? 'en-CA',
        name,
        type,
        provider:
          readField(row, ['provider', 'organization', 'agency', 'funder']) ||
          'Funding provider',
        amount: parseAmount(
          readField(row, ['amount', 'maximum amount', 'max amount', 'funding amount']),
        ),
        deadline:
          readField(row, ['deadline', 'closing date', 'close date']) || 'Open',
        programStatus: readField(row, ['program status', 'application status', 'status']),
        match: parseMatch(readField(row, ['match', 'match score', 'score'])),
        url: readField(row, ['url', 'website', 'program url', 'link']),
        location:
          readField(row, ['location', 'region', 'province', 'eligibility region']) ||
          'Canada',
        country: readField(row, ['country', 'nation']) || 'Canada',
        ...mockProgramDetails(
          name,
          type,
          readField(row, ['location', 'region', 'province', 'eligibility region']) || 'Canada',
          makeRecordId(source.id, name, index),
        ),
        description:
          readField(row, ['description', 'summary', 'program description']) ||
          mockProgramDetails(
            name,
            type,
            readField(row, ['location', 'region', 'province', 'eligibility region']) || 'Canada',
            makeRecordId(source.id, name, index),
          ).description,
        process:
          readField(row, ['process', 'application process', 'how to apply']) ||
          mockProgramDetails(
            name,
            type,
            readField(row, ['location', 'region', 'province', 'eligibility region']) || 'Canada',
            makeRecordId(source.id, name, index),
          ).process,
        pid: /^[0-9]{16}$/.test(readField(row, ['pid', 'public id', 'public program id']))
          ? readField(row, ['pid', 'public id', 'public program id'])
          : makeMockProgramPid(`${source.id}:${name}:${index}`),
        sourceId: source.id,
        sourceName: source.name,
        sourceType: source.provider,
        sourceRecordId:
          readField(row, ['source record id', 'record id', 'row id', 'id']) ||
          makeRecordId(source.id, name, index),
        sourceVersion: readField(row, ['source version', 'version']) || 'mock-v1',
        recordVersion:
          readField(row, ['record version', 'row version']) ||
          `mock-v1-${makeRecordId(source.id, name, index)}`,
        status: readField(row, ['status', 'state']).toLowerCase() === 'archived'
          ? 'archived'
          : 'active',
        eligibility: readField(row, [
          'eligibility',
          'eligibility requirements',
          'requirements',
          'who is eligible',
        ]) || mockProgramDetails(
          name,
          type,
          readField(row, ['location', 'region', 'province', 'eligibility region']) || 'Canada',
          makeRecordId(source.id, name, index),
        ).eligibility,
        eligibleUses: readField(row, [
          'eligible uses',
          'eligible use',
          'use of funds',
          'funding uses',
        ]) || mockProgramDetails(
          name,
          type,
          readField(row, ['location', 'region', 'province', 'eligibility region']) || 'Canada',
          makeRecordId(source.id, name, index),
        ).eligibleUses,
        targetCompanyTypes: readField(row, [
          'target company types',
          'company types',
          'target businesses',
          'ideal applicant',
        ]) || mockProgramDetails(
          name,
          type,
          readField(row, ['location', 'region', 'province', 'eligibility region']) || 'Canada',
          makeRecordId(source.id, name, index),
        ).targetCompanyTypes,
        requiredEvidence: readField(row, [
          'required evidence',
          'required documents',
          'supporting documents',
          'evidence required',
        ]) || mockProgramDetails(
          name,
          type,
          readField(row, ['location', 'region', 'province', 'eligibility region']) || 'Canada',
          makeRecordId(source.id, name, index),
        ).requiredEvidence,
      }
    })
    .filter((record): record is FundingProgramRecord => record !== null)
}

export function normalizeResourceRecords(
  rows: Array<Record<string, unknown>>,
  source: FundingDataSource,
) {
  if (source.module === 'grants-loans') return []
  const module = source.module as Exclude<DataSourceModule, 'grants-loans'>

  return rows
    .map((row, index): SyncedResourceRecord | null => {
      const title = readField(row, [
        'title',
        'name',
        'resource name',
        'template name',
        'tool name',
      ])
      if (!title) return null

      const statusValue = readField(row, ['status', 'state']).toLowerCase()
      const status: SyncedResourceRecord['status'] = statusValue.includes('review')
        ? 'In Review'
        : statusValue.includes('saved') || statusValue.includes('archive')
          ? 'Saved'
          : 'Active'

      return {
        id: makeRecordId(source.id, title, index),
        module,
        title,
        description:
          readField(row, ['description', 'summary', 'details', 'subtitle']) ||
          `${title} synchronized from ${source.name}.`,
        category:
          readField(row, ['category', 'type', 'format', 'channel']) || 'General',
        status,
        url: readField(row, ['url', 'link', 'website', 'resource url']),
        updatedAt:
          readField(row, ['updated', 'updated at', 'modified', 'last updated']) ||
          'Synced recently',
        sourceId: source.id,
        sourceName: source.name,
      }
    })
    .filter((record): record is SyncedResourceRecord => record !== null)
}

export function parseCsv(csv: string) {
  const rows: string[][] = []
  let row: string[] = []
  let cell = ''
  let quoted = false

  for (let index = 0; index < csv.length; index += 1) {
    const character = csv[index]
    const next = csv[index + 1]

    if (character === '"' && quoted && next === '"') {
      cell += '"'
      index += 1
    } else if (character === '"') {
      quoted = !quoted
    } else if (character === ',' && !quoted) {
      row.push(cell)
      cell = ''
    } else if ((character === '\n' || character === '\r') && !quoted) {
      if (character === '\r' && next === '\n') index += 1
      row.push(cell)
      if (row.some((value) => value.trim())) rows.push(row)
      row = []
      cell = ''
    } else {
      cell += character
    }
  }

  row.push(cell)
  if (row.some((value) => value.trim())) rows.push(row)

  const [headers = [], ...values] = rows
  return values.map((valuesRow) =>
    Object.fromEntries(
      headers.map((header, index) => [header.trim(), valuesRow[index]?.trim() ?? '']),
    ),
  )
}

export function buildGoogleSheetsCsvUrl(source: FundingDataSource) {
  const url = source.spreadsheetUrl.trim()
  if (!url) throw new Error('Add a Google Sheets URL before syncing.')
  if (url.includes('output=csv') || url.endsWith('.csv')) return url

  const spreadsheetId = url.match(/\/spreadsheets\/d\/([^/]+)/)?.[1]
  if (!spreadsheetId) {
    throw new Error('Use a valid Google Sheets sharing URL.')
  }

  if (source.sheetName.trim()) {
    return `https://docs.google.com/spreadsheets/d/${spreadsheetId}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(source.sheetName.trim())}`
  }

  const gid = url.match(/[?#&]gid=([0-9]+)/)?.[1] ?? '0'
  return `https://docs.google.com/spreadsheets/d/${spreadsheetId}/export?format=csv&gid=${gid}`
}

async function fetchDataSourceRows(
  source: FundingDataSource,
  request: typeof fetch = fetch,
) {
  if (source.provider === 'google-sheets') {
    const response = await request(buildGoogleSheetsCsvUrl(source))
    if (!response.ok) {
      throw new Error(`Google Sheets returned ${response.status}. Check sharing access.`)
    }
    return parseCsv(await response.text())
  }

  if (!source.airtableBaseId.trim() || !source.airtableTableName.trim()) {
    throw new Error('Add the Airtable base ID and table name before syncing.')
  }
  if (!source.proxyUrl.trim()) {
    throw new Error('A secure Airtable proxy endpoint is required.')
  }

  const response = await request(source.proxyUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      provider: 'airtable',
      baseId: source.airtableBaseId,
      tableName: source.airtableTableName,
      view: source.airtableView,
      credentialReference: source.credentialReference,
    }),
  })

  if (!response.ok) {
    throw new Error(`Airtable proxy returned ${response.status}. Check its configuration.`)
  }

  const payload = (await response.json()) as
    | Array<Record<string, unknown>>
    | { records?: Array<Record<string, unknown> | { fields?: Record<string, unknown> }> }
  const rawRecords = Array.isArray(payload) ? payload : (payload.records ?? [])
  const rows: Array<Record<string, unknown>> = rawRecords.map((record) => {
    const fields = (record as { fields?: Record<string, unknown> }).fields
    return fields ?? (record as Record<string, unknown>)
  })
  return rows
}

export async function syncFundingDataSource(
  source: FundingDataSource,
  request: typeof fetch = fetch,
) {
  return normalizeFundingRecords(await fetchDataSourceRows(source, request), source)
}

export async function syncResourceDataSource(
  source: FundingDataSource,
  request: typeof fetch = fetch,
) {
  return normalizeResourceRecords(await fetchDataSourceRows(source, request), source)
}

export function loadSyncedFundingPrograms() {
  if (typeof window === 'undefined') return []

  try {
    const saved = window.localStorage.getItem(fundingProgramStorageKey)
    return saved
      ? (JSON.parse(saved) as FundingProgramRecord[]).map(ensureFundingProgramCompleteness)
      : []
  } catch {
    return []
  }
}

export function saveSyncedFundingPrograms(
  sourceId: string,
  programs: FundingProgramRecord[],
) {
  const otherPrograms = loadSyncedFundingPrograms().filter(
    (program) => program.sourceId !== sourceId,
  )
  replaceFundingProgramCache([...otherPrograms, ...programs])
}

export function replaceFundingProgramCache(programs: FundingProgramRecord[]) {
  try {
    setPersistentItem(fundingProgramStorageKey, JSON.stringify(programs))
  } catch {
    // Large database catalogs are authoritative; browser storage is only a
    // best-effort cache and may reject payloads beyond its quota.
  }
}

export function removeSyncedFundingPrograms(sourceId: string) {
  const nextPrograms = loadSyncedFundingPrograms().filter(
    (program) => program.sourceId !== sourceId,
  )
  replaceFundingProgramCache(nextPrograms)
}

export function loadSyncedResourceRecords() {
  if (typeof window === 'undefined') return []

  try {
    const saved = window.localStorage.getItem(resourceRecordStorageKey)
    return saved ? (JSON.parse(saved) as SyncedResourceRecord[]) : []
  } catch {
    return []
  }
}

export function saveSyncedResourceRecords(
  sourceId: string,
  records: SyncedResourceRecord[],
) {
  const otherRecords = loadSyncedResourceRecords().filter(
    (record) => record.sourceId !== sourceId,
  )
  setPersistentItem(
    resourceRecordStorageKey,
    JSON.stringify([...otherRecords, ...records]),
  )
}

export function removeSyncedResourceRecords(sourceId: string) {
  const nextRecords = loadSyncedResourceRecords().filter(
    (record) => record.sourceId !== sourceId,
  )
  setPersistentItem(resourceRecordStorageKey, JSON.stringify(nextRecords))
}

export function loadResourceRecords(
  module: Exclude<DataSourceModule, 'grants-loans'>,
  enabledSourceIds?: string[],
) {
  return loadSyncedResourceRecords().filter(
    (record) =>
      record.module === module &&
      (!enabledSourceIds || enabledSourceIds.includes(record.sourceId)),
  )
}

export function loadFundingPrograms(enabledSourceIds?: string[]) {
  // The database API has already applied the active data-source policy. Its
  // source IDs are catalog record IDs, not the UI configuration IDs.
  void enabledSourceIds
  return loadSyncedFundingPrograms()
}

export function findFundingProgramByName(
  name: string,
  enabledSourceIds?: string[],
) {
  const normalizedName = name.trim().toLowerCase()
  if (!normalizedName) return null

  return (
    loadFundingPrograms(enabledSourceIds).find(
      (program) => program.name.trim().toLowerCase() === normalizedName,
    ) ?? null
  )
}
