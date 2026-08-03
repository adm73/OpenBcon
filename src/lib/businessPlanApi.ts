import type { SupportedLocale } from '../i18n'

export type BusinessPlanGenerateRequest = {
  app_id: string
  language: SupportedLocale
}

export type BusinessPlanSectionResponse = {
  section_key: string
  title: string
  content: string
  citations: string[]
}

export type BusinessPlanGenerateResponse = {
  strategic_report_id: string
  status: 'completed' | 'failed'
  document: {
    title: string
    program_name: string
    business_name: string
    executive_summary: string
    sections: BusinessPlanSectionResponse[]
    key_strengths: string[]
    risks: string[]
    use_of_funds_summary: string
    next_steps: string[]
    financial_forecast: FinancialForecast
  } | null
  message?: string | null
  completed_at?: string | null
}

const defaultApiBaseUrl =
  (import.meta.env.VITE_BUSINESS_PLAN_API_URL as string | undefined)?.replace(/\/$/u, '') ||
  'http://localhost:8010'

export async function generateBusinessPlanViaApi(
  payload: BusinessPlanGenerateRequest,
) {
  const response = await fetch(`${defaultApiBaseUrl}/api/business-plan/generate`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  })

  if (!response.ok) {
    let detail = `Generation request failed with status ${response.status}.`
    try {
      const errorBody = (await response.json()) as { detail?: string }
      if (errorBody.detail) {
        detail = errorBody.detail
      }
    } catch {
      // Ignore non-JSON error bodies and return the generic message.
    }
    throw new Error(detail)
  }

  return (await response.json()) as BusinessPlanGenerateResponse
}

export async function generateFinancialForecastViaApi(
  payload: BusinessPlanGenerateRequest,
) {
  const response = await fetch(`${defaultApiBaseUrl}/api/business-plan/forecast`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  })

  if (!response.ok) {
    let detail = `Financial forecast request failed with status ${response.status}.`
    try {
      const errorBody = (await response.json()) as { detail?: string }
      if (errorBody.detail) {
        detail = errorBody.detail
      }
    } catch {
      // Ignore non-JSON error bodies and return the generic error.
    }
    throw new Error(detail)
  }

  return (await response.json()) as FinancialForecast
}
import type { FinancialForecast } from '../types'
