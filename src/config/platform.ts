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
  payments: PaymentConfig
  ai: AIConfig
  dataSources: FundingDataSource[]
  modules: Record<PlatformModuleId, boolean>
}

export const defaultPlatformConfig: PlatformConfig = {
  productName: 'Bconomics',
  productSuffix: '.ai',
  supportEmail: 'licensing@bconomics.ai',
  primaryColor: '#6257f2',
  sidebarColor: '#121c31',
  landingHeadline: 'Turn business information into funding-ready documents.',
  landingSubheadline:
    'Discover programs, organize applications, and generate lender-ready plans from one configurable workspace.',
  commercialLicenseUrl: 'mailto:licensing@bconomics.ai',
  commercialLicensePrice: 'Contact sales',
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
import {
  defaultFundingDataSources,
  type FundingDataSource,
} from '../data/fundingSources'
