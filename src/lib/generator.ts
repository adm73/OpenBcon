import type {
  BusinessProfile,
  DocumentType,
  FundingTrack,
  GeneratedDocument,
} from '../types'

export const formatCurrency = (value: number) =>
  new Intl.NumberFormat('en-CA', {
    style: 'currency',
    currency: 'CAD',
    maximumFractionDigits: 0,
  }).format(value)

const formatPercent = (value: number) => `${Math.round(value)}%`

export function calculateApprovalReadiness(profile: BusinessProfile) {
  const revenueFactor = Math.min(profile.monthlyRevenue / 20000, 1) * 28
  const marginFactor = Math.min(profile.grossMargin / 70, 1) * 26
  const teamFactor = Math.min(profile.teamSize / 8, 1) * 14
  const focusFactor = profile.differentiation.trim().length > 60 ? 20 : 12

  return Math.round(32 + revenueFactor + marginFactor + teamFactor + focusFactor)
}

export function buildDocument(
  profile: BusinessProfile,
  track: FundingTrack,
  documentType: DocumentType,
): GeneratedDocument {
  const annualRevenue = profile.monthlyRevenue * 12
  const monthlyGrossProfit = profile.monthlyRevenue * (profile.grossMargin / 100)
  const runwayMonths = Math.max(
    6,
    Math.round(profile.fundingNeed / Math.max(monthlyGrossProfit * 0.45, 1)),
  )
  const hiringBudget = Math.round(profile.fundingNeed * 0.22)
  const marketingBudget = Math.round(profile.fundingNeed * 0.18)
  const readinessScore = Math.min(
    96,
    Math.max(
      68,
      Math.round(
        54 +
          profile.grossMargin * 0.3 +
          Math.min(profile.teamSize, 10) * 2 +
          Math.min(profile.monthlyRevenue / 1000, 25),
      ),
    ),
  )

  const titleMap = {
    plan: `${profile.companyName} Business Plan`,
    forecast: `${profile.companyName} Cash Flow Forecast`,
    memo: `${profile.companyName} Funding Memo`,
  }

  const summaryMap = {
    plan: `${profile.companyName} is seeking ${formatCurrency(profile.fundingNeed)} through the ${track.label.toLowerCase()} pathway to scale ${profile.businessModel.toLowerCase()} in ${profile.location}. The plan positions ${profile.founderName}'s team as execution-ready, margin-aware, and aligned with reviewer expectations around ${track.reviewFocus[0].toLowerCase()} and ${track.reviewFocus[1].toLowerCase()}.`,
    forecast: `${profile.companyName} can translate ${formatCurrency(profile.monthlyRevenue)} in current monthly revenue into a disciplined 12-month growth model. This forecast ties the requested ${formatCurrency(profile.fundingNeed)} to inventory, hiring, and customer acquisition assumptions with a projected runway of ${runwayMonths} months.`,
    memo: `${profile.companyName} is a ${profile.stage.toLowerCase()} ${profile.industry.toLowerCase()} business applying for ${formatCurrency(profile.fundingNeed)}. The memo concentrates on why the business is fundable now: real demand, a strong gross margin profile, and a tightly scoped use-of-funds plan.`,
  }

  const sectionsMap = {
    plan: [
      {
        title: 'Executive Summary',
        body: `${profile.companyName} helps customers through ${profile.businessModel.toLowerCase()}. With ${formatCurrency(annualRevenue)} in annualized revenue and a ${formatPercent(profile.grossMargin)} gross margin, the business is seeking capital to move from ${profile.stage.toLowerCase()} to structured scale.`,
      },
      {
        title: 'Problem, Market, and Offer',
        body: `${profile.differentiation} The offer is anchored in the ${profile.industry.toLowerCase()} market and designed to convert repeat demand into predictable revenue.`,
      },
      {
        title: 'Go-to-Market Strategy',
        body: `The next growth phase prioritizes channel partnerships, referral loops, and conversion optimization in ${profile.location}. Reviewer emphasis should stay on measurable acquisition efficiency and customer retention rather than abstract brand claims.`,
      },
      {
        title: 'Operations and Team',
        body: `${profile.founderName} leads a team of ${profile.teamSize} with a focus on process reliability, service delivery, and disciplined cost control. Funding supports the systems needed to absorb new demand without margin erosion.`,
      },
    ],
    forecast: [
      {
        title: 'Revenue Assumptions',
        body: `Base revenue starts at ${formatCurrency(profile.monthlyRevenue)} per month with expansion driven by account growth, recurring sales, and pricing discipline. The model assumes steady improvements instead of aggressive hockey-stick jumps.`,
      },
      {
        title: 'Cost Structure',
        body: `Gross margin is modeled at ${formatPercent(profile.grossMargin)}. Use of funds is weighted toward inventory, fulfillment capacity, and targeted growth spend, preserving room for repayment or milestone completion.`,
      },
      {
        title: 'Liquidity Outlook',
        body: `The requested ${formatCurrency(profile.fundingNeed)} extends operating runway to approximately ${runwayMonths} months while allowing the company to absorb onboarding, sales cycle, and implementation delays.`,
      },
      {
        title: 'Sensitivity Notes',
        body: `Decision-makers should see a downside case with slower customer conversion, plus a recovery plan built around margin protection, hiring pacing, and spend controls.`,
      },
    ],
    memo: [
      {
        title: 'Why This Business, Why Now',
        body: `${profile.companyName} already has proof of demand and a practical route to expansion. The business is not seeking speculative capital; it is seeking fuel for a validated operating model.`,
      },
      {
        title: 'Use of Funds',
        body: `${formatCurrency(hiringBudget)} is allocated to hiring and delivery capacity, ${formatCurrency(marketingBudget)} to acquisition and partnerships, and the balance to working capital, tooling, and execution buffer.`,
      },
      {
        title: 'Reviewer Confidence Points',
        body: `The strongest confidence signals are current revenue, healthy gross margin, and a founder story grounded in operational realism. This aligns well with ${track.reviewFocus.join(', ').toLowerCase()}.`,
      },
      {
        title: 'Requested Outcome',
        body: `Approve ${formatCurrency(profile.fundingNeed)} so ${profile.companyName} can formalize growth, improve forecasting confidence, and hit funding-linked milestones within the next two operating quarters.`,
      },
    ],
  }

  return {
    title: titleMap[documentType.id],
    readinessScore,
    summary: summaryMap[documentType.id],
    sections: sectionsMap[documentType.id],
    metrics: [
      { label: 'Funding Request', value: formatCurrency(profile.fundingNeed) },
      { label: 'Monthly Revenue', value: formatCurrency(profile.monthlyRevenue) },
      { label: 'Gross Margin', value: formatPercent(profile.grossMargin) },
      { label: 'Projected Runway', value: `${runwayMonths} months` },
    ],
    milestones: [
      `Month 1-2: finalize the funding package for the ${track.label.toLowerCase()} stream`,
      `Month 2-4: deploy ${formatCurrency(marketingBudget)} into channel tests and acquisition`,
      `Month 3-6: add delivery capacity and support ${profile.teamSize + 1} to ${
        profile.teamSize + 2
      } core operators`,
      `Month 6-12: convert execution data into the next lending or grant renewal narrative`,
    ],
  }
}
