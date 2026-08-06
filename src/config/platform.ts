import {
  defaultFundingDataSources,
  type FundingDataSource,
} from '../data/fundingSources'
import type { SupportedLocale } from '../i18n'
import { platformConfigStorageKey as sharedPlatformConfigStorageKey } from '../lib/environmentMode'

export type PlatformModuleId =
  | 'discovery'
  | 'quick-build'
  | 'my-companies'
  | 'funding-shortlist'
  | 'my-applications'
  | 'grants-loans'
  | 'templates'
  | 'social-resources'
  | 'tools'
  | 'partner-portal'

export type PaymentConfig = {
  enabled: boolean
  provider: 'stripe' | 'waffo-pancake' | 'manual'
  currency: 'CAD' | 'USD'
  testMode: boolean
  webhookUrl: string
  testSecretKeyReference: string
  liveSecretKeyReference: string
  testPublishableKeyReference: string
  livePublishableKeyReference: string
  webhookSecretReference: string
  checkoutSuccessUrl: string
  checkoutCancelUrl: string
  billingPortalReturnUrl: string
  priceCatalog: PaymentCatalogItem[]
}

export type ContentFormat = 'markdown' | 'html'

export type PaymentCatalogItem = {
  id: string
  name: string
  description: string
  descriptionFormat: ContentFormat
  offeringType: 'product' | 'service'
  billingType: 'one-time' | 'monthly' | 'annual'
  amount: string
  currency: 'CAD' | 'USD'
  provider: 'stripe' | 'waffo-pancake'
  externalProductId: string
  externalPriceId: string
  active: boolean
  isDefault: boolean
}

export type AIConfig = {
  provider: string
  defaultModel: string
  providers: AIProviderConfig[]
  models: AIModelConfig[]
  apiBaseUrl: string
  apiKeyReference: string
  temperature: string
  mockModeEnabled: boolean
}

export type AIProviderConfig = {
  id: string
  name: string
}

export type AIModelConfig = {
  id: string
  name: string
  providerId: string
  context: string
  description: string
  apiKey: string
  url: string
  contentType: string
  authorization: string
  bodyType: string
  bodyParameters: string
  connectionStatus: 'untested' | 'connected' | 'failed'
  connectionError: string
  lastTestedAt: string
  enabled: boolean
}

export type AdvisoryHubSectionId =
  | 'cover-page'
  | 'executive-summary'
  | 'business-overview'
  | 'sales-and-marketing'
  | 'operating-plan'
  | 'people'
  | 'action-plan'
  | 'technology-cover-page'
  | 'technology-executive-summary'
  | 'business-technology-overview'
  | 'technology-assessment'
  | 'gap-opportunity-analysis'
  | 'technology-roadmap'
  | 'technology-ai-review'
  | 'financial-model'
  | 'funding-narrative'
  | 'ai-review'
  | 'company-overview'
  | 'market-analysis'
  | `custom-section-${string}`

export type AdvisoryHubAgentConfig = {
  id: string
  name: string
  role: string
  prompt: string
}

export type AdvisoryHubDocumentTypeConfig = {
  id: string
  name: string
  prompt: string
}

export type AdvisoryHubSectionLayout = 'cover-page' | 'main-content'

export type AdvisoryHubLayoutConfig = {
  id: AdvisoryHubSectionLayout
  name: string
  description: string
  css: string
}

export type AdvisoryHubSectionConfig = {
  id: AdvisoryHubSectionId
  title: string
  documentTypeId: string
  prompt: string
  agentId: string
  layout: AdvisoryHubSectionLayout
  enabled: boolean
}

export type AdvisoryHubConfig = {
  agents: AdvisoryHubAgentConfig[]
  documentTypes: AdvisoryHubDocumentTypeConfig[]
  layouts: AdvisoryHubLayoutConfig[]
  sections: AdvisoryHubSectionConfig[]
}

export type LegalDocumentFormat = ContentFormat

export type LegalDocumentConfig = {
  format: LegalDocumentFormat
  content: string
}

export type LandingHeaderNavItemConfig = {
  id: string
  label: string
  href: string
}

export type LandingHeaderConfig = {
  navItems: LandingHeaderNavItemConfig[]
  signInLabel: string
  dashboardLabel: string
}

export type LandingProofItemConfig = {
  value: string
  label: string
}

export type LandingFooterNavItemConfig = {
  id: string
  label: string
  href: string
}

export type LandingFooterLegalLinkConfig = {
  label: string
  href: string
}

export type LandingContentConfig = {
  heroEyebrow: string
  headline: string
  subheadline: string
  primaryCtaLabel: string
  secondaryCtaLabel: string
  featuresEyebrow: string
  featuresHeading: string
  featuresBody: string
  workflowEyebrow: string
  workflowHeading: string
  openSourceEyebrow: string
  openSourceHeading: string
  openSourceBody: string
  adminCtaLabel: string
  proofItems: LandingProofItemConfig[]
}

export type LandingFooterConfig = {
  description: string
  sitemapLabel: string
  sitemapItems: LandingFooterNavItemConfig[]
  platformLabel: string
  platformItems: LandingFooterNavItemConfig[]
  privacyPolicy: LandingFooterLegalLinkConfig
  termsOfService: LandingFooterLegalLinkConfig
}

export type LandingPageConfig = {
  header: LandingHeaderConfig
  content: LandingContentConfig
  footer: LandingFooterConfig
}

export type NotificationBarConfig = {
  enabled: boolean
  audience: 'all' | 'admin'
  message: string
  actionLabel: string
  actionUrl: string
  dismissible: boolean
}

export type EnvironmentMode = 'test' | 'live'

export type PlatformConfig = {
  platformName: string
  platformLogo: string
  supportEmail: string
  language: SupportedLocale
  environmentMode: EnvironmentMode
  primaryColor: string
  sidebarColor: string
  notificationBar: NotificationBarConfig
  landingPage: LandingPageConfig
  commercialLicenseUrl: string
  commercialLicensePrice: string
  openBconAttributionVisible: boolean
  privacyPolicy: LegalDocumentConfig
  termsOfService: LegalDocumentConfig
  payments: PaymentConfig
  ai: AIConfig
  advisoryHub: AdvisoryHubConfig
  dataSources: FundingDataSource[]
  modules: Record<PlatformModuleId, boolean>
}

export const secureConfigValuePlaceholder = '__stored_securely__'

export const commercialLicenseDefaults = {
  price: 'Contact sales',
  url: 'mailto:chenadm73@gmail.com',
} as const

export const defaultNotificationBar: NotificationBarConfig = {
  enabled: false,
  audience: 'all',
  message: 'Your workspace has an important update.',
  actionLabel: 'Learn more',
  actionUrl: '',
  dismissible: true,
}

function normalizePlatformLanguage(value: unknown): SupportedLocale {
  return value === 'fr-CA' || value === 'zh-CN' ? value : 'en-CA'
}

