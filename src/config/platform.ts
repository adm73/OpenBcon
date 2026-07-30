import {
  defaultFundingDataSources,
  type FundingDataSource,
} from '../data/fundingSources'

export type PlatformModuleId =
  | 'funding-readiness'
  | 'quick-generate'
  | 'my-company'
  | 'saved-programs'
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

export type PaymentCatalogItem = {
  id: string
  name: string
  description: string
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
  provider: 'openai' | 'anthropic' | 'google' | 'custom'
  defaultModel: string
  apiBaseUrl: string
  apiKeyReference: string
  temperature: string
  enabledModels: string[]
  mockModeEnabled: boolean
}

export type LegalDocumentFormat = 'markdown' | 'html'

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

export type PlatformConfig = {
  platformName: string
  platformLogo: string
  supportEmail: string
  primaryColor: string
  sidebarColor: string
  landingPage: LandingPageConfig
  commercialLicenseUrl: string
  commercialLicensePrice: string
  openBconAttributionVisible: boolean
  privacyPolicy: LegalDocumentConfig
  termsOfService: LegalDocumentConfig
  payments: PaymentConfig
  ai: AIConfig
  dataSources: FundingDataSource[]
  modules: Record<PlatformModuleId, boolean>
}

export const secureConfigValuePlaceholder = '__stored_securely__'

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
  const normalizedItems = items.map((item) => ({ ...item, isDefault: !!item.isDefault }))
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

export const defaultPlatformConfig: PlatformConfig = {
  platformName: 'Bconomics.ai',
  platformLogo: '',
  supportEmail: 'chenadm73@gmail.com',
  primaryColor: '#6257f2',
  sidebarColor: '#121c31',
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
  commercialLicenseUrl: 'mailto:chenadm73@gmail.com',
  commercialLicensePrice: 'Contact sales',
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
    apiBaseUrl: '/api/ai',
    apiKeyReference: 'OPENAI_API_KEY',
    temperature: '0.3',
    enabledModels: ['gpt-5-mini', 'gpt-5.2', 'claude-sonnet-4-5'],
    mockModeEnabled: true,
  },
  dataSources: defaultFundingDataSources,
  modules: {
    'funding-readiness': true,
    'quick-generate': true,
    'my-company': true,
    'saved-programs': true,
    'my-applications': true,
    'grants-loans': true,
    templates: true,
    'social-resources': true,
    tools: true,
    'partner-portal': true,
  },
}

export const platformConfigStorageKey = 'bconomics-platform-config-v1'

type LegacyPlatformConfig = Partial<PlatformConfig> & {
  platformName?: string
  platformLogo?: string
  landingHeadline?: string
  landingSubheadline?: string
  productName?: string
  productSuffix?: string
}

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
    const parsedLandingPage: Partial<LandingPageConfig> =
      parsedConfig.landingPage ?? {}
    const parsedLandingHeader = (parsedLandingPage.header ??
      {}) as LegacyLandingHeaderConfig
    const parsedLandingFooter = (parsedLandingPage.footer ??
      {}) as LegacyLandingFooterConfig
    const parsedLandingContent: Partial<LandingContentConfig> =
      parsedLandingPage.content ?? {}
    const parsedPayments = (parsedConfig.payments ?? {}) as LegacyPaymentConfig
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
        ...parsedConfig.ai,
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
