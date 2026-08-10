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
) {
  const response = await fetch(
    `/api/funding-programs?language=${encodeURIComponent(language)}&includeBuiltIn=${includeBuiltIn ? 'true' : 'false'}`,
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
        `Funding program JSON import failed with status ${response.status}.`,
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