function isEnvironmentReference(value: string) {
  return /^[A-Z][A-Z0-9_]*$/u.test(value.trim())
}

function sanitizeSecretLikeValue(value: string) {
  const trimmed = value.trim()

  if (!trimmed) return ''
  if (trimmed === secureConfigValuePlaceholder) return trimmed
  if (isEnvironmentReference(trimmed)) return trimmed

  return secureConfigValuePlaceholder
}

export function sanitizePlatformConfigForPersistence(config: PlatformConfig) {
  return {
    ...config,
    commercialLicensePrice: commercialLicenseDefaults.price,
    commercialLicenseUrl: commercialLicenseDefaults.url,
    ai: {
      ...config.ai,
      models: config.ai.models.map((model) => ({
        ...model,
        apiKey: '',
        authorization: model.authorization.includes('{{apiKey}}')
          ? model.authorization
          : '',
      })),
    },
    payments: {
      ...config.payments,
      testSecretKeyReference: sanitizeSecretLikeValue(
        config.payments.testSecretKeyReference,
      ),
      liveSecretKeyReference: sanitizeSecretLikeValue(
        config.payments.liveSecretKeyReference,
      ),
      testPublishableKeyReference: sanitizeSecretLikeValue(
        config.payments.testPublishableKeyReference,
      ),
      livePublishableKeyReference: sanitizeSecretLikeValue(
        config.payments.livePublishableKeyReference,
      ),
      webhookSecretReference: sanitizeSecretLikeValue(
        config.payments.webhookSecretReference,
      ),
    },
  } satisfies PlatformConfig
}

const defaultPrivacyPolicyContent = `# Privacy Policy

Last updated: July 30, 2026

This workspace is operated by **T.T.E** and may include OpenBcon-powered software components.

## What we collect

- account and workspace profile information
- company, funding, and application records entered by users
- operational usage data required to run and secure the service

## How we use information

- to provide workspace functionality
- to support funding workflow automation
- to maintain reliability, security, and audit history

## Your responsibilities

Do not upload confidential third-party data unless you have permission to do so and a lawful basis for processing it.

## Contact

For privacy questions, contact **chenadm73@gmail.com**.`

const defaultTermsOfServiceContent = `# Terms of Service

Last updated: July 30, 2026

These Terms govern access to this workspace and related OpenBcon-powered services operated by **T.T.E**.

## Acceptable use

- use the platform only for lawful business and funding workflow purposes
- do not attempt to disrupt, reverse engineer, or abuse the service
- ensure that submitted content does not violate third-party rights

## Open-source and commercial licensing

This project includes an AGPL community edition and may also be offered under a separate commercial license.

## Service availability

The platform may change, improve, or remove features over time. Demo and preview environments may be reset without notice.

## Contact

Questions about these terms can be sent to **chenadm73@gmail.com**.`

const defaultLandingProofItems: LandingProofItemConfig[] = [
  { value: '75+', label: 'funding programs tracked' },
  { value: '96%', label: 'document readiness' },
  { value: '30 sec', label: 'first draft generation' },
]

const defaultLandingHeaderNavItems: LandingHeaderNavItemConfig[] = [
  { id: 'home', label: 'Homepage', href: '#' },
  { id: 'features', label: 'Features', href: '#features' },
  { id: 'workflow', label: 'How it works', href: '#workflow' },
  { id: 'pricing', label: 'Pricing', href: '#pricing' },
  { id: 'open-source', label: 'Open source', href: '#opensource' },
]

const defaultLandingFooterPlatformItems: LandingFooterNavItemConfig[] = [
  { id: 'sign-in', label: 'Sign in', href: '/login' },
  { id: 'dashboard', label: 'Go to dashboard', href: '/dashboard' },
]

function createDefaultFreePaymentCatalogItem(): PaymentCatalogItem {
  return {
    id: 'free-offer',
    name: 'Free',
    description: 'Default free workspace option.',
    descriptionFormat: 'html',
    offeringType: 'service',
    billingType: 'monthly',
    amount: '0',
    currency: 'CAD',
    provider: 'stripe',
    externalProductId: '',
    externalPriceId: '',
    active: true,
    isDefault: true,
  }
}

function ensureDefaultPriceCatalog(
  items: PaymentCatalogItem[],
): PaymentCatalogItem[] {
  const normalizedItems = items.map((item) => ({
    ...item,
    descriptionFormat: (item.descriptionFormat === 'markdown'
      ? 'markdown'
      : 'html') as ContentFormat,
    isDefault: !!item.isDefault,
  }))
  const freeIndex = normalizedItems.findIndex(
    (item) => item.id === 'free-offer' || item.name.trim().toLowerCase() === 'free',
  )

  if (freeIndex === -1) {
    normalizedItems.push(createDefaultFreePaymentCatalogItem())
  } else if (!normalizedItems.some((item) => item.isDefault)) {
    normalizedItems[freeIndex] = {
      ...normalizedItems[freeIndex],
      amount: normalizedItems[freeIndex].amount.trim() || '0',
      isDefault: true,
    }
  }

  return normalizedItems
}

const defaultPaymentCatalog: PaymentCatalogItem[] = ensureDefaultPriceCatalog([
  {
    id: 'partner-pro-monthly',
    name: 'Partner Pro Monthly',
    description: 'Recurring monthly workspace subscription for active partners.',
    descriptionFormat: 'html',
    offeringType: 'service',
    billingType: 'monthly',
    amount: '79',
    currency: 'CAD',
    provider: 'stripe',
    externalProductId: 'prod_partner_pro_monthly',
    externalPriceId: 'price_partner_pro_monthly',
    active: true,
    isDefault: false,
  },
  {
    id: 'partner-pro-annual',
    name: 'Partner Pro Annual',
    description: 'Annual subscription plan with lower effective monthly pricing.',
    descriptionFormat: 'html',
    offeringType: 'service',
    billingType: 'annual',
    amount: '790',
    currency: 'CAD',
    provider: 'stripe',
    externalProductId: 'prod_partner_pro_annual',
    externalPriceId: 'price_partner_pro_annual',
    active: true,
    isDefault: false,
  },
  {
    id: 'onboarding-setup',
    name: 'Onboarding Setup',
    description: 'One-time implementation and onboarding support package.',
    descriptionFormat: 'html',
    offeringType: 'service',
    billingType: 'one-time',
    amount: '2500',
    currency: 'CAD',
    provider: 'waffo-pancake',
    externalProductId: 'waffo_onboarding_setup',
    externalPriceId: 'waffo_onboarding_setup_once',
    active: true,
    isDefault: false,
  },
])

const defaultAdvisoryHubLayouts: AdvisoryHubLayoutConfig[] = [
  {
    id: 'cover-page',
    name: 'Cover page',
    description: 'A structured, centered opening page for the report.',
    css: 'min-height: 520px; display: grid; place-items: center; padding: 54px; background: linear-gradient(145deg, #ffffff 0%, #f4f7ff 100%);',
  },
  {
    id: 'main-content',
    name: 'Main content',
    description: 'The standard document page for analysis content.',
    css: 'display: grid; align-content: start; gap: 18px; padding: 36px 42px; background: #ffffff;',
  },
]

