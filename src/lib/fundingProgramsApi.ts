import type {
  FundingProgramFieldMapping,
  FundingProgramRecord,
} from '../data/fundingSources'

export type FundingProgramLanguage = 'en-CA' | 'fr-CA' | 'zh-CN'

export type ManualFundingProgramInput = {
  name: string
  fundingType: 'Grant' | 'Loan'
  provider: string
  amount: number
  deadline: string
  programUrl: string
  location: string
  country: string
  description: string
  process: string
  eligibility: string
  eligibleUses: string
  targetCompanyTypes: string
  requiredEvidence: string
  matchScore: number
}

export type JsonFundingProgramImportInput = {
  sourceId: string
  sourceName: string
  sourceVersion?: string
  sourceUrl?: string
  category: 'Grant' | 'Loan'
  language?: FundingProgramLanguage
  records: Array<Record<string, unknown>>
  fieldMapping?: FundingProgramFieldMapping
  syncComplete?: boolean
  syncRecordIds?: string[]
}

export type FundingProgramSyncInput = {
  sourceId: string
  sourceName: string
  sourceVersion?: string
  sourceUrl?: string
  sourceType: 'google-sheets' | 'airtable'
  records: FundingProgramRecord[]
  syncComplete?: boolean
  syncRecordIds?: string[]
}

function jsonFieldText(value: unknown): string {
  if (Array.isArray(value)) {
    return value.map((item) => jsonFieldText(item)).filter(Boolean).join('\n')
  }
  if (value && typeof value === 'object') return JSON.stringify(value)
  return value === null || value === undefined ? '' : String(value).trim()
}

function mappedJsonField(
  record: Record<string, unknown>,
  fieldMapping: FundingProgramFieldMapping,
  targetField: keyof FundingProgramFieldMapping,
  fallbackKeys: string[],
) {
  const mappedKey = fieldMapping[targetField]?.trim()
  if (mappedKey && jsonFieldText(record[mappedKey])) return record[mappedKey]
  for (const key of fallbackKeys) {
    if (jsonFieldText(record[key])) return record[key]
  }
  return undefined
}

async function sha256Hex(value: string) {
  const digest = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(value),
  )
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('')
}

/**
 * Mirrors the server's stable JSON identity so a multi-request sync can
 * archive records that disappeared from the source only after the final chunk.
 */
export async function getJsonFundingSyncMetadata(
  category: 'Grant' | 'Loan',
  records: Array<Record<string, unknown>>,
  fieldMapping: FundingProgramFieldMapping = {},
  sourceContent?: string,
) {
  const duplicateCounts = new Map<string, number>()
  const sourceRecordIds: string[] = []

  for (const record of records) {
    const name = jsonFieldText(
      mappedJsonField(record, fieldMapping, 'name', ['program_name', 'name', 'title']),
    )
    if (!name) continue

    // This identity intentionally matches the server's duplicate counter.
    const duplicateIdentity = [
      category,
      name,
      jsonFieldText(mappedJsonField(record, fieldMapping, 'provider', ['provider'])),
      jsonFieldText(mappedJsonField(record, fieldMapping, 'url', ['official_program_site', 'url'])),
    ].join('|').toLowerCase()
    const duplicateNumber = (duplicateCounts.get(duplicateIdentity) ?? 0) + 1
    duplicateCounts.set(duplicateIdentity, duplicateNumber)

    const identity = [
      category,
      name,
      jsonFieldText(mappedJsonField(record, fieldMapping, 'provider', ['provider'])),
      jsonFieldText(mappedJsonField(record, fieldMapping, 'url', ['official_program_site'])),
    ].join('|').toLowerCase()
    const suffix = duplicateNumber > 1 ? `|duplicate-${duplicateNumber}` : ''
    const recordHash = await sha256Hex(identity + suffix)
    sourceRecordIds.push(`json-${recordHash.slice(0, 32)}`)
  }

  return {
    sourceRecordIds,
    sourceVersion: sourceContent ? await sha256Hex(sourceContent) : '',
  }
}

export function chunkJsonFundingRecords(
  input: JsonFundingProgramImportInput,
  maxBytes = 6 * 1024 * 1024,
) {
  const encoder = new TextEncoder()
  const chunks: Array<Record<string, unknown>[]> = []
  let current: Array<Record<string, unknown>> = []

  for (const record of input.records) {
    const candidate = [...current, record]
    const candidateSize = encoder.encode(JSON.stringify({ ...input, records: candidate })).byteLength
    if (candidateSize > maxBytes && current.length > 0) {
      chunks.push(current)
      current = [record]
      const singleRecordSize = encoder.encode(JSON.stringify({ ...input, records: current })).byteLength
      if (singleRecordSize > maxBytes) {
        throw new Error('A funding program record is too large to sync safely.')
      }
    } else if (candidateSize > maxBytes) {
      throw new Error('A funding program record is too large to sync safely.')
    } else {
      current = candidate
    }
  }

  if (current.length > 0) chunks.push(current)
  return chunks
}

