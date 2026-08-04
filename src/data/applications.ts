import type { GeneratedPackage, StrategicReviewReport } from '../types'
import { findFundingProgramByName } from './fundingSources'
import type { SavedProgramStage } from './savedPrograms'
import { setPersistentItem } from '../persistence/storage'

export type ApplicationStatus =
  | 'Draft'
  | 'In Review'
  | 'Ready'
  | 'Submitted'
  | 'Awarded'

export type ApplicationRecord = {
  id: string
  appId?: string
  title: string
  programName: string
  programUrl?: string
  company: string
  fundingType: 'Grant' | 'Loan'
  amount: number
  status: ApplicationStatus
  progress: number
  deadline: string
  deadlineOrder: number
  owner: string
  updatedAt: string
  documentsComplete: number
  documentsTotal: number
  nextAction: string
  note: string
  strategicReviewReports?: StrategicReviewReport[]
}

export type GeneratedApplicationInput = {
  id?: string
  title?: string
  programName: string
  programUrl?: string
  company: string
  fundingType: 'Grant' | 'Loan'
  amount: number
  deadline: string
  owner: string
  readinessScore: number
  documentCount: number
  generatedAt?: Date
  strategicReviewReport?: StrategicReviewReport | null
}

export type SavedProgramApplicationInput = {
  applicationId?: string
  programName: string
  programUrl?: string
  company: string
  fundingType: 'Grant' | 'Loan'
  amount: number
  deadline: string
  owner: string
  stage: SavedProgramStage
  note?: string
}

export const applicationStorageKey = 'bconomics-applications-v1'

const legacyApplicationIdMap: Record<string, string> = {
  '9747353081165': '1',
  '9186863812373': '2',
  '9072234635298': '3',
  '9558176441246': '4',
  '9346348411018': '5',
  '9579697458235': '6',
  '9892337221705': '7',
}

export const initialApplications: ApplicationRecord[] = [
  {
    id: '2',
    title: 'Growth project application',
    programName: 'FedDev Ontario Growth Program',
    programUrl: 'https://feddev-ontario.canada.ca/en/funding',
    company: 'Northstar Foods',
    fundingType: 'Grant',
    amount: 250000,
    status: 'In Review',
    progress: 72,
    deadline: 'Aug 31, 2026',
    deadlineOrder: 34,
    owner: 'Ava Lin',
    updatedAt: 'Updated 2 hours ago',
    documentsComplete: 6,
    documentsTotal: 8,
    nextAction: 'Review eligible project costs',
    note: 'Finance team is validating equipment quotes and matching funds.',
  },
  {
    id: '3',
    title: 'Digital adoption plan',
    programName: 'Canada Digital Adoption Program',
    programUrl: 'https://ised-isde.canada.ca/site/canada-digital-adoption-program/en',
    company: 'Greenline HVAC',
    fundingType: 'Grant',
    amount: 15000,
    status: 'Ready',
    progress: 94,
    deadline: 'Rolling intake',
    deadlineOrder: 999,
    owner: 'Morgan Chen',
    updatedAt: 'Updated yesterday',
    documentsComplete: 7,
    documentsTotal: 7,
    nextAction: 'Final applicant sign-off',
    note: 'Digital plan and vendor estimates are complete.',
  },
  {
    id: '4',
    title: 'Working capital financing',
    programName: 'BDC Small Business Loan',
    programUrl: 'https://www.bdc.ca/en/financing/small-business-loan',
    company: 'Fieldnote AI',
    fundingType: 'Loan',
    amount: 100000,
    status: 'Draft',
    progress: 38,
    deadline: 'Open',
    deadlineOrder: 999,
    owner: 'Jordan Smith',
    updatedAt: 'Updated Jul 26',
    documentsComplete: 3,
    documentsTotal: 8,
    nextAction: 'Upload year-to-date financials',
    note: '',
  },
  {
    id: '5',
    title: 'Ontario expansion proposal',
    programName: 'Ontario Business Expansion Fund',
    programUrl: 'https://www.ontario.ca/page/business-and-economy',
    company: 'Northstar Foods',
    fundingType: 'Grant',
    amount: 100000,
    status: 'Submitted',
    progress: 100,
    deadline: 'Sep 18, 2026',
    deadlineOrder: 52,
    owner: 'Ava Lin',
    updatedAt: 'Submitted Jul 24',
    documentsComplete: 9,
    documentsTotal: 9,
    nextAction: 'Monitor reviewer communications',
    note: 'Confirmation number ON-BEF-20481.',
  },
  {
    id: '6',
    title: 'Heat-pump fleet modernization',
    programName: 'Clean Technology Adoption Fund',
    programUrl: 'https://ised-isde.canada.ca/site/strategic-innovation-fund/en/clean-technology-adoption',
    company: 'Greenline HVAC',
    fundingType: 'Grant',
    amount: 120000,
    status: 'Awarded',
    progress: 100,
    deadline: 'Nov 15, 2026',
    deadlineOrder: 110,
    owner: 'Morgan Chen',
    updatedAt: 'Awarded Jul 21',
    documentsComplete: 8,
    documentsTotal: 8,
    nextAction: 'Complete contribution agreement',
    note: 'Approved for $96,000 subject to contribution agreement.',
  },
  {
    id: '7',
    title: 'Retail market expansion',
    programName: 'Ontario Market Expansion Grant',
    programUrl: 'https://www.ontario.ca/page/business-and-economy',
    company: 'Northstar Foods',
    fundingType: 'Grant',
    amount: 85000,
    status: 'Draft',
    progress: 24,
    deadline: 'Oct 30, 2026',
    deadlineOrder: 94,
    owner: 'Ava Lin',
    updatedAt: 'Updated Jul 20',
    documentsComplete: 2,
    documentsTotal: 8,
    nextAction: 'Draft market expansion milestones',
    note: '',
  },
]

