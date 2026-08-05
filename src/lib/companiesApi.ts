import { getEnvironmentModeHeaders } from './environmentMode'

export type CompanyTeamMember = {
  id: string
  name: string
  title: string
  responsibilities: string
}

export type CompanyApiRecord = {
  id: string
  logo: string
  name: string
  legalName: string
  corporationDate: string
  legalStructure: string
  sector: string
  industry: string
  stage: string
  location: string
  website: string
  description: string
  productsOrServices: string
  busyPeriods: string[]
  slowPeriods: string[]
  mission: string
  vision: string
  values: string
  owner: string
  email: string
  emailVerified: boolean
  phone: string
  employees: string
  monthlyRevenue: string
  fundingUsage: string[]
  teamIntro: string
  teamMembers: CompanyTeamMember[]
  fundingTarget: string
  readiness: number
  status: 'Active' | 'Needs review' | 'Draft'
  updatedAt: string
}

export type SaveCompanyRequest = Omit<CompanyApiRecord, 'id'> & {
  id?: string
}

async function readError(response: Response, fallback: string) {
  try {
    const body = (await response.json()) as { message?: string }
    if (body.message) return body.message
  } catch {
    // Keep the status-based error when the server did not return JSON.
  }
  return fallback
}

export async function loadCompaniesViaApi() {
  const response = await fetch('/api/companies', {
    headers: getEnvironmentModeHeaders(),
    credentials: 'include',
  })
  if (!response.ok) {
    throw new Error(
      await readError(
        response,
        `Company loading failed with status ${response.status}.`,
      ),
    )
  }

  const body = (await response.json()) as { companies?: CompanyApiRecord[] }
  return Array.isArray(body.companies) ? body.companies : []
}

export async function saveCompanyViaApi(company: SaveCompanyRequest) {
  const { owner, teamIntro, ...companyFields } = company
  const response = await fetch('/api/companies', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...getEnvironmentModeHeaders(),
    },
    credentials: 'include',
    body: JSON.stringify({
      ...companyFields,
      founderName: owner,
      teamBackground: teamIntro,
    }),
  })
  if (!response.ok) {
    throw new Error(
      await readError(
        response,
        `Company save failed with status ${response.status}.`,
      ),
    )
  }

  const body = (await response.json()) as { company?: CompanyApiRecord }
  if (!body.company) {
    throw new Error('The server did not return the saved company.')
  }
  return body.company
}