async function readError(response: Response, fallback: string) {
  try {
    const body = (await response.json()) as { message?: string }
    if (body.message) return body.message
  } catch {
    // Keep the status-based error when the server did not return JSON.
  }
  return fallback
}

export async function loadFundingProgramsViaApi(
  language: FundingProgramLanguage = 'en-CA',
  includeBuiltIn = false,
  loadAllLanguages = false,
) {
  const params = new URLSearchParams({
    language: loadAllLanguages ? 'all' : language,
    includeBuiltIn: includeBuiltIn ? 'true' : 'false',
  })
  const response = await fetch(
    `/api/funding-programs?${params.toString()}`,
    {
      credentials: 'include',
    },
  )

  if (!response.ok) {
    throw new Error(
      await readError(
        response,
        `Funding program loading failed with status ${response.status}.`,
      ),
    )
  }

  const body = (await response.json()) as {
    programs?: FundingProgramRecord[]
  }
  return Array.isArray(body.programs) ? body.programs : []
}

export async function loadFundingProgramCountViaApi() {
  const response = await fetch('/api/funding-programs/count', {
    credentials: 'include',
  })

  if (!response.ok) {
    throw new Error(
      await readError(
        response,
        `Funding program count loading failed with status ${response.status}.`,
      ),
    )
  }

  const body = (await response.json()) as { count?: number }
  return typeof body.count === 'number' && Number.isFinite(body.count)
    ? body.count
    : 0
}

export async function createManualFundingProgramViaApi(
  input: ManualFundingProgramInput,
) {
  const response = await fetch('/api/funding-programs', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'include',
    body: JSON.stringify(input),
  })

  if (!response.ok) {
    throw new Error(
      await readError(
        response,
        `Funding program import failed with status ${response.status}.`,
      ),
    )
  }

  const body = (await response.json()) as {
    program?: FundingProgramRecord
  }
  if (!body.program) {
    throw new Error('The imported funding program was not returned by the server.')
  }
  return body.program
}

export async function importJsonFundingProgramsViaApi(
  input: JsonFundingProgramImportInput,
) {
  const response = await fetch('/api/funding-programs/import', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'include',
    body: JSON.stringify(input),
  })

  if (!response.ok) {
    throw new Error(
      await readError(
        response,
        response.status === 502
          ? 'Funding program JSON import could not reach the API. Start the API on port 8787 and retry.'
          : `Funding program JSON import failed with status ${response.status}.`,
      ),
    )
  }

  const body = (await response.json()) as {
    programs?: FundingProgramRecord[]
    imported?: number
    updated?: number
    archived?: number
    sourceVersion?: string
  }
  if (!Array.isArray(body.programs)) {
    throw new Error('The JSON import did not return database programs.')
  }
  return {
    programs: body.programs,
    imported: body.imported ?? 0,
    updated: body.updated ?? 0,
    archived: body.archived ?? 0,
    sourceVersion: body.sourceVersion ?? '',
  }
}

export async function syncFundingProgramsViaApi(input: FundingProgramSyncInput) {
  const response = await fetch('/api/funding-programs/sync', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'include',
    body: JSON.stringify(input),
  })

  if (!response.ok) {
    throw new Error(
      await readError(
        response,
        response.status === 502
          ? 'Funding program sync could not reach the API. Start the API on port 8787 and retry.'
          : `Funding program sync failed with status ${response.status}.`,
      ),
    )
  }

  const body = (await response.json()) as {
    programs?: FundingProgramRecord[]
    imported?: number
    updated?: number
    archived?: number
    sourceVersion?: string
  }
  if (!Array.isArray(body.programs)) {
    throw new Error('The funding program sync did not return database programs.')
  }
  return {
    programs: body.programs,
    imported: body.imported ?? 0,
    updated: body.updated ?? 0,
    archived: body.archived ?? 0,
    sourceVersion: body.sourceVersion ?? '',
  }
}

export async function archiveJsonFundingProgramsViaApi(sourceId: string) {
  const response = await fetch(
    `/api/funding-programs/source/${encodeURIComponent(sourceId)}/archive`,
    {
      method: 'POST',
      credentials: 'include',
    },
  )

  if (!response.ok) {
    throw new Error(
      await readError(
        response,
        `Funding program source archive failed with status ${response.status}.`,
      ),
    )
  }

  const body = (await response.json()) as { archived?: number }
  return body.archived ?? 0
}