function isNumericApplicationId(value: string) {
  return /^\d+$/u.test(value.trim())
}

function normalizePersistedApplicationId(value: string) {
  const normalized = value.trim()
  return legacyApplicationIdMap[normalized] ?? normalized
}

function hashApplicationIdSeed(seed: string) {
  let left = 0
  let right = 0

  for (const character of seed) {
    const code = character.charCodeAt(0)
    left = (left * 31 + code) % 1_000_000
    right = (right * 17 + code) % 1_000_000
  }

  return `9${String(left).padStart(6, '0')}${String(right).padStart(6, '0')}`
}

function normalizeApplicationId(
  application: Pick<ApplicationRecord, 'id' | 'company' | 'programName'>,
  index = 0,
) {
  if (isNumericApplicationId(application.id)) {
    return normalizePersistedApplicationId(application.id)
  }

  return hashApplicationIdSeed(
    `${application.id}|${application.company}|${application.programName}|${index}`,
  )
}

function hydrateApplicationRecord(application: ApplicationRecord): ApplicationRecord {
  const id = normalizeApplicationId(application)
  const usableReports = application.strategicReviewReports?.filter(
    (report) => report?.generatedPackage != null,
  )
  const latestReport = usableReports?.at(-1)
  const strategicReviewReports = latestReport
    ? [{ ...latestReport, applicationId: id }]
    : []

  return {
    ...application,
    id,
    programUrl:
      application.programUrl?.trim() ||
      findFundingProgramByName(application.programName)?.url ||
      '',
    strategicReviewReports,
  }
}

export function loadApplications() {
  if (typeof window === 'undefined') return initialApplications

  try {
    const saved = window.localStorage.getItem(applicationStorageKey)
    return saved
      ? (JSON.parse(saved) as ApplicationRecord[]).map(hydrateApplicationRecord)
      : initialApplications.map(hydrateApplicationRecord)
  } catch {
    return initialApplications.map(hydrateApplicationRecord)
  }
}

export function saveApplications(applications: ApplicationRecord[]) {
  setPersistentItem(applicationStorageKey, JSON.stringify(applications))
}

export function updateApplicationRecord(
  applications: ApplicationRecord[],
  applicationId: string,
  updates: Partial<Omit<ApplicationRecord, 'id'>>,
) {
  return applications.map((application) =>
    application.id === applicationId
      ? { ...application, ...updates }
      : application,
  )
}

function slugifyApplicationFragment(value: string) {
  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')

  return normalized || 'generated'
}

export function buildGeneratedApplicationId(company: string, programName: string) {
  return hashApplicationIdSeed(
    `${slugifyApplicationFragment(company)}|${slugifyApplicationFragment(programName)}`,
  )
}