const defaultAdvisoryHubSections: AdvisoryHubSectionConfig[] = [
  {
    id: 'cover-page',
    title: 'Cover Page',
    documentTypeId: 'business-analysis',
    prompt: 'Create a clear cover page with the business, opportunity, funding request, and report date.',
    agentId: 'grant-writer',
    layout: 'cover-page',
    enabled: true,
  },
  {
    id: 'executive-summary',
    title: 'Executive Summary',
    documentTypeId: 'business-analysis',
    prompt: 'Summarize the opportunity, business, funding ask, and reviewer case clearly.',
    agentId: 'grant-writer',
    layout: 'main-content',
    enabled: true,
  },
  {
    id: 'business-overview',
    title: 'Business Overview',
    documentTypeId: 'business-analysis',
    prompt: 'Explain the company, operating model, team, and execution capability.',
    agentId: 'business-consultant',
    layout: 'main-content',
    enabled: true,
  },
  {
    id: 'sales-and-marketing',
    title: 'Sales & Marketing',
    documentTypeId: 'business-analysis',
    prompt: 'Describe the sales channels, marketing approach, customer acquisition plan, pipeline, and measurable growth targets.',
    agentId: 'business-consultant',
    layout: 'main-content',
    enabled: true,
  },
  {
    id: 'operating-plan',
    title: 'Operating Plan',
    documentTypeId: 'business-analysis',
    prompt: 'Explain how the business will deliver its product or service, scale operations, and execute the funding plan.',
    agentId: 'business-consultant',
    layout: 'main-content',
    enabled: true,
  },
  {
    id: 'people',
    title: 'People',
    documentTypeId: 'business-analysis',
    prompt: 'Describe the leadership team, relevant experience, responsibilities, hiring needs, and execution capability.',
    agentId: 'business-consultant',
    layout: 'main-content',
    enabled: true,
  },
  {
    id: 'action-plan',
    title: 'Action Plan',
    documentTypeId: 'business-analysis',
    prompt: 'Translate the strategy into sequenced actions, milestones, owners, timing, and measurable outcomes.',
    agentId: 'business-consultant',
    layout: 'main-content',
    enabled: true,
  },
  {
    id: 'technology-cover-page',
    title: 'Cover Page',
    documentTypeId: 'technical-analysis',
    prompt: 'Create a clear technology analysis cover page with the business, technology context, opportunity, and report date.',
    agentId: 'program-analyst',
    layout: 'cover-page',
    enabled: true,
  },
  {
    id: 'technology-executive-summary',
    title: 'Executive Summary',
    documentTypeId: 'technical-analysis',
    prompt: 'Summarize the current technology position, the most important findings, and the recommended technology direction.',
    agentId: 'program-analyst',
    layout: 'main-content',
    enabled: true,
  },
  {
    id: 'business-technology-overview',
    title: 'Business & Technology Overview',
    documentTypeId: 'technical-analysis',
    prompt: 'Connect the business model, operating priorities, technology environment, digital capabilities, and delivery needs.',
    agentId: 'business-consultant',
    layout: 'main-content',
    enabled: true,
  },
  {
    id: 'technology-assessment',
    title: 'Technology Assessment',
    documentTypeId: 'technical-analysis',
    prompt: 'Assess the current systems, architecture, data, security, integrations, digital tools, and technology readiness.',
    agentId: 'program-analyst',
    layout: 'main-content',
    enabled: true,
  },
  {
    id: 'gap-opportunity-analysis',
    title: 'Gap & Opportunity Analysis',
    documentTypeId: 'technical-analysis',
    prompt: 'Identify technology gaps, risks, opportunities, dependencies, and the business impact of closing each gap.',
    agentId: 'program-analyst',
    layout: 'main-content',
    enabled: true,
  },
  {
    id: 'technology-roadmap',
    title: 'Technology Roadmap',
    documentTypeId: 'technical-analysis',
    prompt: 'Define a sequenced technology roadmap with initiatives, milestones, owners, investment needs, and measurable outcomes.',
    agentId: 'business-consultant',
    layout: 'main-content',
    enabled: true,
  },
  {
    id: 'technology-ai-review',
    title: 'AI Review & Improve',
    documentTypeId: 'technical-analysis',
    prompt: 'Review the technology analysis for clarity, feasibility, security, evidence, implementation risk, and reviewer confidence.',
    agentId: 'reviewer',
    layout: 'main-content',
    enabled: true,
  },
  {
    id: 'financial-model',
    title: 'Financial Model',
    documentTypeId: 'financial-model',
    prompt: 'Build a credible forecast, use-of-funds logic, runway, and measurable financial assumptions.',
    agentId: 'financial-analyst',
    layout: 'main-content',
    enabled: true,
  },
  {
    id: 'funding-narrative',
    title: 'Funding Narrative',
    documentTypeId: 'business-analysis',
    prompt: 'Turn the evidence into a focused funding narrative with milestones and reviewer-ready outcomes.',
    agentId: 'grant-writer',
    layout: 'main-content',
    enabled: true,
  },
  {
    id: 'ai-review',
    title: 'AI Review & Improve',
    documentTypeId: 'business-analysis',
    prompt: 'Review the package for clarity, evidence, compliance, measurable outcomes, and approval confidence.',
    agentId: 'reviewer',
    layout: 'main-content',
    enabled: true,
  },
]

const defaultAdvisoryHubDocumentTypes: AdvisoryHubDocumentTypeConfig[] = [
  {
    id: 'business-analysis',
    name: 'Business Analysis',
    prompt:
      'Develop a clear, evidence-based business analysis covering the company, operating model, market position, and execution plan.',
  },
  {
    id: 'technical-analysis',
    name: 'Technical Analysis',
    prompt:
      'Assess the technology, digital capability, systems, implementation requirements, and operational risks connected to the opportunity.',
  },
  {
    id: 'financial-model',
    name: 'Financial Model',
    prompt:
      'Build a credible monthly financial forecast with transparent assumptions, revenue drivers, expenses, runway, and use-of-funds logic.',
  },
]

const legacyAdvisoryHubDocumentTypeIdMap: Record<string, string> = {
  'business-plan': 'business-analysis',
  'business plan': 'business-analysis',
  'cash-flow-forecast': 'financial-model',
  'cash flow forecast': 'financial-model',
  'funding-narrative': 'business-analysis',
  'funding narrative': 'business-analysis',
  'ai-review': 'business-analysis',
  'ai review': 'business-analysis',
  'technology-analysis': 'technical-analysis',
  'technology analysis': 'technical-analysis',
  'technical-analysis': 'technical-analysis',
  'technical analysis': 'technical-analysis',
  'financial-model': 'financial-model',
  'financial model': 'financial-model',
}

