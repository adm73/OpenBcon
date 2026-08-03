export type FundingTrackId = 'grant' | 'loan' | 'investor'

export type DocumentTypeId = 'plan' | 'forecast' | 'memo'

export type FundingTrack = {
  id: FundingTrackId
  label: string
  badge: string
  description: string
  reviewFocus: string[]
}

export type DocumentType = {
  id: DocumentTypeId
  label: string
  helper: string
}

export type BusinessProfile = {
  companyName: string
  founderName: string
  industry: string
  location: string
  businessModel: string
  stage: string
  fundingNeed: number
  monthlyRevenue: number
  grossMargin: number
  teamSize: number
  differentiation: string
}

export type GeneratedDocument = {
  title: string
  readinessScore: number
  summary: string
  sections: Array<{
    title: string
    body: string
  }>
  metrics: Array<{
    label: string
    value: string
  }>
  milestones: string[]
  financialForecast?: FinancialForecast
}

export type FinancialForecastMonth = {
  key: string
  label: string
  year: number
  month: number
}

export type FinancialForecastRow = {
  category: 'revenue' | 'expense'
  name: string
  values: number[]
  total: number
}

export type FinancialForecastYearSummary = {
  year: number
  label: string
  total_revenue: number
  total_expenses: number
  net_cash_flow: number
}

export type FinancialForecast = {
  years: number
  currency: string
  start_month: string
  months: FinancialForecastMonth[]
  rows: FinancialForecastRow[]
  monthly_revenue_totals: number[]
  monthly_expense_totals: number[]
  monthly_net_cash_flow: number[]
  ending_cash_balance: number[]
  annual_summaries: FinancialForecastYearSummary[]
  assumptions: string[]
}

export type GeneratedPackageSection = {
  id: string
  title: string
  body: string
  agent: string
  documentLabel: string
}

export type GeneratedPackage = {
  title: string
  strategicReportId?: string
  programName: string
  businessName: string
  fundingRequest: string
  sourceMaterial: string
  completedAt: string
  readinessScore: number
  thoughts: string[]
  documents: GeneratedDocument[]
  sections: GeneratedPackageSection[]
  financialForecast?: FinancialForecast
}

export type StrategicReviewReport = {
  id: string
  applicationId: string
  generatedPackage: GeneratedPackage
}
