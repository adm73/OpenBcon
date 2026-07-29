import type { BusinessProfile, DocumentType, FundingTrack } from '../types'

export const fundingTracks: FundingTrack[] = [
  {
    id: 'grant',
    label: 'Grant Ready',
    badge: 'Non-dilutive',
    description:
      'Shape the narrative around impact, eligibility, and measurable outcomes.',
    reviewFocus: ['Eligibility fit', 'Economic impact', 'Milestone clarity'],
  },
  {
    id: 'loan',
    label: 'Loan Ready',
    badge: 'Bank format',
    description:
      'Highlight repayment capacity, operating discipline, and downside protection.',
    reviewFocus: ['Cash coverage', 'Repayment logic', 'Risk controls'],
  },
  {
    id: 'investor',
    label: 'Investor Ready',
    badge: 'Narrative first',
    description:
      'Present the opportunity, traction, and growth engine in a sharper pitch format.',
    reviewFocus: ['Market size', 'Growth loop', 'Margin expansion'],
  },
]

export const documentTypes: DocumentType[] = [
  {
    id: 'plan',
    label: 'Business Plan',
    helper: '6-section lender and grant format',
  },
  {
    id: 'forecast',
    label: 'Cash Flow Forecast',
    helper: '12-month operating assumptions and runway',
  },
  {
    id: 'memo',
    label: 'Funding Memo',
    helper: 'Short-form application narrative',
  },
]

export const defaultProfile: BusinessProfile = {
  companyName: 'Northstar Foods',
  founderName: 'Ava Lin',
  industry: 'Food manufacturing',
  location: 'Toronto, ON',
  businessModel: 'Wholesale + direct-to-consumer snack boxes',
  stage: 'Revenue-generating',
  fundingNeed: 85000,
  monthlyRevenue: 18000,
  grossMargin: 58,
  teamSize: 4,
  differentiation:
    'Locally sourced functional snacks for busy families, sold through retail pilots and a recurring subscription model.',
}

export const landingHighlights = [
  {
    label: 'Guided Intake',
    body: 'Turn founder answers into structured funding inputs instead of blank pages and messy docs.',
  },
  {
    label: 'Reusable Templates',
    body: 'Support grants, loans, and investor narratives without rebuilding the workflow every time.',
  },
  {
    label: 'Open Source Friendly',
    body: 'Clean React + TypeScript project structure that is easy to extend, review, and publish on GitHub.',
  },
]

export const dashboardMetrics = [
  { label: 'Active projects', value: '12' },
  { label: 'Generated docs', value: '148' },
  { label: 'Approval rate target', value: '82%' },
  { label: 'Consultant seats', value: '4' },
]