function resolveAdvisoryHubDocumentTypeId(value: string | undefined) {
  const normalized = value?.trim().toLowerCase() || ''
  return legacyAdvisoryHubDocumentTypeIdMap[normalized] || value?.trim() || ''
}

const legacyAdvisoryHubSectionIdMap: Record<string, AdvisoryHubSectionId> = {
  'company-overview': 'business-overview',
  'market-analysis': 'sales-and-marketing',
}

function resolveAdvisoryHubSectionId(
  rawId: string,
  documentTypeId: string | undefined,
  title: string | undefined,
): AdvisoryHubSectionId | undefined {
  const normalizedTitle = title?.trim().toLowerCase() || ''
  const resolvedDocumentTypeId = resolveAdvisoryHubDocumentTypeId(documentTypeId)

  if (rawId.startsWith('custom-section-') && normalizedTitle === 'cover page') {
    return resolvedDocumentTypeId === 'technical-analysis'
      ? 'technology-cover-page'
      : resolvedDocumentTypeId === 'business-analysis'
        ? 'cover-page'
        : undefined
  }

  return legacyAdvisoryHubSectionIdMap[rawId]
}

const legacyAdvisoryHubSectionDefaults: Record<
  string,
  { title: string; prompt: string }
> = {
  'executive-summary': {
    title: 'Executive Summary',
    prompt: 'Summarize the opportunity, business, funding ask, and reviewer case clearly.',
  },
  'company-overview': {
    title: 'Company Overview',
    prompt: 'Explain the company, operating model, team, and execution capability.',
  },
  'market-analysis': {
    title: 'Market Analysis',
    prompt: 'Describe the market, customers, competition, traction, and growth opportunity.',
  },
  'financial-model': {
    title: 'Financial Model',
    prompt: 'Build a credible forecast, use-of-funds logic, runway, and measurable financial assumptions.',
  },
  'funding-narrative': {
    title: 'Funding Narrative',
    prompt: 'Turn the evidence into a focused funding narrative with milestones and reviewer-ready outcomes.',
  },
  'ai-review': {
    title: 'AI Review & Improve',
    prompt: 'Review the package for clarity, evidence, compliance, measurable outcomes, and approval confidence.',
  },
}

const legacyAdvisoryHubDefaultSectionIds = new Set(Object.keys(legacyAdvisoryHubSectionDefaults))

const defaultAdvisoryHubAgents: AdvisoryHubAgentConfig[] = [
  {
    id: 'program-analyst',
    name: 'Program Analyst',
    role: 'Funding opportunity analyst',
    prompt:
      'Understand the funding opportunity and extract requirements, reviewer criteria, and evidence needs.',
  },
  {
    id: 'business-consultant',
    name: 'Business Consultant',
    role: 'Business strategy consultant',
    prompt:
      'Frame the company story, positioning, operating model, and execution case for the reviewer.',
  },
  {
    id: 'financial-analyst',
    name: 'Financial Analyst',
    role: 'Financial planning analyst',
    prompt:
      'Build the forecast logic, runway, financial assumptions, and measurable use-of-funds plan.',
  },
  {
    id: 'grant-writer',
    name: 'Grant Writer',
    role: 'Funding narrative writer',
    prompt:
      'Turn business evidence into clear, reviewer-ready narrative language with measurable outcomes.',
  },
  {
    id: 'reviewer',
    name: 'Reviewer',
    role: 'Quality and compliance reviewer',
    prompt:
      'Run a final review to strengthen clarity, evidence, measurable milestones, and approval confidence.',
  },
]

const defaultAIProviders: AIProviderConfig[] = [
  { id: 'openai', name: 'OpenAI' },
  { id: 'anthropic', name: 'Anthropic' },
  { id: 'google', name: 'Google' },
  { id: 'custom', name: 'OpenAI-compatible' },
]

const defaultAIModels: AIModelConfig[] = [
  {
    id: 'gpt-5-mini',
    name: 'gpt-5-mini',
    providerId: 'openai',
    context: '400K',
    description: 'Fast document drafting',
    apiKey: '',
    url: 'https://api.openai.com/v1/chat/completions',
    contentType: 'application/json',
    authorization: 'Bearer {{apiKey}}',
    bodyType: 'JSON',
    bodyParameters: '{}',
    connectionStatus: 'untested',
    connectionError: '',
    lastTestedAt: '',
    enabled: true,
  },
  {
    id: 'gpt-5.2',
    name: 'gpt-5.2',
    providerId: 'openai',
    context: '400K',
    description: 'Complex financial reasoning',
    apiKey: '',
    url: 'https://api.openai.com/v1/chat/completions',
    contentType: 'application/json',
    authorization: 'Bearer {{apiKey}}',
    bodyType: 'JSON',
    bodyParameters: '{}',
    connectionStatus: 'untested',
    connectionError: '',
    lastTestedAt: '',
    enabled: true,
  },
  {
    id: 'claude-sonnet-4-5',
    name: 'claude-sonnet-4-5',
    providerId: 'anthropic',
    context: '200K',
    description: 'Long-form narrative',
    apiKey: '',
    url: 'https://api.anthropic.com/v1/messages',
    contentType: 'application/json',
    authorization: 'x-api-key {{apiKey}}',
    bodyType: 'JSON',
    bodyParameters: '{}',
    connectionStatus: 'untested',
    connectionError: '',
    lastTestedAt: '',
    enabled: true,
  },
  {
    id: 'gemini-3-flash',
    name: 'gemini-3-flash',
    providerId: 'google',
    context: '1M',
    description: 'Large source packages',
    apiKey: '',
    url: 'https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash:generateContent',
    contentType: 'application/json',
    authorization: 'Bearer {{apiKey}}',
    bodyType: 'JSON',
    bodyParameters: '{}',
    connectionStatus: 'untested',
    connectionError: '',
    lastTestedAt: '',
    enabled: false,
  },
]

function normalizeAdvisoryHubAgents(
  agents: Partial<AdvisoryHubAgentConfig>[] | undefined,
): AdvisoryHubAgentConfig[] {
  if (!agents || agents.length === 0) {
    return defaultAdvisoryHubAgents.map((agent) => ({ ...agent }))
  }

  const normalized = agents
    .map((agent, index) => {
      const fallback = defaultAdvisoryHubAgents[index]
      const id = agent.id?.trim() || fallback?.id || `advisory-agent-${index + 1}`
      const name = agent.name?.trim() || fallback?.name || 'Advisory agent'
      return {
        id,
        name,
        role: agent.role?.trim() || fallback?.role || 'Funding workflow agent',
        prompt:
          agent.prompt?.trim() ||
          fallback?.prompt ||
          `Support the ${name.toLowerCase()} stage of the funding workflow.`,
      } satisfies AdvisoryHubAgentConfig
    })
    .filter((agent, index, all) => all.findIndex((item) => item.id === agent.id) === index)

  return normalized.length > 0
    ? normalized
    : defaultAdvisoryHubAgents.map((agent) => ({ ...agent }))
}

