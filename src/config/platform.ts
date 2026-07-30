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
  provider: 'stripe' | 'paddle' | 'manual'
  currency: 'CAD' | 'USD'
  monthlyPrice: string
  annualPrice: string
  testMode: boolean
  webhookUrl: string
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
  { id: 'open-source', label: 'Open source', href: '#opensource' },
]

const defaultLandingFooterPlatformItems: LandingFooterNavItemConfig[] = [
  { id: 'sign-in', label: 'Sign in', href: '/login' },
  { id: 'dashboard', label: 'Go to dashboard', href: '/dashboard' },
]

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
    enabled: true,
    provider: 'stripe',
    currency: 'CAD',
    monthlyPrice: '79',
    annualPrice: '790',
    testMode: true,
    webhookUrl: '/api/webhooks/stripe',
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
    const parsedProofItems = parsedLandingContent.proofItems ?? []
    const legacyPlatformName = `${parsedConfig.productName ?? ''}${
      parsedConfig.productSuffix ?? ''
    }`.trim()
    const resolvedNavItems =
      parsedLandingHeader.navItems && parsedLandingHeader.navItems.length > 0
        ? parsedLandingHeader.navItems.map((item, index) => ({
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
        : defaultLandingHeaderNavItems.map((item) => {
            const legacyLabelMap: Record<string, string | undefined> = {
              home: parsedLandingHeader.homeLabel,
              features: parsedLandingHeader.featuresLabel,
              workflow: parsedLandingHeader.workflowLabel,
              'open-source': parsedLandingHeader.openSourceLabel,
            }

            return {
              ...item,
              label: legacyLabelMap[item.id]?.trim() || item.label,
            }
          })
    const resolvedFooterSitemapItems =
      parsedLandingFooter.sitemapItems && parsedLandingFooter.sitemapItems.length > 0
        ? parsedLandingFooter.sitemapItems.map((item, index) => ({
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
        ...parsedConfig.payments,
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
