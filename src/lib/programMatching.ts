import type { MatchingConfig } from '../config/platform'
import { defaultMatchingConfig } from '../config/platform'
import type { FundingProgramRecord } from '../data/fundingSources'
import type { CompanyApiRecord } from './companiesApi'

export type MatchingApplication = {
  progress?: number
} | null

export type UnifiedMatchResult = {
  overall: number
  eligibilityFit: number
  companyProfileCompleteness: number
  policyMatch: number
  documentReadiness: number
  eligibilityBreakdown: {
    geography: number
    companyType: number
    businessStage: number
    fundingAmountAndType: number
  }
  policyBreakdown: {
    industryAndSector: number
    fundingUsage: number
    policyObjectives: number
  }
}

type CompanyProfile = Pick<
  CompanyApiRecord,
  | 'legalName'
  | 'corporationDate'
  | 'legalStructure'
  | 'sector'
  | 'industry'
  | 'stage'
  | 'location'
  | 'description'
  | 'productsOrServices'
  | 'mission'
  | 'vision'
  | 'values'
  | 'owner'
  | 'employees'
  | 'monthlyRevenue'
  | 'fundingTarget'
  | 'fundingUsage'
  | 'teamIntro'
  | 'teamMembers'
>

const STOP_WORDS = new Set([
  'about',
  'and',
  'are',
  'for',
  'from',
  'into',
  'that',
  'the',
  'this',
  'with',
])

function clampScore(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)))
}

function text(value: unknown) {
  return typeof value === 'string' ? value.trim().toLowerCase() : ''
}

function parseAmount(value: unknown) {
  const amount = Number(String(value ?? '').replace(/[^0-9.-]/gu, ''))
  return Number.isFinite(amount) ? Math.max(0, amount) : 0
}

function tokens(value: string) {
  return new Set(
    value
      .toLowerCase()
      .replace(/[^a-z0-9-]+/gu, ' ')
      .split(/\s+/u)
      .filter((token) => token.length >= 4 && !STOP_WORDS.has(token)),
  )
}

function containsAny(value: string, candidates: string[]) {
  return candidates.some((candidate) => value.includes(candidate))
}

function overlapScore(programText: string, companyText: string, neutral = 70) {
  const programTokens = tokens(programText)
  const companyTokens = tokens(companyText)
  if (programTokens.size === 0) return neutral

  let overlap = 0
  for (const token of companyTokens) {
    if (programTokens.has(token)) overlap += 1
  }

  if (overlap >= 2) return 100
  if (overlap === 1) return 85
  return 60
}

function weightedScore(
  values: Array<{ score: number; weight: number }>,
) {
  const totalWeight = values.reduce((sum, item) => sum + Math.max(0, item.weight), 0)
  if (totalWeight === 0) return 0
  return clampScore(
    values.reduce((sum, item) => sum + item.score * Math.max(0, item.weight), 0) /
      totalWeight,
  )
}

function calculateGeographyScore(program: FundingProgramRecord, company: CompanyProfile) {
  const programLocation = text(program.location)
  const programCountry = text(program.country)
  const companyLocation = text(company.location)
  if (!programLocation && !programCountry) return 75
  if ((programLocation && companyLocation.includes(programLocation)) ||
    (programCountry && companyLocation.includes(programCountry)) ||
    (programCountry === 'canada' && containsAny(companyLocation, ['canada', 'ontario', 'quebec', 'alberta', 'british columbia', 'manitoba', 'saskatchewan', 'nova scotia', 'new brunswick', 'newfoundland', 'pei'])) ||
    (programCountry === 'united states' && containsAny(companyLocation, ['united states', 'usa', 'u.s.']))
  ) {
    return 100
  }
  return 45
}

function calculateCompanyTypeScore(program: FundingProgramRecord, company: CompanyProfile) {
  const targetTypes = text(program.targetCompanyTypes)
  const legalStructure = text(company.legalStructure)
  if (!targetTypes) return legalStructure ? 75 : 55
  if (!legalStructure) return 45

  const normalizedStructure = legalStructure.replace(/[^a-z0-9]+/gu, ' ')
  const structureTokens = normalizedStructure.split(/\s+/u).filter(Boolean)
  if (structureTokens.some((token) => targetTypes.includes(token))) return 100
  if (/incorporat|corporation|limited|non profit|nonprofit|sole propriet|partnership/u.test(targetTypes)) {
    return /incorporat|corporation|limited/u.test(targetTypes) ===
      /incorporat|corporation|limited/u.test(normalizedStructure)
      ? 85
      : 55
  }
  return 70
}

function calculateStageScore(program: FundingProgramRecord, company: CompanyProfile) {
  const programText = [program.eligibility, program.description, program.targetCompanyTypes]
    .map(text)
    .join(' ')
  const stage = text(company.stage)
  if (!stage || !programText) return 75
  if (/(startup|early-stage|launch|new business|pre-revenue)/u.test(programText)) {
    return stage === 'launch' ? 100 : stage === 'growth' ? 75 : 60
  }
  if (/(mature|established|revenue-generating|operating history|growth|expansion)/u.test(programText)) {
    return stage === 'growth' || stage === 'maturity' ? 100 : stage === 'launch' ? 65 : 75
  }
  return 75
}