function calculateDeadlineOrder(deadline: string, referenceDate = new Date()) {
  const parsed = Date.parse(deadline)
  if (Number.isNaN(parsed)) {
    return 999
  }

  const millisecondsPerDay = 1000 * 60 * 60 * 24
  const startOfReferenceDay = new Date(referenceDate)
  startOfReferenceDay.setHours(0, 0, 0, 0)
  return Math.max(0, Math.ceil((parsed - startOfReferenceDay.getTime()) / millisecondsPerDay))
}

function mapSavedProgramStageToApplicationState(stage: SavedProgramStage) {
  if (stage === 'Ready to apply') {
    return {
      status: 'Ready' as const,
      progress: 82,
      nextAction: 'Review the business profile and launch the funding package',
    }
  }

  if (stage === 'Preparing') {
    return {
      status: 'In Review' as const,
      progress: 58,
      nextAction: 'Complete the business profile and supporting narrative',
    }
  }

  return {
    status: 'Draft' as const,
    progress: 34,
    nextAction: 'Confirm the funding fit and complete the business profile',
  }
}

export function materializeSavedProgramApplication(
  applications: ApplicationRecord[],
  input: SavedProgramApplicationInput,
) {
  const existing =
    applications.find((application) =>
      input.applicationId ? application.id === input.applicationId : false,
    ) ??
    applications.find(
      (application) =>
        application.programName === input.programName &&
        application.company === input.company,
    ) ??
    applications.find((application) => application.programName === input.programName) ??
    null

  const id = normalizeApplicationId(
    {
      id:
        input.applicationId?.trim() ||
        existing?.id ||
        buildGeneratedApplicationId(input.company, input.programName),
      company: input.company,
      programName: input.programName,
    },
    applications.length,
  )
  const stageState = mapSavedProgramStageToApplicationState(input.stage)
  const savedNote =
    input.note?.trim() ||
    `Created from Saved Programs on ${new Intl.DateTimeFormat('en-CA', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    }).format(new Date())}.`

  const applicationRecord: ApplicationRecord = {
    id,
    appId: existing?.appId,
    title: existing?.title?.trim() || `${input.programName} application`,
    programName: input.programName,
    programUrl:
      input.programUrl?.trim() ||
      existing?.programUrl?.trim() ||
      findFundingProgramByName(input.programName)?.url ||
      '',
    company: existing?.company?.trim() || input.company,
    fundingType: input.fundingType,
    amount: Math.max(0, input.amount),
    status: existing?.status ?? stageState.status,
    progress: existing?.progress ?? stageState.progress,
    deadline: input.deadline.trim() || 'Open',
    deadlineOrder: calculateDeadlineOrder(input.deadline),
    owner: existing?.owner?.trim() || input.owner.trim() || 'Workspace Admin',
    updatedAt: existing?.updatedAt ?? 'Saved just now',
    documentsComplete: existing?.documentsComplete ?? 0,
    documentsTotal: existing?.documentsTotal ?? 3,
    nextAction: existing?.nextAction?.trim() || stageState.nextAction,
    note: existing?.note?.trim() || savedNote,
    strategicReviewReports: existing?.strategicReviewReports ?? [],
  }

  if (existing) {
    return {
      applicationId: id,
      applications: applications.map((application) =>
        application.id === existing.id ? applicationRecord : application,
      ),
    }
  }

  return {
    applicationId: id,
    applications: [applicationRecord, ...applications],
  }
}

