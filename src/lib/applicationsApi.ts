import type { SupportedLocale } from '../i18n'

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
  documentTypeIds: string[]
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
  documentTypeIds?: string[]
  language?: SupportedLocale
}

export async function updateApplicationDocumentTypesViaApi(payload: {
  applicationId: string
  documentTypeIds: string[]
  language?: SupportedLocale
}) {
  const response = await fetch(
    `/api/applications/${encodeURIComponent(payload.applicationId)}/document-types`,
    {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify({
        documentTypeIds: payload.documentTypeIds,
        ...(payload.language ? { language: payload.language } : {}),
      }),
    },
  )

  if (!response.ok) {
    let detail = `Application templates could not be saved (status ${response.status}).`
    try {
      const errorBody = (await response.json()) as { message?: string }
      if (errorBody.message) detail = errorBody.message
    } catch {
      // Keep the status-based message when the response is not JSON.
    }
    throw new Error(detail)
  }

  return (await response.json()) as { documentTypeIds: string[] }
}

export async function createApplicationViaApi(
  payload: CreateApplicationRequest,
) {
  const response = await fetch('/api/applications', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
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
