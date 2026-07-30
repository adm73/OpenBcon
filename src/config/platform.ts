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

export type PlatformConfig = {
  productName: string
  productSuffix: string
  supportEmail: string
  primaryColor: string
  sidebarColor: string
  landingHeadline: string
  landingSubheadline: string
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

export const defaultPlatformConfig: PlatformConfig = {
  productName: 'Bconomics',
  productSuffix: '.ai',
  supportEmail: 'chenadm73@gmail.com',
  primaryColor: '#6257f2',
  sidebarColor: '#121c31',
  landingHeadline: 'Turn business information into funding-ready documents.',
  landingSubheadline:
    'Discover programs, organize applications, and generate lender-ready plans from one configurable workspace.',
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

export function loadPlatformConfig(): PlatformConfig {
  if (typeof window === 'undefined') {
    return defaultPlatformConfig
  }

  const savedConfig = window.localStorage.getItem(platformConfigStorageKey)

  if (!savedConfig) {
    return defaultPlatformConfig
  }

  try {
    const parsedConfig = JSON.parse(savedConfig) as Partial<PlatformConfig>

    return {
      ...defaultPlatformConfig,
      ...parsedConfig,
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