function normalizeAdvisoryHubDocumentTypes(
  documentTypes: Partial<AdvisoryHubDocumentTypeConfig>[] | undefined,
): AdvisoryHubDocumentTypeConfig[] {
  if (!documentTypes || documentTypes.length === 0) {
    return defaultAdvisoryHubDocumentTypes.map((documentType) => ({ ...documentType }))
  }

  const legacyDefaultIds = new Set([
    'business-plan',
    'cash-flow-forecast',
    'funding-narrative',
    'ai-review',
  ])
  const isLegacyDefaultSet =
    documentTypes.length === legacyDefaultIds.size &&
    documentTypes.every((documentType) => legacyDefaultIds.has(documentType.id?.trim() || ''))

  if (isLegacyDefaultSet) {
    return defaultAdvisoryHubDocumentTypes.map((documentType) => ({ ...documentType }))
  }

  const normalized = documentTypes
    .map((documentType, index) => {
      const rawId = documentType.id?.trim() || ''
      const id =
        resolveAdvisoryHubDocumentTypeId(rawId) ||
        defaultAdvisoryHubDocumentTypes[index]?.id ||
        `document-type-${index + 1}`
      const fallback = defaultAdvisoryHubDocumentTypes.find(
        (defaultType) => defaultType.id === id,
      )
      const wasLegacyId = Boolean(rawId && legacyAdvisoryHubDocumentTypeIdMap[rawId.toLowerCase()])

      return {
        id,
        name:
          (wasLegacyId ? fallback?.name : documentType.name?.trim()) ||
          fallback?.name ||
          'Document type',
        prompt:
          documentType.prompt?.trim() ||
          fallback?.prompt ||
          'Prepare this document type for reviewer-ready delivery.',
      }
    })
    .filter(
      (documentType, index, all) =>
        all.findIndex((item) => item.id === documentType.id) === index,
    )

  return normalized.length > 0
    ? normalized
    : defaultAdvisoryHubDocumentTypes.map((documentType) => ({ ...documentType }))
}

function normalizeAdvisoryHubLayouts(
  layouts: Partial<AdvisoryHubLayoutConfig>[] | undefined,
): AdvisoryHubLayoutConfig[] {
  return defaultAdvisoryHubLayouts.map((fallback) => {
    const saved = layouts?.find((layout) => layout.id === fallback.id)
    return {
      id: fallback.id,
      name: saved?.name?.trim() || fallback.name,
      description: saved?.description?.trim() || fallback.description,
      css: saved?.css?.trim() || fallback.css,
    }
  })
}

export function normalizeAdvisoryHubSections(
  sections:
    | (Partial<AdvisoryHubSectionConfig> & {
        agent?: string
        documentLabel?: string
      })[]
    | undefined,
  agents: AdvisoryHubAgentConfig[],
  documentTypes: AdvisoryHubDocumentTypeConfig[],
): AdvisoryHubSectionConfig[] {
  if (!sections || sections.length === 0) {
    return defaultAdvisoryHubSections.map((section) => ({ ...section }))
  }

  const isUntouchedLegacyDefaultSet =
    sections.length === legacyAdvisoryHubDefaultSectionIds.size &&
    sections.every((section) => {
      const rawId = section.id?.trim() || ''
      const legacyDefault = legacyAdvisoryHubSectionDefaults[rawId]
      return (
        Boolean(legacyDefault) &&
        (!section.title?.trim() || section.title.trim() === legacyDefault.title) &&
        (!section.prompt?.trim() || section.prompt.trim() === legacyDefault.prompt)
      )
    })

  if (isUntouchedLegacyDefaultSet) {
    return defaultAdvisoryHubSections.map((section) => {
      const previousSection = sections.find((candidate) => {
        const rawId = candidate.id?.trim() || ''
        return (legacyAdvisoryHubSectionIdMap[rawId] || rawId) === section.id
      })

      return {
        ...section,
        agentId: previousSection?.agentId?.trim() || section.agentId,
        documentTypeId:
          resolveAdvisoryHubDocumentTypeId(previousSection?.documentTypeId) ||
          section.documentTypeId,
        layout: normalizeAdvisoryHubSectionLayout(
          previousSection?.layout,
          section.id,
          section.title,
          section.layout,
        ),
        enabled: previousSection?.enabled ?? section.enabled,
      }
    })
  }

  const defaultsById = new Map(
    defaultAdvisoryHubSections.map((section) => [section.id, section]),
  )
  const normalized = sections
    .map((section, index) => {
      const rawRequestedId = section.id?.trim() || ''
      const requestedId =
        resolveAdvisoryHubSectionId(
          rawRequestedId,
          section.documentTypeId,
          section.title,
        ) ||
        (rawRequestedId as AdvisoryHubSectionId) ||
        undefined
      const fallback =
        (requestedId ? defaultsById.get(requestedId) : undefined) ??
        defaultAdvisoryHubSections[index] ??
        defaultAdvisoryHubSections[0]
      const legacyDefault = legacyAdvisoryHubSectionDefaults[rawRequestedId]
      const isUntouchedLegacyDefault =
        Boolean(legacyDefault) &&
        (!section.title?.trim() || section.title.trim() === legacyDefault.title) &&
        (!section.prompt?.trim() || section.prompt.trim() === legacyDefault.prompt)

      return {
        id: requestedId || fallback.id,
        title:
          isUntouchedLegacyDefault
            ? fallback.title
            : section.title?.trim() || fallback.title,
        documentTypeId:
          resolveAdvisoryHubDocumentTypeId(section.documentTypeId) ||
          documentTypes.find(
            (documentType) =>
              documentType.name === section.documentLabel ||
              resolveAdvisoryHubDocumentTypeId(section.documentLabel) === documentType.id,
          )?.id ||
          fallback.documentTypeId,
        prompt:
          isUntouchedLegacyDefault
            ? fallback.prompt
            : section.prompt?.trim() || fallback.prompt,
        agentId:
          section.agentId?.trim() ||
          agents.find(
            (agent) => agent.id === section.agent || agent.name === section.agent,
          )?.id ||
          fallback.agentId,
        layout: normalizeAdvisoryHubSectionLayout(
          section.layout,
          requestedId || fallback.id,
          section.title || fallback.title,
          fallback.layout,
        ),
        enabled: section.enabled ?? fallback.enabled,
      } satisfies AdvisoryHubSectionConfig
    })
    .filter((section): section is AdvisoryHubSectionConfig => section !== null)
    .filter(
      (section, index, all) =>
        all.findIndex((candidate) => candidate.id === section.id) === index,
    )

  if (!normalized.some((section) => section.enabled)) {
    normalized[0] = {
      ...normalized[0],
      enabled: true,
    }
  }

  return normalized
}