function calculateFundingAmountAndTypeScore(
  program: FundingProgramRecord,
  company: CompanyProfile,
) {
  const target = parseAmount(company.fundingTarget)
  const amount = parseAmount(program.amount)
  const amountScore = target > 0 && amount > 0
    ? amount >= target * 0.5 && amount <= target * 2
      ? 100
      : amount >= target * 0.25 && amount <= target * 4
        ? 80
        : 55
    : 75
  const useText = text(program.eligibleUses)
  const hasUsageAlignment = company.fundingUsage.some((usage) => {
    const terms: Record<string, RegExp> = {
      equipment: /equipment|capital|tools/u,
      inventory: /inventory|working capital|stock/u,
      hiring: /hiring|hire|staff|employee|talent/u,
      advertising: /marketing|advertis|customer acquisition|market development/u,
      rent: /rent|operating cost|working capital/u,
      payroll: /payroll|salary|wage|working capital/u,
    }
    return terms[usage]?.test(useText) ?? false
  })
  return clampScore(amountScore * 0.75 + (hasUsageAlignment ? 100 : 65) * 0.25)
}

function calculateCompanyProfileCompleteness(company: CompanyProfile) {
  const fields = [
    company.legalName,
    company.corporationDate,
    company.legalStructure,
    company.sector,
    company.industry,
    company.stage,
    company.location,
    company.description,
    company.productsOrServices,
    company.mission,
    company.vision,
    company.values,
    company.owner,
    company.employees,
    company.monthlyRevenue,
    company.teamIntro,
    company.teamMembers.length ? 'team' : '',
  ]
  return clampScore((fields.filter((field) => Boolean(text(field))).length / fields.length) * 100)
}

function calculateFundingUsageScore(program: FundingProgramRecord, company: CompanyProfile) {
  if (company.fundingUsage.length === 0) return 55
  const eligibleUses = text(program.eligibleUses)
  const terms: Record<string, RegExp> = {
    equipment: /equipment|capital|tools/u,
    inventory: /inventory|working capital|stock/u,
    hiring: /hiring|hire|staff|employee|talent/u,
    advertising: /marketing|advertis|customer acquisition|market development/u,
    rent: /rent|operating cost|working capital/u,
    payroll: /payroll|salary|wage|working capital/u,
  }
  const matches = company.fundingUsage.filter((usage) => terms[usage]?.test(eligibleUses))
  return clampScore(matches.length ? 70 + matches.length * 15 : 55)
}

function calculatePolicyObjectivesScore(program: FundingProgramRecord, company: CompanyProfile) {
  const programText = [
    program.description,
    program.eligibility,
    program.targetCompanyTypes,
    program.requiredEvidence,
  ].map(text).join(' ')
  const companyText = [company.description, company.productsOrServices, company.mission, company.vision, company.values]
    .map(text)
    .join(' ')
  return overlapScore(programText, companyText, 75)
}

export function calculateUnifiedMatch(
  program: FundingProgramRecord,
  company: CompanyProfile,
  application: MatchingApplication = null,
  config: MatchingConfig = defaultMatchingConfig,
): UnifiedMatchResult {
  const eligibilityBreakdown = {
    geography: calculateGeographyScore(program, company),
    companyType: calculateCompanyTypeScore(program, company),
    businessStage: calculateStageScore(program, company),
    fundingAmountAndType: calculateFundingAmountAndTypeScore(program, company),
  }
  const policyBreakdown = {
    industryAndSector: overlapScore(
      [program.description, program.eligibility, program.targetCompanyTypes].map(text).join(' '),
      [company.industry, company.sector, company.description, company.productsOrServices].map(text).join(' '),
      75,
    ),
    fundingUsage: calculateFundingUsageScore(program, company),
    policyObjectives: calculatePolicyObjectivesScore(program, company),
  }
  const eligibilityFit = weightedScore([
    { score: eligibilityBreakdown.geography, weight: config.eligibilityWeights.geography },
    { score: eligibilityBreakdown.companyType, weight: config.eligibilityWeights.companyType },
    { score: eligibilityBreakdown.businessStage, weight: config.eligibilityWeights.businessStage },
    { score: eligibilityBreakdown.fundingAmountAndType, weight: config.eligibilityWeights.fundingAmountAndType },
  ])
  const policyMatch = weightedScore([
    { score: policyBreakdown.industryAndSector, weight: config.policyWeights.industryAndSector },
    { score: policyBreakdown.fundingUsage, weight: config.policyWeights.fundingUsage },
    { score: policyBreakdown.policyObjectives, weight: config.policyWeights.policyObjectives },
  ])
  const companyProfileCompleteness = calculateCompanyProfileCompleteness(company)
  const documentReadiness = clampScore(
    application?.progress ?? companyProfileCompleteness,
  )
  const overall = weightedScore([
    { score: eligibilityFit, weight: config.weights.eligibilityFit },
    { score: companyProfileCompleteness, weight: config.weights.companyProfileCompleteness },
    { score: policyMatch, weight: config.weights.policyMatch },
    { score: documentReadiness, weight: config.weights.documentReadiness },
  ])

  return {
    overall,
    eligibilityFit,
    companyProfileCompleteness,
    policyMatch,
    documentReadiness,
    eligibilityBreakdown,
    policyBreakdown,
  }
}