export function upsertGeneratedApplication(
  applications: ApplicationRecord[],
  input: GeneratedApplicationInput,
) {
  const generatedAt = input.generatedAt ?? new Date()
  const existing = applications.find((application) =>
    input.id
      ? application.id === input.id
      : application.programName === input.programName &&
        application.company === input.company,
  )
  const id = normalizeApplicationId(
    {
      id:
        input.id?.trim() ||
        existing?.id ||
        buildGeneratedApplicationId(input.company, input.programName),
      company: input.company,
      programName: input.programName,
    },
    applications.length,
  )
  const documentsTotal = Math.max(1, input.documentCount)
  const calculatedDocumentsComplete = Math.max(
    1,
    Math.min(documentsTotal, Math.round((input.readinessScore / 100) * documentsTotal)),
  )
  const progress = Math.max(12, Math.min(100, input.readinessScore))
  const defaultStatus = progress >= 85 ? 'Ready' : 'Draft'
  const nextAction =
    progress >= 85
      ? 'Review generated package and finalize the submission checklist'
      : 'Review generated package and add the remaining supporting evidence'
  const generatedNote = `Generated from Quick Build on ${generatedAt.toLocaleDateString('en-CA', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })}.`
  const strategicReviewReports = input.strategicReviewReport
    ? [
        {
          ...input.strategicReviewReport,
          applicationId: id,
        },
      ]
    : existing?.strategicReviewReports ?? []

  const generatedRecord: ApplicationRecord = {
    id,
    appId: existing?.appId,
    title: input.title?.trim() || `${input.programName} application`,
    programName: input.programName,
    programUrl:
      input.programUrl?.trim() ||
      existing?.programUrl?.trim() ||
      findFundingProgramByName(input.programName)?.url ||
      '',
    company: input.company,
    fundingType: input.fundingType,
    amount: Math.max(0, input.amount),
    status: existing?.status ?? defaultStatus,
    progress: existing ? Math.max(existing.progress, progress) : progress,
    deadline: input.deadline.trim() || 'Open',
    deadlineOrder: calculateDeadlineOrder(input.deadline),
    owner: input.owner.trim() || existing?.owner || 'Workspace Admin',
    updatedAt: 'Updated just now',
    documentsComplete: existing
      ? Math.max(existing.documentsComplete, calculatedDocumentsComplete)
      : calculatedDocumentsComplete,
    documentsTotal: existing ? Math.max(existing.documentsTotal, documentsTotal) : documentsTotal,
    nextAction:
      existing && !['Draft', 'Ready'].includes(existing.status) ? existing.nextAction : nextAction,
    note: existing?.note?.trim() ? existing.note : generatedNote,
    strategicReviewReports,
  }

  if (existing) {
    return applications.map((application) =>
      application.id === id ? generatedRecord : application,
    )
  }

  return [generatedRecord, ...applications]
}

export function findApplicationRecord(
  applications: ApplicationRecord[],
  applicationId: string,
) {
  return applications.find((application) => application.id === applicationId) ?? null
}

export function findApplicationRecordByAppId(
  applications: ApplicationRecord[],
  appId: string,
) {
  return applications.find((application) => application.appId === appId) ?? null
}

export function findApplicationRecordByPublicId(
  applications: ApplicationRecord[],
  publicId: string,
) {
  return (
    findApplicationRecordByAppId(applications, publicId) ??
    findApplicationRecord(applications, publicId)
  )
}

export function getLatestGeneratedApplication(
  applications: ApplicationRecord[],
) {
  return applications
    .filter((application) => application.strategicReviewReports?.length)
    .sort((left, right) => {
      const leftReport = left.strategicReviewReports?.at(-1)
      const rightReport = right.strategicReviewReports?.at(-1)
      const leftTime = Date.parse(leftReport?.generatedPackage.completedAt ?? '')
      const rightTime = Date.parse(rightReport?.generatedPackage.completedAt ?? '')
      return (Number.isNaN(rightTime) ? 0 : rightTime) - (Number.isNaN(leftTime) ? 0 : leftTime)
    })[0] ?? null
}

export function createStrategicReviewReport(
  applicationId: string,
  generatedPackage: GeneratedPackage,
) {
  return {
    id:
      generatedPackage.strategicReportId ||
      `strategic-report-${applicationId}-${Date.now()}`,
    applicationId,
    generatedPackage,
  } satisfies StrategicReviewReport
}

export function getStrategicReviewReports(applications: ApplicationRecord[]) {
  return applications
    .flatMap((application) => {
      const reports = application.strategicReviewReports ?? []

      return reports
        .filter((report) => report?.generatedPackage != null)
        .map((report) => ({
          ...report,
          applicationId: application.id,
        }))
    })
    .sort((left, right) => {
      const leftTime = Date.parse(left.generatedPackage.completedAt)
      const rightTime = Date.parse(right.generatedPackage.completedAt)
      return (Number.isNaN(rightTime) ? 0 : rightTime) - (Number.isNaN(leftTime) ? 0 : leftTime)
    })
}
