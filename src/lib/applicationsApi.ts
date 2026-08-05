import type { SupportedLocale } from '../i18n'
import { getEnvironmentModeHeaders } from './environmentMode'

export type CreateApplicationRequest = {
  programName: string
  programUrl: string
  provider?: string
  location?: string
  fundingType: 'Grant' | 'Loan'
  amount: number
  deadline: string
  deadlineOrder?: number
  company: string
  founderName: string
  businessSummary: string
  teamBackground: string
  language?: SupportedLocale
}

export type CreatedApplication = {
  id: string
  appId: string
  title: string
  programName: string
  programUrl: string
  company: string
  fundingType: 'Grant' | 'Loan'
  amount: number
  deadline: string
  deadlineOrder: number
  owner: string
}

export async function createApplicationViaApi(
  payload: CreateApplicationRequest,
) {
  const response = await fetch('/api/applications', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...getEnvironmentModeHeaders(),
    },
    credentials: 'include',
    body: JSON.stringify(payload),
  })

  if (!response.ok) {
    let detail = `Application creation failed with status ${response.status}.`
    try {
      const errorBody = (await response.json()) as { message?: string }
      if (errorBody.message) detail = errorBody.message
    } catch {
      // Ignore non-JSON error bodies and keep the status-based message.
    }
    throw new Error(detail)
  }

  return (await response.json()) as CreatedApplication
}
