import type { SupportedLocale } from '../i18n'
import { getEnvironmentModeHeaders } from './environmentMode'

export type BusinessPlanGenerateRequest = {
  app_id: string
  language: SupportedLocale
  signal?: AbortSignal
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
  '/ai-api'

const generationTimeoutMs = 120_000

async function postGenerationRequest<T>(
  path: string,
  payload: BusinessPlanGenerateRequest,
  timeoutMessage: string,
  parseResponse: (response: Response) => Promise<T>,
) {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), generationTimeoutMs)
  const abortRequest = () => controller.abort()
  payload.signal?.addEventListener('abort', abortRequest, { once: true })

  try {
    const response = await fetch(`${defaultApiBaseUrl}${path}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...getEnvironmentModeHeaders(),
      },
      credentials: 'include',
      signal: controller.signal,
      body: JSON.stringify({
        app_id: payload.app_id,
        language: payload.language,
      }),
    })

    return await parseResponse(response)
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      if (payload.signal?.aborted) {
        throw error
      }
      throw new Error(timeoutMessage)
    }
    throw error
  } finally {
    clearTimeout(timeoutId)
    payload.signal?.removeEventListener('abort', abortRequest)
  }
}

async function parseGenerationResponse(response: Response) {
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

  const result = (await response.json()) as BusinessPlanGenerateResponse
  if (result.status === 'failed' || !result.document) {
    throw new Error(result.message || 'The generation backend did not return a completed report.')
  }

  return result
}

export async function generateBusinessPlanViaApi(
  payload: BusinessPlanGenerateRequest,
) {
  return postGenerationRequest(
    '/api/business-plan/generate',
    payload,
    'Strategic Report generation timed out after two minutes. Please retry.',
    parseGenerationResponse,
  )
}

export async function generateFinancialForecastViaApi(
  payload: BusinessPlanGenerateRequest,
) {
  return postGenerationRequest(
    '/api/business-plan/forecast',
    payload,
    'Financial forecast generation timed out after two minutes. Please retry.',
    async (response) => {
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
    },
  )
}
import type { FinancialForecast } from '../types'
