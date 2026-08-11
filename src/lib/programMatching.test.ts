import { describe, expect, it } from 'vitest'
import { defaultMatchingConfig } from '../config/platform'
import { calculateUnifiedMatch } from './programMatching'
import type { FundingProgramRecord } from '../data/fundingSources'

const program: FundingProgramRecord = {
  id: 'program-1',
  pid: 'program-pid-1',
  name: 'Ontario Growth Grant',
  type: 'Grant',
  provider: 'Government of Ontario',
  amount: 250000,
  currency: 'CAD',
  deadline: 'Open',
  match: 0,
  url: 'https://example.ca/program',
  location: 'Ontario',
  country: 'Canada',
  description: 'Funding for manufacturing businesses expanding production and technology.',
  process: 'Review eligibility and submit an application.',
  eligibility: 'Incorporated Ontario businesses with operating revenue.',
  eligibleUses: 'Equipment, hiring, and marketing.',
  targetCompanyTypes: 'Corporation and incorporated businesses.',
  requiredEvidence: 'Business plan and financial statements.',
}

const company = {
  id: 'company-1',
  logo: '',
  name: 'Northstar Foods',
  legalName: 'Northstar Foods Inc.',
  corporationDate: '2020-01',
  legalStructure: 'Corporation',
  sector: 'Secondary',
  industry: '31-33 Manufacturing',
  stage: 'Growth',
  location: 'Toronto, Ontario, Canada',
  website: 'https://example.ca',
  description: 'A food manufacturing company expanding production for retail customers.',
  productsOrServices: 'Functional snacks and packaged food products.',
  busyPeriods: [],
  slowPeriods: [],
  mission: 'Make healthy food accessible to busy families.',
  vision: 'Build a trusted Canadian food brand.',
  values: 'Quality and reliability.',
  owner: 'Ava Lin',
  email: 'ava@example.ca',
  emailVerified: true,
  phone: '',
  employees: '4',
  monthlyRevenue: '18000',
  fundingUsage: ['equipment', 'hiring'],
  teamIntro: 'A focused food manufacturing team.',
  teamMembers: [{ id: 'member-1', name: 'Ava Lin', title: 'Founder', responsibilities: 'Leads operations.' }],
  fundingTarget: '250000',
  readiness: 80,
  status: 'Active' as const,
  updatedAt: '2026-08-11T00:00:00.000Z',
}

describe('unified program matching', () => {
  it('returns the four agreed scoring categories and a bounded overall score', () => {
    const result = calculateUnifiedMatch(program, company)

    expect(result.overall).toBeGreaterThanOrEqual(0)
    expect(result.overall).toBeLessThanOrEqual(100)
    expect(result.eligibilityFit).toBeGreaterThanOrEqual(0)
    expect(result.companyProfileCompleteness).toBe(100)
    expect(result.policyMatch).toBeGreaterThanOrEqual(0)
    expect(result.documentReadiness).toBe(100)
    expect(result.eligibilityBreakdown).toEqual(
      expect.objectContaining({
        geography: expect.any(Number),
        companyType: expect.any(Number),
        businessStage: expect.any(Number),
        fundingAmountAndType: expect.any(Number),
      }),
    )
  })

  it('uses configurable weights for the final score', () => {
    const profileOnlyConfig = {
      ...defaultMatchingConfig,
      weights: {
        eligibilityFit: 0,
        companyProfileCompleteness: 100,
        policyMatch: 0,
        documentReadiness: 0,
      },
    }

    const result = calculateUnifiedMatch(program, company, null, profileOnlyConfig)

    expect(result.overall).toBe(result.companyProfileCompleteness)
  })

  it('uses linked application progress for document readiness', () => {
    const result = calculateUnifiedMatch(program, company, { progress: 42 })

    expect(result.documentReadiness).toBe(42)
  })
})