export const defaultPlatformConfig: PlatformConfig = {
  platformName: 'Bconomics.ai',
  platformLogo: '',
  supportEmail: 'chenadm73@gmail.com',
  language: 'en-CA',
  environmentMode: 'test',
  primaryColor: '#6257f2',
  sidebarColor: '#121c31',
  notificationBar: defaultNotificationBar,
  landingPage: {
    header: {
      navItems: defaultLandingHeaderNavItems,
      signInLabel: 'Sign in',
      dashboardLabel: 'Go to dashboard',
    },
    content: {
      heroEyebrow: 'Funding infrastructure for ambitious businesses',
      headline: 'Turn business information into funding-ready documents.',
      subheadline:
        'Discover programs, organize applications, and generate lender-ready plans from one configurable workspace.',
      primaryCtaLabel: 'Explore the live workspace',
      secondaryCtaLabel: 'Create a founder account',
      featuresEyebrow: 'One connected platform',
      featuresHeading:
        'From “where do I start?” to a submission-ready package.',
      featuresBody:
        'Bconomics keeps program discovery, business context, financial readiness, and document generation in one accountable workspace.',
      workflowEyebrow: 'Guided from day one',
      workflowHeading:
        'Funding work without fragmented documents or guesswork.',
      openSourceEyebrow: 'Open core. Commercially sustainable.',
      openSourceHeading:
        'Own the platform. Extend the workflow. Choose your license.',
      openSourceBody:
        'Run the AGPL community edition, contribute on GitHub, or purchase a commercial license for proprietary deployments and OEM distribution.',
      adminCtaLabel: 'Request admin access',
      proofItems: defaultLandingProofItems,
    },
    footer: {
      description:
        'Open funding infrastructure for the next generation of businesses.',
      sitemapLabel: 'Sitemap',
      sitemapItems: defaultLandingHeaderNavItems,
      platformLabel: 'Platform',
      platformItems: defaultLandingFooterPlatformItems,
      privacyPolicy: {
        label: 'Privacy Policy',
        href: '/privacy-policy',
      },
      termsOfService: {
        label: 'Terms of Service',
        href: '/terms-of-service',
      },
    },
  },
  commercialLicenseUrl: commercialLicenseDefaults.url,
  commercialLicensePrice: commercialLicenseDefaults.price,
  openBconAttributionVisible: true,
  privacyPolicy: {
    format: 'markdown',
    content: defaultPrivacyPolicyContent,
  },
  termsOfService: {
    format: 'markdown',
    content: defaultTermsOfServiceContent,
  },
  payments: {
    enabled: false,
    provider: 'stripe',
    currency: 'CAD',
    testMode: true,
    webhookUrl: '/api/webhooks/stripe',
    testSecretKeyReference: 'STRIPE_TEST_SECRET_KEY',
    liveSecretKeyReference: 'STRIPE_LIVE_SECRET_KEY',
    testPublishableKeyReference: 'STRIPE_DEV_PUBLISHABLE_KEY',
    livePublishableKeyReference: 'STRIPE_LIVE_PUBLISHABLE_KEY',
    webhookSecretReference: 'STRIPE_WEBHOOK_SECRET',
    checkoutSuccessUrl: '',
    checkoutCancelUrl: '',
    billingPortalReturnUrl: '',
    priceCatalog: defaultPaymentCatalog,
  },
  ai: {
    provider: 'openai',
    defaultModel: 'gpt-5-mini',
    providers: defaultAIProviders,
    models: defaultAIModels,
    apiBaseUrl: '/api/ai',
    apiKeyReference: 'OPENAI_API_KEY',
    temperature: '0.3',
    mockModeEnabled: true,
  },
  advisoryHub: {
    agents: defaultAdvisoryHubAgents,
    documentTypes: defaultAdvisoryHubDocumentTypes,
    layouts: defaultAdvisoryHubLayouts,
    sections: defaultAdvisoryHubSections,
  },
  dataSources: defaultFundingDataSources,
  modules: {
    discovery: true,
    'quick-build': true,
    'my-companies': true,
    'funding-shortlist': true,
    'my-applications': true,
    'grants-loans': true,
    templates: true,
    'social-resources': true,
    tools: true,
    'partner-portal': true,
  },
}

export const platformConfigStorageKey = sharedPlatformConfigStorageKey

type LegacyPlatformConfig = Partial<PlatformConfig> & {
  platformName?: string
  platformLogo?: string
  landingHeadline?: string
  landingSubheadline?: string
  productName?: string
  productSuffix?: string
}

type LegacyNotificationBarConfig = Partial<NotificationBarConfig>

type LegacyLandingHeaderConfig = Partial<LandingHeaderConfig> & {
  homeLabel?: string
  featuresLabel?: string
  workflowLabel?: string
  openSourceLabel?: string
}

type LegacyLandingFooterConfig = Partial<LandingFooterConfig> & {
  privacyLabel?: string
  termsLabel?: string
}

type LegacyPaymentConfig = Partial<PaymentConfig> & {
  secretKeyReference?: string
}

type LegacyAIConfig = Partial<AIConfig> & {
  enabledModels?: string[]
}

type LegacyAdvisoryHubConfig = Partial<AdvisoryHubConfig> & {
  agents?: Partial<AdvisoryHubAgentConfig>[]
  documentTypes?: Partial<AdvisoryHubDocumentTypeConfig>[]
  sections?: (Partial<AdvisoryHubSectionConfig> & {
    agent?: string
    documentLabel?: string
  })[]
}

function normalizeAdvisoryHubSectionLayout(
  value: unknown,
  sectionId: string | undefined,
  title: string | undefined,
  fallback: AdvisoryHubSectionLayout = 'main-content',
): AdvisoryHubSectionLayout {
  if (value === 'cover-page' || value === 'main-content') return value
  if (
    /(?:^|-)cover-page$/iu.test(sectionId?.trim() || '') ||
    /^cover page$/iu.test(title?.trim() || '')
  ) {
    return 'cover-page'
  }
  return fallback
}

function normalizeAIProviders(
  providers: Partial<AIProviderConfig>[] | undefined,
): AIProviderConfig[] {
  if (!providers || providers.length === 0) {
    return defaultAIProviders.map((provider) => ({ ...provider }))
  }

  const normalized = providers
    .map((provider, index) => ({
      id:
        provider.id?.trim() ||
        defaultAIProviders[index]?.id ||
        `ai-provider-${index + 1}`,
      name:
        provider.name?.trim() ||
        defaultAIProviders[index]?.name ||
        'AI provider',
    }))
    .filter(
      (provider, index, all) =>
        all.findIndex((item) => item.id === provider.id) === index,
    )

  return normalized.length > 0
    ? normalized
    : defaultAIProviders.map((provider) => ({ ...provider }))
}

