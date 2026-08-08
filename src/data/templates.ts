import type { SyncedResourceRecord } from './fundingSources'

export type TemplateFormat = 'DOCX' | 'XLSX' | 'PDF' | 'Notion'
export type TemplateTier = 'Free' | 'Pro' | 'Configured'

export type TemplateRecord = {
  id: string
  title: string
  description: string
  category: string
  format: TemplateFormat
  audience: string
  tier: TemplateTier
  uses: number
  updatedAt: string
  featured: boolean
  url: string
  sourceId?: string
  sourceName: string
  sectionCount?: number
}

export function mapDocumentTypesToTemplates(
  documentTypes: Array<{ id: string; name: string; prompt: string }>,
  sections: Array<{ documentTypeId: string; enabled: boolean }> = [],
): TemplateRecord[] {
  return documentTypes.map((documentType) => ({
    id: documentType.id,
    title: documentType.name,
    description: documentType.prompt,
    category: 'Strategic Report',
    format: 'DOCX',
    audience: 'Strategic Report',
    tier: 'Configured',
    uses: 0,
    updatedAt: 'Configured in Admin Console',
    featured: false,
    url: '',
    sourceId: 'advisory-hub-document-types',
    sourceName: 'Strategic Report - Document Types',
    sectionCount: sections.filter(
      (section) => section.documentTypeId === documentType.id && section.enabled,
    ).length,
  }))
}

export const builtInTemplates: TemplateRecord[] = [
  {
    id: 'bank-ready-business-plan',
    title: 'Bank-Ready Business Plan',
    description:
      'A complete lender-focused plan structure with market, operations, risk, and repayment sections.',
    category: 'Business plans',
    format: 'DOCX',
    audience: 'Established business',
    tier: 'Free',
    uses: 2840,
    updatedAt: 'Updated this week',
    featured: true,
    url: 'https://example.com/templates/bank-ready-business-plan',
    sourceName: 'Bconomics library',
  },
  {
    id: 'grant-application-narrative',
    title: 'Grant Application Narrative',
    description:
      'Reviewer-aligned prompts for project need, outcomes, work plan, and measurable impact.',
    category: 'Applications',
    format: 'DOCX',
    audience: 'All businesses',
    tier: 'Free',
    uses: 1940,
    updatedAt: 'Updated yesterday',
    featured: true,
    url: 'https://example.com/templates/grant-narrative',
    sourceName: 'Bconomics library',
  },
  {
    id: 'three-year-cash-flow',
    title: 'Three-Year Cash Flow Forecast',
    description:
      'Editable monthly assumptions, operating cash flow, financing, and scenario analysis.',
    category: 'Financial',
    format: 'XLSX',
    audience: 'Growth company',
    tier: 'Pro',
    uses: 1625,
    updatedAt: 'Updated Jul 25',
    featured: true,
    url: 'https://example.com/templates/cash-flow',
    sourceName: 'Bconomics library',
  },
  {
    id: 'startup-investor-plan',
    title: 'Startup Investor Plan',
    description:
      'A concise company narrative designed for early-stage investors and accelerator reviewers.',
    category: 'Business plans',
    format: 'DOCX',
    audience: 'Startup',
    tier: 'Pro',
    uses: 1120,
    updatedAt: 'Updated Jul 22',
    featured: false,
    url: 'https://example.com/templates/startup-plan',
    sourceName: 'Bconomics library',
  },
  {
    id: 'project-budget-builder',
    title: 'Eligible Project Budget',
    description:
      'Build a program-ready budget with eligible costs, funding sources, and matching contributions.',
    category: 'Financial',
    format: 'XLSX',
    audience: 'All businesses',
    tier: 'Free',
    uses: 980,
    updatedAt: 'Updated Jul 20',
    featured: false,
    url: 'https://example.com/templates/project-budget',
    sourceName: 'Bconomics library',
  },
  {
    id: 'funding-readiness-checklist',
    title: 'Funding Readiness Checklist',
    description:
      'A practical pre-application checklist covering company, financial, project, and team evidence.',
    category: 'Checklists',
    format: 'PDF',
    audience: 'All businesses',
    tier: 'Free',
    uses: 860,
    updatedAt: 'Updated Jul 18',
    featured: false,
    url: 'https://example.com/templates/readiness-checklist',
    sourceName: 'Bconomics library',
  },
  {
    id: 'application-workspace',
    title: 'Application Project Workspace',
    description:
      'Coordinate owners, deadlines, evidence, reviewer comments, and submission milestones.',
    category: 'Applications',
    format: 'Notion',
    audience: 'Advisor or partner',
    tier: 'Pro',
    uses: 640,
    updatedAt: 'Updated Jul 16',
    featured: false,
    url: 'https://example.com/templates/application-workspace',
    sourceName: 'Bconomics library',
  },
  {
    id: 'loan-document-checklist',
    title: 'Lender Document Checklist',
    description:
      'Track the financial statements, registrations, forecasts, and owner documents lenders expect.',
    category: 'Checklists',
    format: 'PDF',
    audience: 'Established business',
    tier: 'Free',
    uses: 520,
    updatedAt: 'Updated Jul 12',
    featured: false,
    url: 'https://example.com/templates/lender-checklist',
    sourceName: 'Bconomics library',
  },
]

function inferFormat(record: SyncedResourceRecord): TemplateFormat {
  const searchable = `${record.category} ${record.title}`.toLowerCase()
  if (/xlsx|excel|cash flow|budget|forecast/.test(searchable)) return 'XLSX'
  if (/pdf|checklist/.test(searchable)) return 'PDF'
  if (/notion|workspace/.test(searchable)) return 'Notion'
  return 'DOCX'
}

export function mapSyncedTemplates(records: SyncedResourceRecord[]): TemplateRecord[] {
  return records.map((record) => ({
    id: record.id,
    title: record.title,
    description: record.description,
    category: record.category || 'General',
    format: inferFormat(record),
    audience: 'All businesses',
    tier: 'Free',
    uses: 0,
    updatedAt: record.updatedAt,
    featured: false,
    url: record.url,
    sourceId: record.sourceId,
    sourceName: record.sourceName,
  }))
}

export function loadTemplateCatalog(records: SyncedResourceRecord[]) {
  return [...builtInTemplates, ...mapSyncedTemplates(records)]
}
