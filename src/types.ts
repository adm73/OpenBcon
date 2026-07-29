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
  programName: string
  businessName: string
  fundingRequest: string
  sourceMaterial: string
  completedAt: string
  readinessScore: number
  thoughts: string[]
  documents: GeneratedDocument[]
  sections: GeneratedPackageSection[]
}