function normalizeAIModels(
  models: Partial<AIModelConfig>[] | undefined,
  providers: AIProviderConfig[],
  legacyEnabledModels: string[] | undefined,
): AIModelConfig[] {
  const sourceModels = models?.length ? models : defaultAIModels
  const providerIds = new Set(providers.map((provider) => provider.id))

  const normalized = sourceModels
    .map((model, index) => {
      const fallback =
        defaultAIModels.find((defaultModel) => defaultModel.id === model.id) ??
        defaultAIModels[index]
      const id =
        model.id?.trim() || fallback?.id || `ai-model-${index + 1}`
      const providerId = providerIds.has(model.providerId ?? '')
        ? model.providerId!
        : fallback?.providerId && providerIds.has(fallback.providerId)
          ? fallback.providerId
          : providers[0]?.id ?? 'custom'
      const legacyAuthorization = model.authorization?.trim() ?? ''
      const legacyApiKey =
        legacyAuthorization.match(/^(?:Bearer|x-api-key)\s+(.+)$/iu)?.[1] ?? ''

      return {
        id,
        name: model.name?.trim() || fallback?.name || id,
        providerId,
        context: model.context?.trim() || fallback?.context || 'Context window',
        description:
          model.description?.trim() || fallback?.description || 'General-purpose generation model',
        apiKey: model.apiKey?.trim() || legacyApiKey || fallback?.apiKey || '',
        url: model.url?.trim() || fallback?.url || '',
        contentType: model.contentType?.trim() || fallback?.contentType || 'application/json',
        authorization: model.authorization?.trim() || fallback?.authorization || '',
        bodyType: model.bodyType?.trim() || fallback?.bodyType || 'JSON',
        bodyParameters: model.bodyParameters ?? fallback?.bodyParameters ?? '{}',
        connectionStatus:
          model.connectionStatus === 'connected' || model.connectionStatus === 'failed'
            ? model.connectionStatus
            : fallback?.connectionStatus ?? 'untested',
        connectionError: model.connectionError?.trim() || '',
        lastTestedAt: model.lastTestedAt?.trim() || '',
        enabled:
          model.enabled ??
          legacyEnabledModels?.includes(id) ??
          fallback?.enabled ??
          true,
      } satisfies AIModelConfig
    })
    .filter((model, index, all) => all.findIndex((item) => item.id === model.id) === index)

  return normalized.length > 0
    ? normalized
    : defaultAIModels.map((model) => ({ ...model }))
}

