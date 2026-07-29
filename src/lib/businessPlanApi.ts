export type BusinessPlanGenerateRequest = {
  workspace_id: string
  requested_by_user_id: string
  package_name?: string
  target_language?: string
  section_limit?: number
  force_mock?: boolean
  company_info: {
    external_id?: string
    name: string
    founder_name: string
    legal_name?: string
    business_summary: string
    industry?: string
    location?: string
    stage?: string
    revenue_model?: string
    team_background?: string
    traction?: string
    use_of_funds?: string
    monthly_revenue?: number
    annual_revenue?: number
    employee_count?: number
    website?: string
    metadata?: Record<string, unknown>
  }
  program_info: {
    external_id?: string
    name: string
    provider?: string
    category?: string
    program_url?: string
    funding_amount?: number
    location?: string
    raw_guidelines_text?: string
    target_outcome?: string
    metadata?: Record<string, unknown>
  }
}

export type BusinessPlanSectionResponse = {
  section_key: string
  title: string
  content: string
  citations: string[]
}

export type BusinessPlanGenerateResponse = {
  package_id: string
  run_id: string
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
