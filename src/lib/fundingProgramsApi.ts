import { getEnvironmentModeHeaders } from './environmentMode'
import type { FundingProgramRecord } from '../data/fundingSources'

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

async function readError(response: Response, fallback: string) {
  try {
    const body = (await response.json()) as { message?: string }
    if (body.message) return body.message
  } catch {
    // Keep the status-based error when the server did not return JSON.
  }
  return fallback
}

export async function loadFundingProgramsViaApi() {
  const response = await fetch('/api/funding-programs', {
    headers: getEnvironmentModeHeaders(),
    credentials: 'include',
  })

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
      ...getEnvironmentModeHeaders(),
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