export function loadPlatformConfig(): PlatformConfig {
  if (typeof window === 'undefined') {
    return defaultPlatformConfig
  }

  const savedConfig = window.localStorage.getItem(platformConfigStorageKey)

  if (!savedConfig) {
    return defaultPlatformConfig
  }

  try {
    const parsedConfig = JSON.parse(savedConfig) as LegacyPlatformConfig
    const parsedNotificationBar =
      (parsedConfig.notificationBar ?? {}) as LegacyNotificationBarConfig
    const parsedLandingPage: Partial<LandingPageConfig> =
      parsedConfig.landingPage ?? {}
    const parsedLandingHeader = (parsedLandingPage.header ??
      {}) as LegacyLandingHeaderConfig
    const parsedLandingFooter = (parsedLandingPage.footer ??
      {}) as LegacyLandingFooterConfig
    const parsedLandingContent: Partial<LandingContentConfig> =
      parsedLandingPage.content ?? {}
    const parsedPayments = (parsedConfig.payments ?? {}) as LegacyPaymentConfig
    const parsedAI = (parsedConfig.ai ?? {}) as LegacyAIConfig
    const parsedAdvisoryHub = (parsedConfig.advisoryHub ?? {}) as LegacyAdvisoryHubConfig
    const parsedAIProviders = normalizeAIProviders(parsedAI.providers)
    const parsedAIModels = normalizeAIModels(
      parsedAI.models,
      parsedAIProviders,
      parsedAI.enabledModels,
    )
    const resolvedPrimaryProvider = parsedAIProviders.some(
      (provider) => provider.id === parsedAI.provider,
    )
      ? parsedAI.provider!
      : parsedAIProviders[0]?.id ?? 'custom'
    const resolvedDefaultModel = parsedAIModels.some(
      (model) => model.id === parsedAI.defaultModel && model.enabled,
    )
      ? parsedAI.defaultModel!
      : parsedAIModels.find((model) => model.enabled)?.id ??
        parsedAIModels[0]?.id ??
        ''
    const parsedAdvisoryHubAgents = normalizeAdvisoryHubAgents(parsedAdvisoryHub.agents)
    const parsedAdvisoryHubDocumentTypes = normalizeAdvisoryHubDocumentTypes(
      parsedAdvisoryHub.documentTypes,
    )
    const parsedAdvisoryHubLayouts = normalizeAdvisoryHubLayouts(parsedAdvisoryHub.layouts)
    const parsedProofItems = parsedLandingContent.proofItems ?? []
    const parsedPriceCatalog = parsedPayments.priceCatalog ?? []
    const legacyPlatformName = `${parsedConfig.productName ?? ''}${
      parsedConfig.productSuffix ?? ''
    }`.trim()
    const resolvedNavItems =
      parsedLandingHeader.navItems && parsedLandingHeader.navItems.length > 0
        ? (() => {
            const mappedItems = parsedLandingHeader.navItems.map((item, index) => ({
              id: item.id?.trim() || `nav-item-${index + 1}`,
              label:
                item.label?.trim() ||
                defaultLandingHeaderNavItems[index]?.label ||
                'Navigation',
              href:
                item.href?.trim() ||
                defaultLandingHeaderNavItems[index]?.href ||
                '#',
            }))

            const hasPricingItem = mappedItems.some(
              (item) => item.id === 'pricing' || item.href === '#pricing',
            )

            return hasPricingItem
              ? mappedItems
              : [...mappedItems, { id: 'pricing', label: 'Pricing', href: '#pricing' }]
          })()
        : defaultLandingHeaderNavItems.map((item) => {
            const legacyLabelMap: Record<string, string | undefined> = {
              home: parsedLandingHeader.homeLabel,
              features: parsedLandingHeader.featuresLabel,
              workflow: parsedLandingHeader.workflowLabel,
              pricing: undefined,
              'open-source': parsedLandingHeader.openSourceLabel,
            }

            return {
              ...item,
              label: legacyLabelMap[item.id]?.trim() || item.label,
            }
          })
    const resolvedFooterSitemapItems =
      parsedLandingFooter.sitemapItems && parsedLandingFooter.sitemapItems.length > 0
        ? (() => {
            const mappedItems = parsedLandingFooter.sitemapItems.map((item, index) => ({
              id: item.id?.trim() || `footer-sitemap-${index + 1}`,
              label:
                item.label?.trim() ||
                resolvedNavItems[index]?.label ||
                'Navigation',
              href:
                item.href?.trim() ||
                resolvedNavItems[index]?.href ||
                '#',
            }))

            const hasPricingItem = mappedItems.some(
              (item) => item.id === 'pricing' || item.href === '#pricing',
            )

            return hasPricingItem
              ? mappedItems
              : [...mappedItems, { id: 'pricing', label: 'Pricing', href: '#pricing' }]
          })()
        : resolvedNavItems.map((item) => ({ ...item }))
    const resolvedFooterPlatformItems =
      parsedLandingFooter.platformItems && parsedLandingFooter.platformItems.length > 0
        ? parsedLandingFooter.platformItems.map((item, index) => ({
            id: item.id?.trim() || `footer-platform-${index + 1}`,
            label:
              item.label?.trim() ||
              defaultLandingFooterPlatformItems[index]?.label ||
              'Platform link',
            href:
              item.href?.trim() ||
              defaultLandingFooterPlatformItems[index]?.href ||
              '/dashboard',
          }))
        : defaultLandingFooterPlatformItems.map((item) => ({ ...item }))

    return {
      ...defaultPlatformConfig,
      ...parsedConfig,
      platformName:
        parsedConfig.platformName ??
        legacyPlatformName ??
        defaultPlatformConfig.platformName,
      platformLogo:
        parsedConfig.platformLogo ?? defaultPlatformConfig.platformLogo,
      language: normalizePlatformLanguage(parsedConfig.language),
      environmentMode:
        parsedConfig.environmentMode === 'live' ? 'live' : 'test',
      notificationBar: {
        ...defaultPlatformConfig.notificationBar,
        ...parsedNotificationBar,
        enabled:
          parsedNotificationBar.enabled ??
          defaultPlatformConfig.notificationBar.enabled,
        audience:
          parsedNotificationBar.audience === 'admin' ? 'admin' : 'all',
        message:
          parsedNotificationBar.message?.trim() ||
          defaultPlatformConfig.notificationBar.message,
        actionLabel:
          parsedNotificationBar.actionLabel?.trim() ||
          defaultPlatformConfig.notificationBar.actionLabel,
        actionUrl: parsedNotificationBar.actionUrl?.trim() ?? '',
        dismissible:
          parsedNotificationBar.dismissible ??
          defaultPlatformConfig.notificationBar.dismissible,
      },
      commercialLicenseUrl: commercialLicenseDefaults.url,
      commercialLicensePrice: commercialLicenseDefaults.price,
      landingPage: {
        ...defaultPlatformConfig.landingPage,
        ...parsedLandingPage,
        header: {
          ...defaultPlatformConfig.landingPage.header,
          ...parsedLandingHeader,
          navItems: resolvedNavItems,
        },
        content: {
          ...defaultPlatformConfig.landingPage.content,
          ...parsedLandingContent,
          headline:
            parsedLandingContent.headline ??
            parsedConfig.landingHeadline ??
            defaultPlatformConfig.landingPage.content.headline,
          subheadline:
            parsedLandingContent.subheadline ??
            parsedConfig.landingSubheadline ??
            defaultPlatformConfig.landingPage.content.subheadline,
          proofItems: defaultPlatformConfig.landingPage.content.proofItems.map(
            (item, index) => ({
              ...item,
              ...(parsedProofItems[index] ?? {}),
            }),
          ),
        },
        footer: {
          ...defaultPlatformConfig.landingPage.footer,
          ...parsedLandingFooter,
          sitemapItems: resolvedFooterSitemapItems,
          platformItems: resolvedFooterPlatformItems,
          privacyPolicy: {
            ...defaultPlatformConfig.landingPage.footer.privacyPolicy,
            ...parsedLandingFooter.privacyPolicy,
            label:
              parsedLandingFooter.privacyPolicy?.label ??
              parsedLandingFooter.privacyLabel ??
              defaultPlatformConfig.landingPage.footer.privacyPolicy.label,
          },
          termsOfService: {
            ...defaultPlatformConfig.landingPage.footer.termsOfService,
            ...parsedLandingFooter.termsOfService,
            label:
              parsedLandingFooter.termsOfService?.label ??
              parsedLandingFooter.termsLabel ??
              defaultPlatformConfig.landingPage.footer.termsOfService.label,
          },
        },
      },
      privacyPolicy: {
        ...defaultPlatformConfig.privacyPolicy,
        ...parsedConfig.privacyPolicy,
      },
      termsOfService: {
        ...defaultPlatformConfig.termsOfService,
        ...parsedConfig.termsOfService,
      },
      modules: {
        ...defaultPlatformConfig.modules,
        ...parsedConfig.modules,
      },
      payments: {
        ...defaultPlatformConfig.payments,
        ...parsedPayments,
        testSecretKeyReference:
          parsedPayments.testSecretKeyReference ??
          parsedPayments.secretKeyReference ??
          defaultPlatformConfig.payments.testSecretKeyReference,
        liveSecretKeyReference:
          parsedPayments.liveSecretKeyReference ??
          parsedPayments.secretKeyReference ??
          defaultPlatformConfig.payments.liveSecretKeyReference,
        priceCatalog:
          parsedPriceCatalog.length > 0
            ? ensureDefaultPriceCatalog(
                parsedPriceCatalog.map((item, index) => ({
                id: item.id?.trim() || `price-item-${index + 1}`,
                name: item.name?.trim() || `Offering ${index + 1}`,
                description: item.description?.trim() || '',
                descriptionFormat:
                  item.descriptionFormat === 'markdown' ? 'markdown' : 'html',
                offeringType:
                  item.offeringType === 'product' ? 'product' : 'service',
                billingType:
                  item.billingType === 'one-time' ||
                  item.billingType === 'annual'
                    ? item.billingType
                    : 'monthly',
                amount: item.amount?.trim() || '0',
                currency: item.currency === 'USD' ? 'USD' : 'CAD',
                provider:
                  item.provider === 'waffo-pancake'
                    ? 'waffo-pancake'
                    : 'stripe',
                externalProductId: item.externalProductId?.trim() || '',
                externalPriceId: item.externalPriceId?.trim() || '',
                active: item.active ?? true,
                isDefault: item.isDefault ?? false,
              })),
              )
            : defaultPlatformConfig.payments.priceCatalog,
      },
      ai: {
        ...defaultPlatformConfig.ai,
        ...parsedAI,
        provider: resolvedPrimaryProvider,
        defaultModel: resolvedDefaultModel,
        providers: parsedAIProviders,
        models: parsedAIModels,
      },
      advisoryHub: {
        ...defaultPlatformConfig.advisoryHub,
        ...parsedAdvisoryHub,
        agents: parsedAdvisoryHubAgents,
        documentTypes: parsedAdvisoryHubDocumentTypes,
        layouts: parsedAdvisoryHubLayouts,
        sections: normalizeAdvisoryHubSections(
          parsedAdvisoryHub.sections,
          parsedAdvisoryHubAgents,
          parsedAdvisoryHubDocumentTypes,
        ),
      },
      dataSources: [
        ...(parsedConfig.dataSources ?? []),
        ...defaultPlatformConfig.dataSources.filter(
          (defaultSource) =>
            !(parsedConfig.dataSources ?? []).some(
              (savedSource) => savedSource.id === defaultSource.id,
            ),
        ),
      ],
    }
  } catch {
    return defaultPlatformConfig
  }
}
