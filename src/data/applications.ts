import { setPersistentItem } from '../persistence/storage'

export type ApplicationStatus =
  | 'Draft'
  | 'In Review'
  | 'Ready'
  | 'Submitted'
  | 'Awarded'

export type ApplicationRecord = {
  id: string
  title: string
  programName: string
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
}

export const applicationStorageKey = 'bconomics-applications-v1'

export const initialApplications: ApplicationRecord[] = [
  {
    id: 'app-feddev-growth',
    title: 'Growth project application',
    programName: 'FedDev Ontario Growth Program',
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
    id: 'app-digital-adoption',
    title: 'Digital adoption plan',
    programName: 'Canada Digital Adoption Program',
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
    id: 'app-bdc-loan',
    title: 'Working capital financing',
    programName: 'BDC Small Business Loan',
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
    id: 'app-ontario-expansion',
    title: 'Ontario expansion proposal',
    programName: 'Ontario Business Expansion Fund',
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
    id: 'app-clean-tech',
    title: 'Heat-pump fleet modernization',
    programName: 'Clean Technology Adoption Fund',
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
    id: 'app-market-expansion',
    title: 'Retail market expansion',
    programName: 'Ontario Market Expansion Grant',
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

export function loadApplications() {
  if (typeof window === 'undefined') return initialApplications

  try {
    const saved = window.localStorage.getItem(applicationStorageKey)
    return saved ? (JSON.parse(saved) as ApplicationRecord[]) : initialApplications
  } catch {
    return initialApplications
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
