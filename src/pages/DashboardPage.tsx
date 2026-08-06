import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type CSSProperties,
  type FormEvent,
} from 'react'
import {
  Link,
  NavLink,
  Navigate,
  useLocation,
  useNavigate,
  useParams,
  useSearchParams,
} from 'react-router-dom'
import {
  hasAdminAccess,
  grantAdminAccess,
  revokeAdminAccess,
} from '../auth/adminAccess'
import {
  clearAuthSession,
  authUserUpdatedEvent,
  getCurrentAuthUser,
  getUserInitials,
  updateCurrentAuthUserProfile,
} from '../auth/session'
import { OpenBconAttribution } from '../components/OpenBconAttribution'
import { usePlatformConfig } from '../config/usePlatformConfig'
import {
  languageOptions,
  normalizeLocale,
  useLocale,
  useTranslation,
  type SupportedLocale,
} from '../i18n'
import {
  type AdvisoryHubAgentConfig,
  type AdvisoryHubDocumentTypeConfig,
  type AdvisoryHubLayoutConfig,
  type AdvisoryHubSectionLayout,
  type AdvisoryHubSectionConfig,
  sanitizePlatformConfigForPersistence,
  platformConfigStorageKey,
  type PaymentCatalogItem,
  type PaymentConfig,
  type PlatformModuleId,
} from '../config/platform'
import { persistLocalPlatformSecureConfig } from '../config/localSecureConfig'
import { getClientEnvironmentMode } from '../lib/environmentMode'
import {
  findFundingProgramByName,
  loadFundingPrograms,
  loadResourceRecords,
  replaceFundingProgramCache,
  type DataSourceModule,
  type FundingProgramRecord,
} from '../data/fundingSources'
import {
  addSavedProgram,
  loadSavedProgramEntries,
  persistSavedProgramEntries,
  saveSavedProgramEntries,
  type SavedProgramEntry,
  type SavedProgramPriority,
  type SavedProgramStage,
} from '../data/savedPrograms'
import {
  createStripeBillingPortalSession,
  createStripeCheckoutSession,
  lookupStripeCheckoutSession,
} from '../lib/stripeBillingApi'
import {
  createManualFundingProgramViaApi,
  loadFundingProgramsViaApi,
  type ManualFundingProgramInput,
} from '../lib/fundingProgramsApi'
import { renderFormattedContent } from '../lib/legalContent'
import { cssDeclarationsToStyle } from '../lib/layoutStyles'
import { createApplicationViaApi } from '../lib/applicationsApi'
import {
  loadCompaniesViaApi,
  saveCompanyViaApi,
  type CompanyApiRecord,
  type CompanyTeamMember,
} from '../lib/companiesApi'
import {
  createStrategicReviewReport,
  findApplicationRecord,
  findApplicationRecordByAppId,
  findApplicationRecordByPublicId,
  getStrategicReviewReports,
  loadApplications,
  materializeSavedProgramApplication,
  saveApplications,
  upsertGeneratedApplication,
  updateApplicationRecord,
  type ApplicationRecord,
  type ApplicationStatus,
} from '../data/applications'

function getQuickBuildPath(applicationId: string, companyId?: string) {
  const application = findApplicationRecord(loadApplications(), applicationId)
  const params = new URLSearchParams({
    app_id: application?.appId ?? applicationId,
  })
  if (companyId) {
    params.set('company_id', companyId)
  }
  return `/quick-build?${params.toString()}`
}

function getQuickBuildMatchPath(programId: string, companyId: string) {
  const params = new URLSearchParams({
    program_id: programId,
    company_id: companyId,
  })
  return `/quick-build?${params.toString()}`
}

function getStrategicReportsPath(applicationId: string) {
  const application = findApplicationRecord(loadApplications(), applicationId)
  return `/strategic-reports?app_id=${encodeURIComponent(application?.appId ?? applicationId)}`
}

function getStrategicReportsPathForApplication(application: Pick<ApplicationRecord, 'id' | 'appId'>) {
  return `/strategic-reports?app_id=${encodeURIComponent(application.appId ?? application.id)}`
}

function getSafeNotificationUrl(value: string) {
  const url = value.trim()
  if (!url) return ''
  if (url.startsWith('/') && !url.startsWith('//')) return url
  if (url.startsWith('#')) return url
  return /^https?:\/\//iu.test(url) ? url : ''
}

const navigationItemTranslationKeys: Record<string, string> = {
  dashboard: 'navigation.items.dashboard',
  discovery: 'navigation.items.fundingReadiness',
  'quick-build': 'navigation.items.quickBuild',
  'strategic-reports': 'navigation.items.advisoryHub',
  'my-companies': 'navigation.items.myCompany',
  'funding-shortlist': 'navigation.items.savedPrograms',
  'my-applications': 'navigation.items.myApplications',
  'grants-loans': 'navigation.items.grantsLoans',
  templates: 'navigation.items.templates',
  'social-resources': 'navigation.items.socialResources',
  tools: 'navigation.items.tools',
  settings: 'navigation.items.settings',
}

const navigationGroupTranslationKeys: Record<string, string> = {
  'Funding Centre': 'navigation.groups.fundingCentre',
  'My Workspace': 'navigation.groups.myWorkspace',
  'Programs & Opportunities': 'navigation.groups.programs',
}

function translateNavigationLabel(
  t: (key: string, options?: { defaultValue?: string }) => string,
  itemId: string,
  fallback: string,
) {
  const key = navigationItemTranslationKeys[itemId]
  return key ? t(key, { defaultValue: fallback }) : fallback
}
import {
  loadTemplateCatalog,
  type TemplateFormat,
  type TemplateRecord,
} from '../data/templates'
import {
  loadSocialResourceCatalog,
  type SocialResourceRecord,
  type SocialResourceType,
} from '../data/socialResources'
import {
  loadToolCatalog,
  type ToolPricing,
  type ToolRecord,
  type ToolType,
} from '../data/tools'
import { getPlatformDisplayName, getPlatformInitial } from '../lib/platformBrand'
import {
  generateFinancialForecastViaApi,
  generateBusinessPlanViaApi,
  regenerateStrategicReportSectionViaApi,
  updateStrategicReportSectionViaApi,
  type BusinessPlanGenerateResponse,
  type BusinessPlanSectionResponse,
} from '../lib/businessPlanApi'
import {
  downloadStrategicReportDocx,
  downloadStrategicReportPdf,
  downloadStrategicReportXlsx,
  coverPageSubtitle,
  type StrategicReportExportInput,
} from '../lib/reportExports'
import type {
  FinancialForecast,
  GeneratedDocument,
  GeneratedPackage,
  GeneratedPackageSection,
  StrategicReviewReport,
} from '../types'
import {
  allDashboardItems,
  dashboardGroups,
  findDashboardItem,
  footerItems,
  partnerItems,
  quickActionRoutes,
  type DashboardGlyph,
  type DashboardItem,
} from '../data/dashboard'
import {
  hydratePersistentStorage,
  persistPersistentItem,
  removePersistentItem,
  setPersistentItem,
} from '../persistence/storage'

function Glyph({ type }: { type: DashboardGlyph }) {
  const paths = {
    home: 'M3 10.5 12 3l9 7.5v8.25a.75.75 0 0 1-.75.75h-4.5v-5.25h-3v5.25H3.75a.75.75 0 0 1-.75-.75V10.5Z',
    compass:
      'M12 2.75a9.25 9.25 0 1 0 0 18.5 9.25 9.25 0 0 0 0-18.5Zm0 1.5a7.75 7.75 0 1 1 0 15.5 7.75 7.75 0 0 1 0-15.5Zm3.7 3.05-2.1 4.2-4.2 2.1 2.1-4.2 4.2-2.1Z',
    grid: 'M3 3h7v7H3V3Zm11 0h7v7h-7V3ZM3 14h7v7H3v-7Zm11 0h7v7h-7v-7Z',
    search:
      'M10.5 4.5a6 6 0 1 0 3.782 10.657l4.53 4.53 1.06-1.06-4.53-4.53A6 6 0 0 0 10.5 4.5Zm0 1.5a4.5 4.5 0 1 1 0 9 4.5 4.5 0 0 1 0-9Z',
    bolt: 'M12.46 2 5 13h5l-1 9 7.54-11H12l.46-9Z',
    currency:
      'M12 3.25c-2.66 0-4.75 1.52-4.75 3.5 0 1.9 1.67 2.89 4.52 3.48 2.65.55 3.73 1.05 3.73 2.2 0 1.21-1.38 2.07-3.5 2.07-2.03 0-3.5-.79-4.27-2.18l-1.33.76c.99 1.79 2.75 2.73 4.85 2.88v1.79h1.5v-1.81c2.78-.22 4.75-1.74 4.75-3.72 0-2.22-1.73-3.17-4.87-3.82-2.42-.5-3.38-.99-3.38-1.92 0-1 1.18-1.79 3.18-1.79 1.74 0 3 .6 3.76 1.79l1.28-.82c-.93-1.5-2.38-2.31-4.29-2.48v-1.71h-1.5v1.78Z',
    file: 'M6 3.75A1.75 1.75 0 0 1 7.75 2h6.19L19 7.06V20.25A1.75 1.75 0 0 1 17.25 22H7.75A1.75 1.75 0 0 1 6 20.25V3.75Zm7 0v4h4',
    report:
      'M6 3.75A1.75 1.75 0 0 1 7.75 2h6.19L19 7.06v13.19A1.75 1.75 0 0 1 17.25 22H7.75A1.75 1.75 0 0 1 6 20.25V3.75ZM14 3.8V8h4.2L14 3.8ZM9 11h6v1.5H9V11Zm0 3h6v1.5H9V14Zm0 3h4v1.5H9V17Z',
    building:
      'M4 21V5.25A1.25 1.25 0 0 1 5.25 4h7.5A1.25 1.25 0 0 1 14 5.25V8h4.75A1.25 1.25 0 0 1 20 9.25V21h-1.5V9.5h-4.5V21H4Zm1.5-1.5h7V5.5h-7v14Zm2-11h1.5V10H7.5V8.5Zm3 0H12V10h-1.5V8.5Zm-3 3h1.5V13H7.5v-1.5Zm3 0H12V13h-1.5v-1.5Z',
    bookmark:
      'M6 3.75A1.75 1.75 0 0 1 7.75 2h8.5A1.75 1.75 0 0 1 18 3.75V22l-6-3.75L6 22V3.75Zm1.5 0v15.53l4.5-2.81 4.5 2.81V3.75a.25.25 0 0 0-.25-.25h-8.5a.25.25 0 0 0-.25.25Z',
    clipboard:
      'M9 3h6a1.5 1.5 0 0 1 1.5 1.5H18A2.25 2.25 0 0 1 20.25 6.75v12A2.25 2.25 0 0 1 18 21H6a2.25 2.25 0 0 1-2.25-2.25v-12A2.25 2.25 0 0 1 6 4.5h1.5A1.5 1.5 0 0 1 9 3Zm0 1.5a.5.5 0 0 0-.5.5v1h7V5a.5.5 0 0 0-.5-.5H9ZM6 6a.75.75 0 0 0-.75.75v12c0 .41.34.75.75.75h12a.75.75 0 0 0 .75-.75v-12A.75.75 0 0 0 18 6H6Zm2.25 3h7.5v1.5h-7.5V9Zm0 3h7.5v1.5h-7.5V12Zm0 3h5v1.5h-5V15Z',
    template:
      'M5 3.25A1.25 1.25 0 0 1 6.25 2h11.5A1.25 1.25 0 0 1 19 3.25v17.5A1.25 1.25 0 0 1 17.75 22H6.25A1.25 1.25 0 0 1 5 20.75V3.25Zm1.5.25v5h11V3.5h-11Zm0 6.5v10.5h11V10h-11Z',
    network:
      'M6 4.5a2.5 2.5 0 1 1 2.46 3l2.08 2.6a2.48 2.48 0 0 1 2.92 0l2.08-2.6A2.5 2.5 0 1 1 17 7.5l-2.4 3a2.5 2.5 0 1 1-5.2 0L7 7.5A2.5 2.5 0 0 1 6 4.5Zm0 1.5a1 1 0 1 0 0 2 1 1 0 0 0 0-2Zm12 0a1 1 0 1 0 0 2 1 1 0 0 0 0-2Zm-6 5a1 1 0 1 0 0 2 1 1 0 0 0 0-2Zm-6 5a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5Zm12 0a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5Zm-12 1.5a1 1 0 1 0 0 2 1 1 0 0 0 0-2Zm12 0a1 1 0 1 0 0 2 1 1 0 0 0 0-2Z',
    user:
      'M12 12a4.5 4.5 0 1 0 0-9 4.5 4.5 0 0 0 0 9Zm0 2.25c-4.1 0-7.5 2.14-7.5 4.78V21h15v-1.97c0-2.64-3.4-4.78-7.5-4.78Z',
    settings:
      'm12 3 1.2 2.7 2.95.34-2.2 2.02.62 2.94L12 9.74 9.43 11l.62-2.94-2.2-2.02 2.95-.34L12 3Zm0 7.5A4.5 4.5 0 1 1 12 19.5a4.5 4.5 0 0 1 0-9Z',
    shield:
      'M12 2.5 20 5.75v5.38c0 5.08-3.35 9.42-8 10.37-4.65-.95-8-5.29-8-10.37V5.75L12 2.5Zm0 1.62L5.5 6.76v4.37c0 4.21 2.67 7.86 6.5 8.78 3.83-.92 6.5-4.57 6.5-8.78V6.76L12 4.12Zm-1 11.13L8.25 12.5l1.06-1.06L11 13.13l3.69-3.69 1.06 1.06L11 15.25Z',
    logout:
      'M10.5 3H5.25A2.25 2.25 0 0 0 3 5.25v13.5A2.25 2.25 0 0 0 5.25 21h5.25v-1.5H5.25a.75.75 0 0 1-.75-.75V5.25a.75.75 0 0 1 .75-.75h5.25V3Zm4.72 4.72-1.06 1.06 2.47 2.47H9v1.5h7.63l-2.47 2.47 1.06 1.06L19.5 12l-4.28-4.28Z',
    arrow: 'm9 6 6 6-6 6',
    spark:
      'M12 2.5 13.9 8l5.6 1.9-5.6 1.9L12 17.5l-1.9-5.7L4.5 9.9 10.1 8 12 2.5Zm7 12.5 1 2.9 2.9 1-2.9 1-1 2.9-1-2.9-2.9-1 2.9-1 1-2.9Z',
    tools:
      'M14.7 5.3a4 4 0 0 0 4.8 5.35l-8.1 8.1a2 2 0 1 1-2.83-2.83l8.1-8.1A4 4 0 0 1 11.3 3.3l2.4 2Z',
    menu: 'M3 6.5h18V8H3V6.5Zm0 4.75h18v1.5H3v-1.5ZM3 16h18v1.5H3V16Z',
    close: 'm6.7 5.64 5.3 5.3 5.3-5.3 1.06 1.06-5.3 5.3 5.3 5.3-1.06 1.06-5.3-5.3-5.3 5.3-1.06-1.06 5.3-5.3-5.3-5.3 1.06-1.06Z',
  }

  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d={paths[type]} fill="currentColor" />
    </svg>
  )
}

function itemPath(itemId: string) {
  return itemId === 'dashboard' ? '/dashboard' : `/${itemId}`
}

type ListingProfile = {
  kicker: string
  action: string
  metricLabel: string
  metricValue: string
  secondaryLabel: string
  secondaryValue: string
  insight: string
}

const listingProfiles: Record<string, ListingProfile> = {
  'my-companies': {
    kicker: 'Company workspace',
    action: 'Update company profile',
    metricLabel: 'Profile strength',
    metricValue: '84%',
    secondaryLabel: 'Last verified',
    secondaryValue: 'Today',
    insight: 'Complete your ownership and financial details to improve program matching.',
  },
  'funding-shortlist': {
    kicker: 'Funding shortlist',
    action: 'Discover programs',
    metricLabel: 'Closing soon',
    metricValue: '4',
    secondaryLabel: 'Potential funding',
    secondaryValue: '$780K',
    insight: 'Two saved opportunities close within the next 14 days.',
  },
  'my-applications': {
    kicker: 'Application pipeline',
    action: 'Start application',
    metricLabel: 'In progress',
    metricValue: '5',
    secondaryLabel: 'Success rate',
    secondaryValue: '67%',
    insight: 'Your FedDev draft is the closest application to submission.',
  },
  'grants-loans': {
    kicker: 'Opportunity directory',
    action: 'Find new matches',
    metricLabel: 'New matches',
    metricValue: '18',
    secondaryLabel: 'Available value',
    secondaryValue: '$1.2M',
    insight: 'Seven programs match your company profile at 80% or higher.',
  },
  templates: {
    kicker: 'Resource library',
    action: 'Create template',
    metricLabel: 'Most used',
    metricValue: 'Business plan',
    secondaryLabel: 'Downloads',
    secondaryValue: '142',
    insight: 'Funding narrative templates are trending across partner workspaces.',
  },
  'social-resources': {
    kicker: 'People & organization network',
    action: 'Add contact',
    metricLabel: 'Verified profiles',
    metricValue: '7',
    secondaryLabel: 'Saved contacts',
    secondaryValue: '3',
    insight: 'Two investors match your sector and current funding stage.',
  },
  tools: {
    kicker: 'Founder stack',
    action: 'Add product',
    metricLabel: 'Available',
    metricValue: '24',
    secondaryLabel: 'Categories',
    secondaryValue: '8',
    insight: 'Cloud services and financial products are the most visited categories.',
  },
  'partner-dashboard': {
    kicker: 'Partner command centre',
    action: 'Invite a client',
    metricLabel: 'Active clients',
    metricValue: '28',
    secondaryLabel: 'Portfolio value',
    secondaryValue: '$3.4M',
    insight: 'Client activation increased 12% over the previous 30 days.',
  },
  'partner-analytics': {
    kicker: 'Portfolio intelligence',
    action: 'Export analytics',
    metricLabel: 'Approval rate',
    metricValue: '71%',
    secondaryLabel: 'Avg. readiness',
    secondaryValue: '82',
    insight: 'Manufacturing clients lead the portfolio in funding readiness.',
  },
  'client-management': {
    kicker: 'Client portfolio',
    action: 'Add client',
    metricLabel: 'Active clients',
    metricValue: '28',
    secondaryLabel: 'Need attention',
    secondaryValue: '5',
    insight: 'Three client profiles need updated financial information.',
  },
  'application-management': {
    kicker: 'Managed pipeline',
    action: 'Create application',
    metricLabel: 'Open applications',
    metricValue: '34',
    secondaryLabel: 'Due this month',
    secondaryValue: '9',
    insight: 'The next portfolio deadline is in six business days.',
  },
  'revenue-sharing': {
    kicker: 'Partner earnings',
    action: 'View payout report',
    metricLabel: 'Next payout',
    metricValue: '$8,420',
    secondaryLabel: 'Lifetime earned',
    secondaryValue: '$46K',
    insight: 'July revenue share is 18% higher than last month.',
  },
  'business-plan-pro': {
    kicker: 'Document studio',
    action: 'Create business plan',
    metricLabel: 'Plans generated',
    metricValue: '46',
    secondaryLabel: 'Avg. readiness',
    secondaryValue: '91%',
    insight: 'Four plans are waiting for a final advisor review.',
  },
  'financial-forecast-pro': {
    kicker: 'Forecast studio',
    action: 'Build forecast',
    metricLabel: 'Active models',
    metricValue: '19',
    secondaryLabel: 'Forecast horizon',
    secondaryValue: '36 mo',
    insight: 'Three models need updated revenue assumptions.',
  },
  'branding-domain': {
    kicker: 'White-label studio',
    action: 'Add brand',
    metricLabel: 'Active brands',
    metricValue: '3',
    secondaryLabel: 'Connected domains',
    secondaryValue: '2',
    insight: 'One domain is waiting for DNS verification.',
  },
  'team-role-permissions': {
    kicker: 'Workspace access',
    action: 'Invite team member',
    metricLabel: 'Team members',
    metricValue: '12',
    secondaryLabel: 'Pending invites',
    secondaryValue: '2',
    insight: 'Review two users with administrator-level access.',
  },
  'api-access': {
    kicker: 'Developer platform',
    action: 'Create API key',
    metricLabel: 'Requests this month',
    metricValue: '18.4K',
    secondaryLabel: 'Success rate',
    secondaryValue: '99.8%',
    insight: 'API traffic is healthy with no incidents in the last seven days.',
  },
  'workflow-builder': {
    kicker: 'Automation studio',
    action: 'Create workflow',
    metricLabel: 'Active workflows',
    metricValue: '8',
    secondaryLabel: 'Runs this month',
    secondaryValue: '1,284',
    insight: 'Application follow-up is your highest-volume automation.',
  },
  'custom-report-export': {
    kicker: 'Reporting centre',
    action: 'Build report',
    metricLabel: 'Saved reports',
    metricValue: '16',
    secondaryLabel: 'Exports this month',
    secondaryValue: '43',
    insight: 'The monthly client portfolio report is ready to export.',
  },
  settings: {
    kicker: 'Workspace preferences',
    action: 'Save changes',
    metricLabel: 'Security',
    metricValue: 'Strong',
    secondaryLabel: 'Integrations',
    secondaryValue: '4 active',
    insight: 'Enable two-factor authentication for an additional security layer.',
  },
}

function getListingProfile(item: DashboardItem): ListingProfile {
  return (
    listingProfiles[item.id] ?? {
      kicker: 'Workspace records',
      action: `Create ${item.label.toLowerCase()} record`,
      metricLabel: 'Active records',
      metricValue: String(item.entries.length),
      secondaryLabel: 'Updated',
      secondaryValue: 'Today',
      insight: item.description,
    }
  )
}

function SectionListing({ item }: { item: DashboardItem }) {
  const { config } = usePlatformConfig()
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<'All' | 'Active' | 'In Review' | 'Saved'>(
    'All',
  )
  const [view, setView] = useState<'table' | 'cards'>('table')
  const [notice, setNotice] = useState('')
  const [selectedEntry, setSelectedEntry] = useState<DashboardItem['entries'][number] | null>(
    null,
  )
  const profile = getListingProfile(item)
  const resourceModule = (
    ['templates', 'social-resources', 'tools'] as DataSourceModule[]
  ).includes(item.id as DataSourceModule)
    ? (item.id as Exclude<DataSourceModule, 'grants-loans'>)
    : null
  const enabledSourceIds = config.dataSources
    .filter((source) => source.enabled && source.module === resourceModule)
    .map((source) => source.id)
  const synchronizedEntries = resourceModule
    ? loadResourceRecords(resourceModule, enabledSourceIds).map((record) => ({
        title: record.title,
        subtitle: `${record.description} · ${record.category}`,
        meta: record.updatedAt,
        status: record.status,
        sourceName: record.sourceName,
        url: record.url,
      }))
    : []
  const allEntries = [...item.entries, ...synchronizedEntries]

  const visibleEntries = allEntries.filter((entry) => {
    const matchesQuery =
      `${entry.title} ${entry.subtitle} ${entry.status} ${entry.sourceName ?? ''}`
      .toLowerCase()
      .includes(query.trim().toLowerCase())
    const matchesFilter = filter === 'All' || entry.status === filter

    return matchesQuery && matchesFilter
  })

  return (
    <section className={`workspace-listing workspace-listing-${item.id}`}>
      <header className="workspace-listing-header">
        <div className="workspace-listing-heading">
          <p className="workspace-eyebrow">{profile.kicker}</p>
          <h1>{item.label}</h1>
          <p>{item.description}</p>
        </div>
        <button
          type="button"
          className="workspace-primary-action"
          onClick={() => setNotice(`${profile.action} is ready for backend connection.`)}
        >
          <Glyph type="spark" />
          <span>{profile.action}</span>
        </button>
      </header>

      {notice ? (
        <div className="workspace-inline-notice" role="status">
          <span>{notice}</span>
          <button type="button" onClick={() => setNotice('')} aria-label="Dismiss notice">
            <Glyph type="close" />
          </button>
        </div>
      ) : null}

      <div className="workspace-metric-grid">
        <article className="workspace-metric-card is-primary">
          <span>{profile.metricLabel}</span>
          <strong>{profile.metricValue}</strong>
          <small>Live workspace data</small>
        </article>
        <article className="workspace-metric-card">
          <span>{profile.secondaryLabel}</span>
          <strong>{profile.secondaryValue}</strong>
          <small>Updated automatically</small>
        </article>
        <article className="workspace-metric-card is-insight">
          <span>Workspace insight</span>
          <p>{profile.insight}</p>
        </article>
      </div>

      <section className="workspace-records">
        <div className="workspace-records-header">
          <div>
            <p className="workspace-eyebrow">All records</p>
            <h2>{item.label}</h2>
          </div>
          <span>{visibleEntries.length} of {allEntries.length}</span>
        </div>

        <div className="workspace-listing-toolbar">
          <label className="workspace-search">
            <Glyph type="search" />
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={`Search ${item.label.toLowerCase()}`}
            />
          </label>
          <div className="workspace-filter-group">
            {(['All', 'Active', 'In Review', 'Saved'] as const).map((filterName) => (
              <button
                key={filterName}
                type="button"
                className={filter === filterName ? 'is-selected' : ''}
                aria-pressed={filter === filterName}
                onClick={() => setFilter(filterName)}
              >
                {filterName}
              </button>
            ))}
          </div>
          <div className="workspace-view-switch" aria-label="Choose record view">
            <button
              type="button"
              className={view === 'table' ? 'is-selected' : ''}
              aria-label="Table view"
              onClick={() => setView('table')}
            >
              <Glyph type="menu" />
            </button>
            <button
              type="button"
              className={view === 'cards' ? 'is-selected' : ''}
              aria-label="Card view"
              onClick={() => setView('cards')}
            >
              <Glyph type="grid" />
            </button>
          </div>
        </div>

        <div className={`workspace-record-list is-${view}`}>
          {visibleEntries.map((entry, index) => (
            <button
              key={entry.title}
              type="button"
              className="workspace-record-row"
              onClick={() => setSelectedEntry(entry)}
            >
              <span className="workspace-record-symbol">
                <Glyph type={item.icon} />
              </span>
              <span className="workspace-record-main">
                <strong>{entry.title}</strong>
                <small>{entry.subtitle}</small>
              </span>
              <span className={`workspace-status status-${entry.status.toLowerCase().replace(' ', '-')}`}>
                {entry.status}
              </span>
              <span className="workspace-record-owner">
                <b>{['AL', 'MC', 'JS'][index % 3]}</b>
                <small>{['Ava Lin', 'Morgan Chen', 'Jordan Smith'][index % 3]}</small>
              </span>
              <span className="workspace-record-meta">{entry.meta}</span>
              <span className="workspace-record-open">
                <Glyph type="arrow" />
              </span>
            </button>
          ))}
        </div>

        {visibleEntries.length === 0 ? (
          <div className="workspace-empty">
            <span><Glyph type="search" /></span>
            <strong>No matching records</strong>
            <p>Try another search term or clear the active filter.</p>
            <button
              type="button"
              onClick={() => {
                setQuery('')
                setFilter('All')
              }}
            >
              Clear filters
            </button>
          </div>
        ) : null}
      </section>

      {selectedEntry ? (
        <div
          className="clone-record-dialog-backdrop"
          role="presentation"
          onMouseDown={() => setSelectedEntry(null)}
        >
          <section
            className="clone-record-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="record-dialog-title"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              className="clone-dialog-close"
              aria-label="Close record"
              onClick={() => setSelectedEntry(null)}
            >
              <Glyph type="close" />
            </button>
            <span className="clone-record-status">{selectedEntry.status}</span>
            <h2 id="record-dialog-title">{selectedEntry.title}</h2>
            <p>{selectedEntry.subtitle}</p>
            <dl>
              <div>
                <dt>Workspace</dt>
                <dd>{item.label}</dd>
              </div>
              <div>
                <dt>Last activity</dt>
                <dd>{selectedEntry.meta}</dd>
              </div>
              {selectedEntry.sourceName ? (
                <div>
                  <dt>Data source</dt>
                  <dd>{selectedEntry.sourceName}</dd>
                </div>
              ) : null}
            </dl>
            {selectedEntry.url ? (
              <a
                className="clone-dialog-primary"
                href={selectedEntry.url}
                target="_blank"
                rel="noreferrer"
              >
                Open resource
              </a>
            ) : (
              <button
                type="button"
                className="clone-dialog-primary"
                onClick={() => setSelectedEntry(null)}
              >
                Continue
              </button>
            )}
          </section>
        </div>
      ) : null}
    </section>
  )
}

type CompanyRecord = CompanyApiRecord

const fundingUsageOptions = [
  { value: 'equipment', label: 'Buy equipment' },
  { value: 'inventory', label: 'Stock inventory' },
  { value: 'hiring', label: 'Hire staff' },
  { value: 'advertising', label: 'Advertise' },
  { value: 'rent', label: 'Pay rent' },
  { value: 'payroll', label: 'Pay wages' },
] as const

const sectorOptions = ['Primary', 'Secondary', 'Tertiary', 'Quaternary'] as const

const industryOptions = [
  '11 Agriculture, forestry, fishing and hunting',
  '21 Mining, quarrying, and oil and gas extraction',
  '22 Utilities',
  '23 Construction',
  '31-33 Manufacturing',
  '41 Wholesale trade',
  '44-45 Retail trade',
  '48-49 Transportation and warehousing',
  '51 - Information and cultural industries',
  '52 - Finance and insurance',
  '53 - Real estate and rental and leasing',
  '54 - Professional, scientific and technical services',
  '55 - Management of companies and enterprises',
  '56 - Administrative and support, waste management and remediation services',
  '61 - Educational services',
  '62 - Health care and social assistance',
  '71 - Arts, entertainment and recreation',
  '72 - Accommodation and food services',
  '81 - Other services (except public administration)',
  '91 - Public administration',
] as const

const companyPeriodOptions = [
  { value: 'all-year', label: 'All Year' },
  { value: 'january', label: 'January' },
  { value: 'february', label: 'February' },
  { value: 'march', label: 'March' },
  { value: 'april', label: 'April' },
  { value: 'may', label: 'May' },
  { value: 'june', label: 'June' },
  { value: 'july', label: 'July' },
  { value: 'august', label: 'August' },
  { value: 'september', label: 'September' },
  { value: 'october', label: 'October' },
  { value: 'november', label: 'November' },
  { value: 'december', label: 'December' },
] as const

const companyStorageKey = 'bconomics-company-portfolio-v1'

function loadCompanyRecords(): CompanyRecord[] {
  if (typeof window === 'undefined') return []

  const savedCompanies = window.localStorage.getItem(companyStorageKey)
  if (!savedCompanies) return []

  try {
    const parsedCompanies = JSON.parse(savedCompanies) as CompanyRecord[]
    return Array.isArray(parsedCompanies) ? parsedCompanies.map(normalizeCompanyRecord) : []
  } catch {
    return []
  }
}

function normalizeCompanyStage(value: string) {
  const normalized = value.trim().toLowerCase()
  if (normalized === 'pre-revenue' || normalized === 'pre revenue') return 'Launch'
  if (normalized === 'revenue generating' || normalized === 'revenue-generating') return 'Growth'
  if (normalized === 'expansion') return 'Maturity'
  if (normalized === 'decline') return 'Decline'
  if (normalized === 'maturity') return 'Maturity'
  if (normalized === 'growth') return 'Growth'
  return 'Launch'
}

function normalizeCompanySector(value: string) {
  const normalized = value.trim().toLowerCase()
  if (normalized === 'primary') return 'Primary'
  if (normalized === 'secondary') return 'Secondary'
  if (normalized === 'tertiary') return 'Tertiary'
  if (normalized === 'quaternary') return 'Quaternary'
  if (/farm|agricultur|fishing|forestry|mining/iu.test(normalized)) return 'Primary'
  if (/manufactur|construction|production|food|hvac|clean technolog/iu.test(normalized)) return 'Secondary'
  if (/service|retail|consult|health|hospitality|education/iu.test(normalized)) return 'Tertiary'
  if (/software|technology|ai|research|information/iu.test(normalized)) return 'Quaternary'
  return ''
}

function normalizeCompanyIndustry(value: string) {
  const normalized = value.trim().toLowerCase()
  const exactMatch = industryOptions.find(
    (industry) => industry.toLowerCase() === normalized,
  )
  if (exactMatch) return exactMatch
  if (/food|manufactur/iu.test(normalized)) return '31-33 Manufacturing'
  if (/hvac|construction|building|retrofit/iu.test(normalized)) return '23 Construction'
  if (/software|technology|ai|information/iu.test(normalized)) {
    return '51 - Information and cultural industries'
  }
  if (/health|medical|clinical/iu.test(normalized)) {
    return '62 - Health care and social assistance'
  }
  return ''
}

function normalizeCompanyPeriods(value: string[] | undefined) {
  const validPeriods = new Set<string>(
    companyPeriodOptions.map((option) => option.value),
  )
  const normalized = Array.isArray(value)
    ? value.filter((period) => validPeriods.has(period))
    : []
  return normalized
}

function normalizeCompanyRecord(company: CompanyRecord): CompanyRecord {
  const normalizedFundingUsage = Array.isArray(company.fundingUsage)
    ? company.fundingUsage.filter((value): value is string =>
        fundingUsageOptions.some((option) => option.value === value),
      )
    : []

  return {
    ...company,
    logo: company.logo || '',
    legalName: company.legalName || '',
    corporationDate: company.corporationDate || '',
    legalStructure: company.legalStructure || '',
    sector: normalizeCompanySector(company.sector || ''),
    industry: normalizeCompanyIndustry(company.industry || ''),
    stage: normalizeCompanyStage(company.stage || ''),
    location: company.location || '',
    website: company.website || '',
    description: company.description || '',
    productsOrServices: company.productsOrServices || '',
    busyPeriods: normalizeCompanyPeriods(company.busyPeriods),
    slowPeriods: normalizeCompanyPeriods(company.slowPeriods),
    mission: company.mission || '',
    vision: company.vision || '',
    values: company.values || '',
    owner: company.owner || '',
    email: company.email || '',
    emailVerified: company.emailVerified ?? false,
    phone: company.phone || '',
    employees: company.employees || '',
    monthlyRevenue: company.monthlyRevenue || '',
    fundingUsage: normalizedFundingUsage,
    teamIntro: company.teamIntro || '',
    teamMembers: company.teamMembers ?? [],
    fundingTarget: company.fundingTarget || '',
    readiness: company.readiness ?? 20,
    status: company.status || 'Draft',
    updatedAt: company.updatedAt || 'Synced from database',
  }
}

function createEmptyCompany(): CompanyRecord {
  return {
    id: `company-${Date.now()}`,
    logo: '',
    name: '',
    legalName: '',
    corporationDate: '',
    legalStructure: '',
    sector: '',
    industry: '',
    stage: 'Launch',
    location: '',
    website: '',
    description: '',
    productsOrServices: '',
    busyPeriods: [],
    slowPeriods: [],
    mission: '',
    vision: '',
    values: '',
    owner: '',
    email: '',
    emailVerified: false,
    phone: '',
    employees: '',
    monthlyRevenue: '',
    fundingUsage: [],
    teamIntro: '',
    teamMembers: [],
    fundingTarget: '',
    readiness: 20,
    status: 'Draft',
    updatedAt: 'Not saved yet',
  }
}

function MyCompanyPage() {
  const { t } = useTranslation()
  const [companies, setCompanies] = useState<CompanyRecord[]>(loadCompanyRecords)
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<'All' | CompanyRecord['status']>('All')
  const [draft, setDraft] = useState<CompanyRecord | null>(null)
  const [isNew, setIsNew] = useState(false)
  const [notice, setNotice] = useState('')
  const [remoteCompaniesLoaded, setRemoteCompaniesLoaded] = useState(false)

  useEffect(() => {
    let cancelled = false

    void loadCompaniesViaApi()
      .then((remoteCompanies) => {
        if (cancelled) return
        const normalizedRemoteCompanies = remoteCompanies.map(normalizeCompanyRecord)
        setCompanies(normalizedRemoteCompanies)
        setRemoteCompaniesLoaded(true)
      })
      .catch(() => {
        // The local cache remains the source of truth when the API is unavailable.
        setRemoteCompaniesLoaded(true)
      })

    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'auto' })
  }, [draft?.id])

  useEffect(() => {
    setPersistentItem(companyStorageKey, JSON.stringify(companies))
  }, [companies])

  useEffect(() => {
    if (!remoteCompaniesLoaded || typeof window === 'undefined' || companies.length === 0) {
      return
    }

    const mode = getClientEnvironmentMode()
    const migrationKey = `bconomics-company-portfolio-latest-fields-v4-${mode}`
    let migratedCompanyIds: string[] = []
    try {
      const stored = window.localStorage.getItem(migrationKey)
      const parsed = stored ? JSON.parse(stored) : []
      migratedCompanyIds = Array.isArray(parsed)
        ? parsed.filter((value): value is string => typeof value === 'string')
        : []
    } catch {
      migratedCompanyIds = []
    }

    const migratedIdSet = new Set(migratedCompanyIds)
    const pendingCompanies = companies.filter((company) => !migratedIdSet.has(company.id))
    if (pendingCompanies.length === 0) return

    void Promise.all(pendingCompanies.map((company) => saveCompanyViaApi(company)))
      .then(() => {
        setPersistentItem(
          migrationKey,
          JSON.stringify([
            ...new Set([
              ...migratedCompanyIds,
              ...pendingCompanies.map((company) => company.id),
            ]),
          ]),
        )
      })
      .catch(() => {
        // Keep the migration retryable when the selected database is unavailable.
      })
  }, [companies, remoteCompaniesLoaded])

  const visibleCompanies = companies.filter((company) => {
    const matchesQuery = `${company.name} ${company.legalName} ${company.sector} ${company.industry} ${company.owner}`
      .toLowerCase()
      .includes(query.trim().toLowerCase())
    return matchesQuery && (filter === 'All' || company.status === filter)
  })

  const averageReadiness = Math.round(
    companies.reduce((total, company) => total + company.readiness, 0) /
      Math.max(companies.length, 1),
  )

  function openCompany(company: CompanyRecord) {
    setDraft({ ...company })
    setIsNew(false)
    setNotice('')
  }

  function updateDraft<Key extends keyof CompanyRecord>(
    field: Key,
    value: CompanyRecord[Key],
  ) {
    setDraft((current) => (current ? { ...current, [field]: value } : current))
    setNotice('')
  }

  function toggleCompanyPeriod(
    field: 'busyPeriods' | 'slowPeriods',
    period: string,
    checked: boolean,
  ) {
    setDraft((current) => {
      if (!current) return current
      const selectedPeriods = current[field] ?? []
      let nextPeriods: string[]
      if (!checked) {
        nextPeriods = selectedPeriods.filter((value) => value !== period)
      } else if (period === 'all-year') {
        nextPeriods = ['all-year']
      } else {
        nextPeriods = [
          ...new Set([
            ...selectedPeriods.filter((value) => value !== 'all-year'),
            period,
          ]),
        ]
      }
      return { ...current, [field]: nextPeriods }
    })
    setNotice('')
  }

  function updateTeamMember(
    index: number,
    field: keyof Omit<CompanyTeamMember, 'id'>,
    value: string,
  ) {
    setDraft((current) => {
      if (!current) return current
      const teamMembers = [...(current.teamMembers ?? [])]
      const member = teamMembers[index]
      if (!member) return current
      teamMembers[index] = { ...member, [field]: value }
      return { ...current, teamMembers }
    })
    setNotice('')
  }

  function addTeamMember() {
    setDraft((current) => {
      if (!current) return current
      return {
        ...current,
        teamMembers: [
          ...(current.teamMembers ?? []),
          {
            id: `team-member-${Date.now()}`,
            name: '',
            title: '',
            responsibilities: '',
          },
        ],
      }
    })
    setNotice('')
  }

  function removeTeamMember(index: number) {
    setDraft((current) => {
      if (!current) return current
      return {
        ...current,
        teamMembers: (current.teamMembers ?? []).filter(
          (_, memberIndex) => memberIndex !== index,
        ),
      }
    })
    setNotice('')
  }

  async function saveCompany() {
    if (!draft) {
      return
    }
    if (
      !draft.name.trim() ||
      !draft.owner.trim() ||
      !draft.email.trim() ||
      !draft.description.trim()
    ) {
      setNotice('Company name, primary contact, email, and description are required.')
      return
    }

    const completedFields = [
      draft.legalName,
      draft.corporationDate,
      draft.legalStructure,
      draft.sector,
      draft.industry,
      draft.location,
      draft.website,
      draft.description,
      draft.productsOrServices,
      draft.busyPeriods?.length ? 'busy periods' : '',
      draft.slowPeriods?.length ? 'slow periods' : '',
      draft.mission,
      draft.vision,
      draft.values,
      draft.phone,
      draft.employees,
      draft.monthlyRevenue,
      draft.fundingUsage?.length ? 'funding usage' : '',
      draft.teamIntro ?? '',
      draft.teamMembers?.length ? 'team members' : '',
    ].filter((value) => value.trim()).length
    const nextRecord: CompanyRecord = {
      ...draft,
      teamIntro: draft.teamIntro ?? '',
      teamMembers: draft.teamMembers ?? [],
      readiness: Math.min(100, 35 + completedFields * 6),
      status: completedFields >= 8 ? 'Active' : 'Needs review',
      updatedAt: 'Updated just now',
    }

    const nextCompanies = isNew
      ? [nextRecord, ...companies]
      : companies.map((company) =>
          company.id === nextRecord.id ? nextRecord : company,
        )
    setCompanies(nextCompanies)
    setPersistentItem(companyStorageKey, JSON.stringify(nextCompanies))
    setDraft(nextRecord)
    setIsNew(false)
    setNotice('Company saved locally. Syncing to the current database...')

    try {
      const syncedCompany = await saveCompanyViaApi(nextRecord)
      const syncedCompanies = nextCompanies.map((company) =>
        company.id === nextRecord.id
          ? { ...nextRecord, ...syncedCompany, logo: syncedCompany.logo || nextRecord.logo }
          : company,
      )
      setCompanies(syncedCompanies)
      setPersistentItem(companyStorageKey, JSON.stringify(syncedCompanies))
      setDraft(syncedCompanies.find((company) => company.name === nextRecord.name) ?? nextRecord)
      setNotice('Company saved and synced to the current database.')
    } catch (error) {
      setNotice(
        `Company saved locally. Database sync failed: ${
          error instanceof Error ? error.message : 'Please try again.'
        }`,
      )
    }
  }

  function uploadLogo(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) {
      return
    }

    const allowedTypes = ['image/png', 'image/jpeg', 'image/webp']
    if (!allowedTypes.includes(file.type)) {
      setNotice('Upload a PNG, JPEG, or WebP logo.')
      return
    }
    if (file.size > 2 * 1024 * 1024) {
      setNotice('The logo must be smaller than 2 MB.')
      return
    }

    const reader = new FileReader()
    reader.addEventListener('load', () => {
      if (typeof reader.result === 'string') {
        updateDraft('logo', reader.result)
        setNotice('Logo added. Save the company to keep this change.')
      }
    })
    reader.addEventListener('error', () => {
      setNotice('The logo could not be read. Please try another image.')
    })
    reader.readAsDataURL(file)
  }

  if (draft) {
    return (
      <section className="company-editor">
        <header className="company-editor-header">
          <div>
            <button type="button" onClick={() => setDraft(null)}>
              <Glyph type="arrow" />
              Back to companies
            </button>
          <p className="workspace-eyebrow">{isNew ? t('workspacePages.myCompanies.addCompany') : t('settings.profile')}</p>
            <h1>{draft.name || 'Untitled company'}</h1>
            <p>Manage the company information used for matching, applications, and generated documents.</p>
          </div>
          <button type="button" className="workspace-primary-action" onClick={saveCompany}>
            <Glyph type="file" />
            Save company
          </button>
        </header>

        {notice ? (
          <div
            className={`company-editor-notice ${
              notice.includes('successfully') || notice.startsWith('Logo ')
                ? 'is-success'
                : ''
            }`}
            role="status"
          >
            {notice}
          </div>
        ) : null}

        <div className="company-editor-layout">
          <aside className="company-profile-summary">
            <div className="company-logo-editor">
              <div className={`company-avatar ${draft.logo ? 'has-logo' : ''}`}>
                {draft.logo ? (
                  <img src={draft.logo} alt={`${draft.name || 'Company'} logo`} />
                ) : (
                  (draft.name || 'C').charAt(0)
                )}
              </div>
              <div className="company-logo-actions">
                <label>
                  <Glyph type="file" />
                  {draft.logo ? 'Replace logo' : 'Upload logo'}
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    onChange={uploadLogo}
                  />
                </label>
                {draft.logo ? (
                  <button
                    type="button"
                    onClick={() => {
                      updateDraft('logo', '')
                      setNotice('Logo removed. Save the company to keep this change.')
                    }}
                  >
                    Remove
                  </button>
                ) : null}
              </div>
              <small>PNG, JPEG or WebP · max 2 MB</small>
            </div>
            <h2>{draft.name || 'New company'}</h2>
            <p>{draft.legalName || 'Legal name not entered'}</p>
            <span className={`company-status status-${draft.status.toLowerCase().replace(' ', '-')}`}>
              {draft.status}
            </span>
            <div className="company-profile-score">
              <span style={{ '--company-score': `${draft.readiness}%` } as CSSProperties}>
                <b>{draft.readiness}</b>
              </span>
              <div>
                <strong>Profile readiness</strong>
                <small>Complete details to improve funding matches.</small>
              </div>
            </div>
            <dl>
              <div><dt>Industry</dt><dd>{draft.industry || 'Not set'}</dd></div>
              <div><dt>Sector</dt><dd>{draft.sector || 'Not set'}</dd></div>
              <div><dt>Legal structure</dt><dd>{draft.legalStructure || 'Not set'}</dd></div>
              <div><dt>Stage</dt><dd>{draft.stage}</dd></div>
              <div><dt>Location</dt><dd>{draft.location || 'Not set'}</dd></div>
              <div><dt>Last activity</dt><dd>{draft.updatedAt}</dd></div>
            </dl>
          </aside>

          <div className="company-editor-sections">
            <section className="company-form-card">
              <div className="company-form-heading">
                <span>01</span>
                <div>
                  <h2>Business identity</h2>
                  <p>Legal and operating information for this company.</p>
                </div>
              </div>
              <div className="company-form-grid">
                <label>
                  <span>Operating name *</span>
                  <input value={draft.name} onChange={(event) => updateDraft('name', event.target.value)} />
                </label>
                <label>
                  <span>Legal business name</span>
                  <input value={draft.legalName} onChange={(event) => updateDraft('legalName', event.target.value)} />
                </label>
                <label>
                  <span>Corporation Date (year and month)</span>
                  <input type="month" value={draft.corporationDate} onChange={(event) => updateDraft('corporationDate', event.target.value)} />
                </label>
                <label>
                  <span>Website</span>
                  <input value={draft.website} onChange={(event) => updateDraft('website', event.target.value)} />
                </label>
                <label>
                  <span>Legal structure</span>
                  <select value={draft.legalStructure} onChange={(event) => updateDraft('legalStructure', event.target.value)}>
                    <option value="">Choose a structure...</option>
                    <option>Corporation</option>
                    <option>Sole proprietorship</option>
                    <option>Partnership</option>
                    <option>Co-operative</option>
                    <option>Non-profit</option>
                    <option>Other</option>
                  </select>
                </label>
                <label>
                  <span>Sector</span>
                  <select value={draft.sector} onChange={(event) => updateDraft('sector', event.target.value)}>
                    <option value="">Choose a sector...</option>
                    {sectorOptions.map((sector) => (
                      <option key={sector} value={sector}>{sector}</option>
                    ))}
                  </select>
                </label>
                <label>
                  <span>Industry</span>
                  <select value={draft.industry} onChange={(event) => updateDraft('industry', event.target.value)}>
                    <option value="">Choose an industry...</option>
                    {industryOptions.map((industry) => (
                      <option key={industry} value={industry}>{industry}</option>
                    ))}
                  </select>
                </label>
                <label>
                  <span>Business stage</span>
                  <select value={draft.stage} onChange={(event) => updateDraft('stage', event.target.value)}>
                    <option>Launch</option>
                    <option>Growth</option>
                    <option>Maturity</option>
                    <option>Decline</option>
                  </select>
                </label>
                <label className="company-field-wide">
                  <span>Primary location</span>
                  <input value={draft.location} onChange={(event) => updateDraft('location', event.target.value)} />
                </label>
              </div>
            </section>

            <section className="company-form-card">
              <div className="company-form-heading">
                <span>02</span>
                <div>
                  <h2>Business profile</h2>
                  <p>Describe what the company does and why it is different.</p>
                </div>
              </div>
              <div className="company-form-content">
                <label className="company-description-field">
                  <span>Company description</span>
                  <textarea
                    value={draft.description}
                    onChange={(event) => updateDraft('description', event.target.value)}
                    placeholder="Products, customers, business model, and competitive advantage."
                  />
                  <small>{draft.description.length} characters</small>
                </label>
                <label className="company-description-field company-products-field">
                  <span>Products or services</span>
                  <textarea
                    value={draft.productsOrServices}
                    onChange={(event) => updateDraft('productsOrServices', event.target.value)}
                    placeholder="Describe what you sell, pricing, delivery model, and estimated margin."
                  />
                  <small>{draft.productsOrServices.length} characters</small>
                </label>
                <div className="company-seasonality-grid">
                  {(['busyPeriods', 'slowPeriods'] as const).map((field) => {
                    const selectedPeriods = draft[field] ?? []
                    const label = field === 'busyPeriods' ? 'Busy periods' : 'Slow periods'
                    return (
                      <div className="company-seasonality-field" key={field}>
                        <span>{label}</span>
                        <p>Select all that apply.</p>
                      <div className="company-period-options">
                        {companyPeriodOptions.map((option) => {
                          const isSelected = selectedPeriods.includes(option.value)
                          const hasAllYear = selectedPeriods.includes('all-year')
                          const hasMonthSelection = selectedPeriods.some(
                            (period) => period !== 'all-year',
                          )
                          const isDisabled = option.value === 'all-year'
                            ? hasMonthSelection
                            : hasAllYear
                          return (
                            <label
                              className={`${isSelected ? 'is-selected' : ''} ${isDisabled ? 'is-disabled' : ''}`.trim()}
                              key={option.value}
                            >
                              <input
                                type="checkbox"
                                checked={isSelected}
                                disabled={isDisabled}
                                onChange={(event) =>
                                  toggleCompanyPeriod(field, option.value, event.target.checked)
                                }
                                />
                                <span>{option.label}</span>
                              </label>
                            )
                          })}
                        </div>
                      </div>
                    )
                  })}
                </div>
                <div className="company-form-grid company-profile-fields">
                  <label className="company-description-field company-field-wide">
                    <span>Mission</span>
                    <textarea value={draft.mission} onChange={(event) => updateDraft('mission', event.target.value)} placeholder="What the company exists to do." />
                  </label>
                  <label className="company-description-field company-field-wide">
                    <span>Vision</span>
                    <textarea value={draft.vision} onChange={(event) => updateDraft('vision', event.target.value)} placeholder="The future the company is working to create." />
                  </label>
                  <label className="company-description-field company-field-wide">
                    <span>Values</span>
                    <textarea value={draft.values} onChange={(event) => updateDraft('values', event.target.value)} placeholder="The principles that guide decisions and behaviour." />
                  </label>
                </div>
                <div className="company-form-grid company-profile-fields">
                  <label className="company-field-wide">
                    <span>Monthly revenue</span>
                    <input
                      inputMode="numeric"
                      value={draft.monthlyRevenue}
                      onChange={(event) => updateDraft('monthlyRevenue', event.target.value)}
                    />
                  </label>
                  <div className="company-funding-usage company-field-wide" role="group" aria-labelledby="funding-usage-label">
                    <span id="funding-usage-label">Funding usage</span>
                    <p>Select all planned uses of funding.</p>
                    <div className="company-funding-usage-options">
                      {fundingUsageOptions.map((option) => {
                        const isSelected = (draft.fundingUsage ?? []).includes(option.value)
                        return (
                          <label
                            className={isSelected ? 'is-selected' : ''}
                            key={option.value}
                          >
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={(event) => {
                                const currentUsage = draft.fundingUsage ?? []
                                const nextUsage = event.target.checked
                                  ? [...new Set([...currentUsage, option.value])]
                                  : currentUsage.filter((value) => value !== option.value)
                                updateDraft('fundingUsage', nextUsage)
                              }}
                            />
                            <span>{option.label}</span>
                          </label>
                        )
                      })}
                    </div>
                  </div>
                </div>
              </div>
            </section>

            <section className="company-form-card">
              <div className="company-form-heading">
                <span>03</span>
                <div>
                  <h2>Primary contact</h2>
                  <p>The person responsible for company and funding information.</p>
                </div>
              </div>
              <div className="company-form-grid">
                <label>
                  <span>Full name *</span>
                  <input value={draft.owner} onChange={(event) => updateDraft('owner', event.target.value)} />
                </label>
                <div className="company-email-field">
                  <label>
                    <span>Email address *</span>
                    <input type="email" value={draft.email} onChange={(event) => updateDraft('email', event.target.value)} />
                  </label>
                  <span
                    className={`company-email-status ${draft.emailVerified ? 'is-verified' : 'is-unverified'}`}
                    role="status"
                  >
                    {draft.emailVerified ? 'Verified' : 'Verify'}
                  </span>
                </div>
                <label className="company-field-wide">
                  <span>Phone number</span>
                  <input value={draft.phone} onChange={(event) => updateDraft('phone', event.target.value)} />
                </label>
              </div>
            </section>

            <section className="company-form-card">
              <div className="company-form-heading">
                <span>04</span>
                <div>
                  <h2>Team intro</h2>
                  <p>Introduce the people responsible for the company and its execution.</p>
                </div>
              </div>
              <div className="company-team-editor">
                <div className="company-form-grid">
                  <label>
                    <span>Number of full-time employees</span>
                    <input
                      inputMode="numeric"
                      value={draft.employees}
                      onChange={(event) => updateDraft('employees', event.target.value)}
                    />
                  </label>
                </div>
                <label className="company-description-field">
                  <span>Team introduction</span>
                  <textarea
                    value={draft.teamIntro ?? ''}
                    onChange={(event) => updateDraft('teamIntro', event.target.value)}
                    placeholder="How the team works together and why it can execute this plan."
                  />
                  <small>{(draft.teamIntro ?? '').length} characters</small>
                </label>
                <div className="company-team-members">
                  <div className="company-team-members-heading">
                    <div>
                      <strong>Team members</strong>
                      <small>Add the people and responsibilities behind the company.</small>
                    </div>
                    <button type="button" onClick={addTeamMember}>Add employee</button>
                  </div>
                  {(draft.teamMembers ?? []).map((member, index) => (
                    <div className="company-team-member" key={member.id}>
                      <div className="company-team-member-heading">
                        <strong>Employee {index + 1}</strong>
                        <button type="button" onClick={() => removeTeamMember(index)}>Remove</button>
                      </div>
                      <div className="company-form-grid">
                        <label>
                          <span>Employee introduction</span>
                          <input
                            value={member.name}
                            onChange={(event) => updateTeamMember(index, 'name', event.target.value)}
                            placeholder="e.g. Ava Lin"
                          />
                        </label>
                        <label>
                          <span>Title</span>
                          <input
                            value={member.title}
                            onChange={(event) => updateTeamMember(index, 'title', event.target.value)}
                            placeholder="e.g. Founder and CEO"
                          />
                        </label>
                        <label className="company-field-wide">
                          <span>Responsibilities</span>
                          <textarea
                            value={member.responsibilities}
                            onChange={(event) => updateTeamMember(index, 'responsibilities', event.target.value)}
                            placeholder="Describe this person's role and key responsibilities."
                          />
                        </label>
                      </div>
                    </div>
                  ))}
                  {(draft.teamMembers ?? []).length === 0 ? (
                    <p className="company-team-members-empty">No team members added yet.</p>
                  ) : null}
                </div>
              </div>
            </section>
          </div>
        </div>
      </section>
    )
  }

  return (
    <section className="company-manager">
      <header className="workspace-listing-header is-my-companies-topbar">
        <div className="workspace-listing-heading">
          <h1>{t('workspacePages.myCompanies.title')}</h1>
          <p>{t('workspacePages.myCompanies.description')}</p>
        </div>
        <button
          type="button"
          className="workspace-primary-action"
          onClick={() => {
            setDraft(createEmptyCompany())
            setIsNew(true)
            setNotice('')
          }}
        >
          <Glyph type="spark" />
          {t('workspacePages.myCompanies.addCompany')}
        </button>
      </header>

      <div className="company-portfolio-metrics">
        <article>
          <span>{t('workspacePages.myCompanies.companies')}</span>
          <strong>{companies.length}</strong>
          <small>{companies.filter((company) => company.status === 'Active').length} {t('workspacePages.myCompanies.activeProfiles')}</small>
        </article>
        <article>
          <span>{t('workspacePages.myCompanies.averageReadiness')}</span>
          <strong>{averageReadiness}%</strong>
          <small>{t('workspacePages.myCompanies.acrossPortfolio')}</small>
        </article>
        <article className="is-attention">
          <span>{t('workspacePages.myCompanies.needsAttention')}</span>
          <strong>{companies.filter((company) => company.status !== 'Active').length}</strong>
          <small>{t('workspacePages.myCompanies.incompleteProfiles')}</small>
        </article>
      </div>

      <section className="company-portfolio-panel">
        <div className="company-portfolio-heading">
          <div>
            <p className="workspace-eyebrow">{t('workspacePages.myCompanies.portfolio')}</p>
            <h2>{t('workspacePages.myCompanies.allCompanies')}</h2>
          </div>
          <span>{visibleCompanies.length} {t('workspacePages.common.companies')}</span>
        </div>
        <div className="company-portfolio-toolbar">
          <label>
            <Glyph type="search" />
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={t('workspacePages.myCompanies.search')}
            />
          </label>
          <div>
            {(['All', 'Active', 'Needs review', 'Draft'] as const).map((status) => (
              <button
                key={status}
                type="button"
                className={filter === status ? 'is-selected' : ''}
                onClick={() => setFilter(status)}
              >
                {status}
              </button>
            ))}
          </div>
        </div>
        <div className="company-card-grid">
          {visibleCompanies.map((company) => (
            <button
              key={company.id}
              type="button"
              className="company-card"
              onClick={() => openCompany(company)}
            >
              <span className="company-card-top">
                <b className={company.logo ? 'has-logo' : ''}>
                  {company.logo ? (
                    <img src={company.logo} alt={`${company.name} logo`} />
                  ) : (
                    company.name.charAt(0)
                  )}
                </b>
                <i className={`status-${company.status.toLowerCase().replace(' ', '-')}`}>
                  {company.status}
                </i>
              </span>
              <span className="company-card-copy">
                <strong>{company.name}</strong>
                <small>{company.legalName}</small>
              </span>
              <span className="company-card-details">
                <small><Glyph type="grid" /> {company.industry}</small>
                <small><Glyph type="user" /> {company.owner}</small>
              </span>
              <span className="company-card-readiness">
                <span><b>{company.readiness}%</b><small>Profile readiness</small></span>
                <i><em style={{ width: `${company.readiness}%` }} /></i>
              </span>
              <span className="company-card-footer">
                <small>{company.updatedAt}</small>
                <b>Edit company <Glyph type="arrow" /></b>
              </span>
            </button>
          ))}
        </div>

        {visibleCompanies.length === 0 ? (
          <div className="workspace-empty">
            <span><Glyph type="search" /></span>
            <strong>{t('workspacePages.myCompanies.noCompanies')}</strong>
            <p>{t('workspacePages.myCompanies.searchHint')}</p>
            <button type="button" onClick={() => { setQuery(''); setFilter('All') }}>
              {t('workspacePages.common.clearFilters')}
            </button>
          </div>
        ) : null}
      </section>
    </section>
  )
}

type ScoutingScore = {
  label: string
  score: number
  weight: number
  explanation: string
}

function splitScoutingList(value: string | undefined, fallback: string) {
  const normalized = value?.trim()
  return normalized ? [normalized] : [fallback]
}

function parseCompanyRevenue(company: CompanyRecord) {
  const value = Number(company.monthlyRevenue.replace(/[^0-9.-]/gu, ''))
  return Number.isFinite(value) ? Math.max(0, value) : 0
}

const scoutingFundingUsageLabels = new Map<string, string>(
  fundingUsageOptions.map((option) => [option.value, option.label]),
)

function formatCompanyPeriods(periods: string[]) {
  if (periods.includes('all-year')) return 'All year'
  return periods
    .map((period) => period.charAt(0).toUpperCase() + period.slice(1))
    .join(', ')
}

function calculateProgramCompanyMatch(program: FundingProgramRecord, company: CompanyRecord) {
  const programText = [
    program.eligibility,
    program.eligibleUses,
    program.targetCompanyTypes,
    program.requiredEvidence,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()
  const companyText = [
    company.industry,
    company.sector,
    company.stage,
    company.description,
    company.productsOrServices,
    company.mission,
    company.vision,
    company.values,
    company.teamIntro,
    company.fundingUsage.join(' '),
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()
  const companyLocation = company.location.trim().toLowerCase()
  const programLocation = program.location.trim().toLowerCase()
  const locationScore =
    programLocation === 'canada' ||
    (programLocation.length > 0 && companyLocation.includes(programLocation))
      ? 100
      : 45
  const incorporationScore = programText.includes('incorporated')
    ? company.legalStructure.trim() ? 100 : 45
    : 75
  const stageScore =
    (/(startup|early-stage|launch)/u.test(programText) && company.stage === 'Launch') ||
    (/(revenue-generating|established|operating history|growth)/u.test(programText) &&
      (company.stage === 'Growth' || company.stage === 'Maturity'))
      ? 100
      : 72
  const digitalProgram = /(digital|technology|cybersecurity|software)/u.test(programText)
  const digitalCompany = /(information|technology|software|ai|digital|engineering)/u.test(companyText)
  const industrialProgram = /(equipment|production|manufactur|construction|expansion)/u.test(programText)
  const industrialCompany = /(manufactur|construction|hvac|food|production|equipment)/u.test(companyText)
  const industryScore = digitalProgram && digitalCompany
    ? 100
    : industrialProgram && industrialCompany
      ? 100
      : 72
  const usageTerms: Record<string, RegExp> = {
    equipment: /(equipment|capital|tools)/u,
    inventory: /(inventory|working capital|stock)/u,
    hiring: /(hiring|hire|staff|employee|talent)/u,
    advertising: /(marketing|advertis|customer acquisition|market development)/u,
    rent: /(rent|operating cost|working capital)/u,
    payroll: /(payroll|salary|wage|working capital)/u,
  }
  const matchedUsageCount = company.fundingUsage.filter(
    (usage) => usageTerms[usage]?.test(program.eligibleUses?.toLowerCase() ?? ''),
  ).length
  const usageScore = company.fundingUsage.length === 0
    ? 45
    : matchedUsageCount > 0
      ? Math.min(100, 70 + matchedUsageCount * 15)
      : 55
  const evidenceFields = [
    company.legalName,
    company.corporationDate,
    company.legalStructure,
    company.industry,
    company.description,
    company.productsOrServices,
    company.mission,
    company.teamIntro,
    company.teamMembers.length ? 'team' : '',
  ]
  const evidenceScore = Math.round(
    (evidenceFields.filter((field) => field.trim()).length / evidenceFields.length) * 100,
  )

  return Math.round(
    locationScore * 0.25 +
      incorporationScore * 0.15 +
      stageScore * 0.15 +
      industryScore * 0.2 +
      usageScore * 0.15 +
      evidenceScore * 0.1,
  )
}

function calculateScoutingScores(
  program: FundingProgramRecord,
  company: CompanyRecord,
  application: ApplicationRecord | null,
) {
  const programLocation = program.location.trim().toLowerCase()
  const companyLocation = company.location.trim().toLowerCase()
  const locationScore =
    programLocation === 'canada' ||
    (programLocation.length > 0 && companyLocation.includes(programLocation))
      ? 100
      : 55
  const revenue = parseCompanyRevenue(company)
  const financialScore = revenue > 0 ? Math.min(100, 60 + Math.round(revenue / 5000)) : 35
  const companyProgramMatch = calculateProgramCompanyMatch(program, company)
  const profileFields = [
    company.description,
    company.mission,
    company.vision,
    company.values,
    company.legalStructure,
    company.sector,
    company.corporationDate,
    company.teamIntro,
    company.owner,
  ]
  const profileEvidenceScore = Math.round(
    (profileFields.filter((field) => field.trim()).length / profileFields.length) * 100,
  )
  const evidenceScore = application?.progress ?? profileEvidenceScore
  const scores: ScoutingScore[] = [
    {
      label: 'Eligibility fit',
      score: locationScore,
      weight: 30,
      explanation:
        locationScore >= 80
          ? `${company.location || 'Company location'} aligns with ${program.location}.`
          : `Program coverage is ${program.location}; confirm location eligibility before applying.`,
    },
    {
      label: 'Program fit',
      score: companyProgramMatch,
      weight: 25,
      explanation: `Program requirements and company profile align at ${companyProgramMatch}%.`,
    },
    {
      label: 'Company readiness',
      score: company.readiness,
      weight: 20,
      explanation: `${company.name} profile readiness is ${company.readiness}%.`,
    },
    {
      label: 'Financial capacity',
      score: financialScore,
      weight: 15,
      explanation:
        revenue > 0
          ? `Monthly revenue is CAD ${revenue.toLocaleString('en-CA')}.`
          : 'Monthly revenue has not been provided.',
    },
    {
      label: 'Evidence readiness',
      score: evidenceScore,
      weight: 10,
      explanation: application
        ? `Linked application is ${application.progress}% complete.`
        : `Company profile evidence is ${profileEvidenceScore}% complete.`,
    },
  ]
  const overall = Math.round(
    scores.reduce((total, item) => total + item.score * (item.weight / 100), 0),
  )

  return { scores, overall }
}

function getScoutingTone(score: number) {
  if (score >= 85) return 'excellent'
  if (score >= 70) return 'strong'
  if (score >= 55) return 'watch'
  return 'weak'
}

function FundingReadinessPage() {
  const { t } = useTranslation()
  const { config } = usePlatformConfig()
  const location = useLocation()
  const enabledSourceIds = config.dataSources
    .filter((source) => source.enabled && source.module === 'grants-loans')
    .map((source) => source.id)
  const programs = loadFundingPrograms(enabledSourceIds)
  const companies = loadCompanyRecords()
  const applications = loadApplications()
  const settings = loadUserSettings()
  const query = new URLSearchParams(location.search)
  const [selectedProgramId, setSelectedProgramId] = useState(
    query.get('program_id') ?? programs[0]?.id ?? '',
  )
  const [programTransitionDirection, setProgramTransitionDirection] = useState<
    'next' | 'previous'
  >('next')
  const [selectedCompanyId, setSelectedCompanyId] = useState(
    query.get('company_id') ?? settings.defaultCompanyId ?? companies[0]?.id ?? '',
  )

  useEffect(() => {
    if (!programs.some((program) => program.id === selectedProgramId)) {
      setSelectedProgramId(programs[0]?.id ?? '')
    }
  }, [programs, selectedProgramId])

  useEffect(() => {
    if (!companies.some((company) => company.id === selectedCompanyId)) {
      setSelectedCompanyId(companies[0]?.id ?? '')
    }
  }, [companies, selectedCompanyId])

  const selectedProgram =
    programs.find((program) => program.id === selectedProgramId) ?? programs[0] ?? null
  const selectedCompany =
    companies.find((company) => company.id === selectedCompanyId) ?? companies[0] ?? null
  const matchingApplication = selectedProgram && selectedCompany
    ? applications.find(
        (application) =>
          application.programName === selectedProgram.name &&
          application.company === selectedCompany.name,
      ) ?? null
    : null

  if (!selectedProgram || !selectedCompany) {
    return (
      <section className="scouting-page">
        <header className="scouting-header is-discovery-topbar">
          <div>
          <h1>{t('workspacePages.discovery.title')}</h1>
            <p>{t('workspacePages.discovery.description')}</p>
          </div>
          <Link className="scouting-header-action" to="/grants-loans">
            {t('workspacePages.discovery.browsePrograms')} <Glyph type="arrow" />
          </Link>
        </header>
        <div className="scouting-empty-state">
          <Glyph type="search" />
          <strong>{t('workspacePages.discovery.notEnoughData')}</strong>
          <p>{t('workspacePages.discovery.catalogAndCompanies')}</p>
        </div>
      </section>
    )
  }

  const scouting = calculateScoutingScores(
    selectedProgram,
    selectedCompany,
    matchingApplication,
  )
  const tone = getScoutingTone(scouting.overall)
  const conclusionKey = scouting.overall >= 85
    ? 'strongFit'
    : scouting.overall >= 70
      ? 'promisingFit'
      : scouting.overall >= 55
        ? 'needsEvidence'
        : 'weakFit'
  const conclusion = t(`workspacePages.discovery.${conclusionKey}`)
  const strengths = [
    scouting.scores[0].score >= 80 ? `${selectedCompany.location} is inside the program's coverage area.` : '',
    scouting.scores[1].score >= 85 ? `The catalog identifies ${selectedProgram.name} as a strong program match.` : '',
    scouting.scores[2].score >= 80 ? `${selectedCompany.name} has a strong company profile.` : '',
    parseCompanyRevenue(selectedCompany) > 0 ? 'The company has reported operating revenue.' : '',
    matchingApplication && matchingApplication.progress >= 80 ? 'A linked application is already close to submission readiness.' : '',
  ].filter(Boolean)
  const gaps = [
    scouting.scores[0].score < 80 ? `Confirm that the company is eligible in ${selectedProgram.location}.` : '',
    !selectedCompany.corporationDate ? 'Add the corporation date and incorporation evidence.' : '',
    parseCompanyRevenue(selectedCompany) === 0 ? 'Add monthly revenue and financial assumptions.' : '',
    !selectedCompany.teamIntro ? 'Add a team introduction so the reviewer can assess execution capacity.' : '',
    matchingApplication && matchingApplication.progress < 85
      ? `Complete the linked application, currently at ${matchingApplication.progress}%.`
      : !matchingApplication
        ? 'No application evidence is linked to this program and company yet.'
        : '',
  ].filter(Boolean)
  const nextPath = matchingApplication
    ? getQuickBuildPath(matchingApplication.id, selectedCompany.id)
    : getQuickBuildMatchPath(selectedProgram.id, selectedCompany.id)
  const programRequirements = splitScoutingList(
    selectedProgram.eligibility,
    'Detailed eligibility requirements have not been provided by this program source.',
  )
  const eligibleUses = splitScoutingList(
    selectedProgram.eligibleUses,
    'Eligible uses have not been provided by this program source.',
  )
  const targetCompanyTypes = splitScoutingList(
    selectedProgram.targetCompanyTypes,
    'Target company types have not been provided by this program source.',
  )
  const requiredEvidence = splitScoutingList(
    selectedProgram.requiredEvidence,
    'Required evidence has not been provided by this program source.',
  )
  const selectedCompanyFundingUsage = selectedCompany.fundingUsage
    .map((usage) => scoutingFundingUsageLabels.get(usage) ?? usage)
    .join(', ')
  const selectedProgramIndex = Math.max(
    0,
    programs.findIndex((program) => program.id === selectedProgram.id),
  )
  function changeProgram(offset: number) {
    if (programs.length < 2) return
    setProgramTransitionDirection(offset > 0 ? 'next' : 'previous')
    const nextIndex = selectedProgramIndex + offset
    if (nextIndex < 0 || nextIndex >= programs.length) return
    setSelectedProgramId(programs[nextIndex].id)
  }
  const previousProgram = programs[selectedProgramIndex - 1]
  const nextProgram = programs[selectedProgramIndex + 1]

  return (
    <section className="scouting-page">
      <header className="scouting-header is-discovery-topbar">
        <div>
          <h1>{t('workspacePages.discovery.title')}</h1>
          <p>{t('workspacePages.discovery.description')}</p>
        </div>
        <Link className="scouting-header-action" to="/grants-loans">
          {t('workspacePages.discovery.browsePrograms')} <Glyph type="arrow" />
        </Link>
      </header>

      <div className="scouting-report-stage">
        {previousProgram || nextProgram ? (
          <>
            {previousProgram ? (
              <div className="scouting-card-peek is-previous" aria-hidden="true">
                <span>{previousProgram.name}</span>
              </div>
            ) : null}
            {nextProgram ? (
              <div className="scouting-card-peek is-next" aria-hidden="true">
                <span>{nextProgram.name}</span>
              </div>
            ) : null}
          </>
        ) : null}
        <article
          key={selectedProgram.id}
          className={`scouting-report-card is-transition-${programTransitionDirection}`}
        >
        <header className="scouting-report-card-header">
          <div className="scouting-report-card-title">
            <span>{t('workspacePages.discovery.programMatching')}</span>
            <h2>{selectedProgram.name}</h2>
          </div>
          <div className="scouting-program-pager" aria-label={t('workspacePages.discovery.programMatching')}>
            <button type="button" onClick={() => changeProgram(-1)} disabled={selectedProgramIndex === 0}>
              <span aria-hidden="true">‹</span> {t('workspacePages.discovery.previous')}
            </button>
            <strong>{selectedProgramIndex + 1} / {programs.length}</strong>
            <button type="button" onClick={() => changeProgram(1)} disabled={selectedProgramIndex === programs.length - 1}>
              {t('workspacePages.discovery.next')} <span aria-hidden="true">›</span>
            </button>
          </div>
          <label className="scouting-company-selector">
            <span>{t('workspacePages.discovery.company')}</span>
            <select value={selectedCompany.id} onChange={(event) => setSelectedCompanyId(event.target.value)}>
              {companies.map((company) => (
                <option key={company.id} value={company.id}>{company.name}</option>
              ))}
            </select>
          </label>
        </header>

        <section className={`scouting-hero is-${tone}`}>
        <div
          className="scouting-score-badge"
          style={{ '--score-progress': `${scouting.overall}%` } as CSSProperties}
          aria-label={`${t('workspacePages.discovery.matchScore')} ${scouting.overall} / 100`}
        >
          <span>{t('workspacePages.discovery.matchScore')}</span>
          <div className="scouting-score-value">
            <strong>{scouting.overall}</strong>
            <small>/100</small>
          </div>
        </div>
        <div className="scouting-hero-copy">
          <span className="scouting-fit-badge">{conclusion}</span>
          <h2>{selectedProgram.name} × {selectedCompany.name}</h2>
          <p>
            {scouting.overall >= 70
              ? t('workspacePages.discovery.credibleRoute')
              : t('workspacePages.discovery.needsEvidenceBeforePriority')}
          </p>
          <div className="scouting-hero-meta">
            <span><strong>{selectedProgram.provider}</strong> provider</span>
            <span><strong>{selectedProgram.type}</strong> funding type</span>
            <span><strong>{selectedProgram.location}</strong> coverage</span>
          </div>
        </div>
        <div className="scouting-verdict">
          <span>{t('workspacePages.discovery.scoutVerdict')}</span>
          <strong>{gaps.length ? t('workspacePages.discovery.buildEvidence') : t('workspacePages.discovery.readyToBuild')}</strong>
          <p>{t('workspacePages.discovery.gapsToClose', { count: gaps.length, suffix: gaps.length === 1 ? '' : 's' })}</p>
        </div>
        </section>

        <div className="scouting-profile-grid">
        <article className="scouting-card">
          <div className="scouting-card-heading">
            <div>
              <span>{t('workspacePages.discovery.fundingProgramProfile')}</span>
              <h2>{selectedProgram.name}</h2>
            </div>
            <a href={selectedProgram.url} target="_blank" rel="noreferrer">{t('workspacePages.discovery.officialSource')} <Glyph type="arrow" /></a>
          </div>
          <dl className="scouting-facts">
            <div><dt>{t('workspacePages.discovery.provider')}</dt><dd>{selectedProgram.provider}</dd></div>
            <div><dt>{t('workspacePages.discovery.maximumFunding')}</dt><dd>{formatDashboardCurrency(selectedProgram.amount)}</dd></div>
            <div><dt>{t('workspacePages.discovery.deadline')}</dt><dd>{selectedProgram.deadline}</dd></div>
            <div><dt>{t('workspacePages.discovery.programCoverage')}</dt><dd>{selectedProgram.location}</dd></div>
          </dl>
          <div className="scouting-detail-columns">
            <div><h3>{t('workspacePages.discovery.requirements')}</h3><ul>{programRequirements.map((item) => <li key={item}>{item}</li>)}</ul></div>
            <div><h3>{t('workspacePages.discovery.eligibleUses')}</h3><ul>{eligibleUses.map((item) => <li key={item}>{item}</li>)}</ul></div>
          </div>
          <div className="scouting-detail-block"><h3>{t('workspacePages.discovery.bestSuitedTo')}</h3><p>{targetCompanyTypes[0]}</p></div>
          <div className="scouting-detail-block"><h3>{t('workspacePages.discovery.requiredEvidence')}</h3><p>{requiredEvidence[0]}</p></div>
        </article>

        <article className="scouting-card scouting-company-card">
          <div className="scouting-card-heading">
            <div>
              <span>{t('workspacePages.discovery.companyProfile')}</span>
              <h2>{selectedCompany.name}</h2>
            </div>
            <Link to="/my-companies">{t('workspacePages.discovery.editCompany')} <Glyph type="arrow" /></Link>
          </div>
          <p className="scouting-company-description">{selectedCompany.description || 'No company description has been added yet.'}</p>
          <dl className="scouting-facts">
            <div><dt>Legal structure</dt><dd>{selectedCompany.legalStructure || 'Not provided'}</dd></div>
            <div><dt>Sector</dt><dd>{selectedCompany.sector || 'Not provided'}</dd></div>
            <div><dt>Industry</dt><dd>{selectedCompany.industry || 'Not provided'}</dd></div>
            <div><dt>Stage</dt><dd>{selectedCompany.stage || 'Not provided'}</dd></div>
            <div><dt>Corporation date</dt><dd>{selectedCompany.corporationDate || 'Not provided'}</dd></div>
            <div><dt>Location</dt><dd>{selectedCompany.location || 'Not provided'}</dd></div>
            <div><dt>Monthly revenue</dt><dd>{formatDashboardCurrency(parseCompanyRevenue(selectedCompany))}</dd></div>
            <div><dt>Number of full-time employees</dt><dd>{selectedCompany.employees || 'Not provided'}</dd></div>
            <div><dt>Profile readiness</dt><dd>{selectedCompany.readiness}%</dd></div>
          </dl>
          <div className="scouting-company-detail-grid">
            <div className="scouting-company-note">
              <span>Products or services</span>
              <p>{selectedCompany.productsOrServices || 'No products or services have been added yet.'}</p>
            </div>
            <div className="scouting-company-note">
              <span>Funding usage</span>
              <p>{selectedCompanyFundingUsage || 'No funding usage has been selected yet.'}</p>
            </div>
            <div className="scouting-company-note">
              <span>Mission and vision</span>
              <p>{selectedCompany.mission || 'No mission has been added yet.'}</p>
              <p>{selectedCompany.vision || 'No vision has been added yet.'}</p>
            </div>
            <div className="scouting-company-note">
              <span>Busy and slow periods</span>
              <p>Busy: {formatCompanyPeriods(selectedCompany.busyPeriods) || 'Not provided'}</p>
              <p>Slow: {formatCompanyPeriods(selectedCompany.slowPeriods) || 'Not provided'}</p>
            </div>
          </div>
          <div className="scouting-company-note">
            <span>Values and team</span>
            <p>{selectedCompany.values || 'No values have been added yet.'}</p>
            <p>{selectedCompany.teamIntro || 'No team introduction has been added yet.'}</p>
            {selectedCompany.teamMembers.length > 0 ? (
              <ul className="scouting-team-list">
                {selectedCompany.teamMembers.map((member) => (
                  <li key={member.id}>
                    <strong>{member.name}</strong>
                    <span>{member.title} · {member.responsibilities}</span>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
          {matchingApplication ? (
            <div className="scouting-linked-application"><Glyph type="clipboard" /><span>Linked application <strong>{matchingApplication.progress}% complete</strong></span></div>
          ) : (
            <div className="scouting-linked-application is-muted"><Glyph type="clipboard" /><span>No linked application for this match</span></div>
          )}
        </article>
        </div>

        <section className="scouting-card scouting-scorecard">
        <div className="scouting-card-heading">
          <div><span>Scouting evaluation</span><h2>Why this score?</h2></div>
          <small>Rules-based and explainable</small>
        </div>
        <div className="scouting-score-grid">
          {scouting.scores.map((item) => (
            <article key={item.label}>
              <div><strong>{item.score}</strong><span>{item.weight}% weight</span></div>
              <h3>{item.label}</h3>
              <div className="scouting-score-track"><i style={{ width: `${item.score}%` }} /></div>
              <p>{item.explanation}</p>
            </article>
          ))}
        </div>
        </section>

        <div className="scouting-insight-grid">
        <section className="scouting-card scouting-insight-card is-strength">
          <div className="scouting-card-heading"><div><span>Positive signals</span><h2>Strengths</h2></div><Glyph type="spark" /></div>
          <ul>{(strengths.length ? strengths : ['Add more company information to identify stronger signals.']).map((item) => <li key={item}>{item}</li>)}</ul>
        </section>
        <section className="scouting-card scouting-insight-card is-gap">
          <div className="scouting-card-heading"><div><span>Reviewer concerns</span><h2>Gaps to close</h2></div><Glyph type="search" /></div>
          <ul>{(gaps.length ? gaps : ['No major gaps detected in the current profile.']).map((item) => <li key={item}>{item}</li>)}</ul>
        </section>
        </div>

        <section className="scouting-next-action">
        <div><span>Recommended next move</span><h2>{gaps.length ? gaps[0] : 'Launch the application build from this match.'}</h2><p>The report will keep using the selected program and company as its source of truth.</p></div>
        <Link to={nextPath}>{matchingApplication ? 'Continue application' : 'Build application'} <Glyph type="arrow" /></Link>
        </section>
        </article>
      </div>
    </section>
  )
}

function SavedProgramsPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const closingPidRef = useRef('')
  const [programs, setPrograms] = useState<FundingProgramRecord[]>(() =>
    loadFundingPrograms(),
  )
  const [entries, setEntries] = useState<SavedProgramEntry[]>(() =>
    loadSavedProgramEntries(),
  )
  const [query, setQuery] = useState('')
  const [stage, setStage] = useState<'All' | SavedProgramStage>('All')
  const [type, setType] = useState<'All' | 'Grant' | 'Loan'>('All')
  const [sort, setSort] = useState<
    'Recently saved' | 'Highest match' | 'Largest amount'
  >('Recently saved')
  const [selectedId, setSelectedId] = useState('')

  useEffect(() => {
    saveSavedProgramEntries(entries)
  }, [entries])

  useEffect(() => {
    let isCurrent = true

    loadFundingProgramsViaApi()
      .then((nextPrograms) => {
        if (!isCurrent) return
        replaceFundingProgramCache(nextPrograms)
        setPrograms(nextPrograms)
      })
      .catch(() => {
        // Keep the cached catalog available when the database is temporarily unavailable.
      })

    return () => {
      isCurrent = false
    }
  }, [])

  useEffect(() => {
    const { company, owner } = resolveDefaultApplicationCompany()
    if (!company) return

    let nextApplications = loadApplications()
    let applicationsChanged = false
    let entriesChanged = false

    const nextEntries = entries.map((entry) => {
      const program = programs.find((item) => item.id === entry.programId)
      if (!program) return entry

      const result = materializeSavedProgramApplication(nextApplications, {
        applicationId: entry.applicationId,
        programName: program.name,
        programUrl: program.url,
        company: company.name,
        fundingType: program.type,
        amount: program.amount,
        deadline: program.deadline,
        owner,
        stage: entry.stage,
        note: entry.note,
      })

      if (result.applications !== nextApplications) {
        nextApplications = result.applications
        applicationsChanged = true
      }

      if (entry.applicationId !== result.applicationId) {
        entriesChanged = true
        return {
          ...entry,
          applicationId: result.applicationId,
        }
      }

      return entry
    })

    if (applicationsChanged) {
      saveApplications(nextApplications)
    }

    if (entriesChanged) {
      setEntries(nextEntries)
      saveSavedProgramEntries(nextEntries)
    }
  }, [entries, programs])

  const savedPrograms = entries
    .map((entry) => {
      const program = programs.find((item) => item.id === entry.programId)
      return program ? { entry, program } : null
    })
    .filter(
      (
        item,
      ): item is { entry: SavedProgramEntry; program: FundingProgramRecord } =>
        item !== null,
    )
  const visiblePrograms = savedPrograms
    .filter(({ entry, program }) => {
      const matchesQuery =
        `${program.name} ${program.provider} ${program.location} ${entry.note}`
          .toLowerCase()
          .includes(query.trim().toLowerCase())
      return (
        matchesQuery &&
        (stage === 'All' || entry.stage === stage) &&
        (type === 'All' || program.type === type)
      )
    })
    .sort((left, right) => {
      if (sort === 'Highest match') return right.program.match - left.program.match
      if (sort === 'Largest amount') return right.program.amount - left.program.amount
      return entries.indexOf(left.entry) - entries.indexOf(right.entry)
    })
  const selectedProgram = savedPrograms.find(
    ({ program }) => program.id === selectedId,
  )
  const selectedApplicationPath = selectedProgram?.entry.applicationId
    ? getQuickBuildPath(selectedProgram.entry.applicationId)
    : '/quick-build'
  const totalPotential = savedPrograms.reduce(
    (sum, { program }) => sum + program.amount,
    0,
  )
  const averageMatch = savedPrograms.length
    ? Math.round(
        savedPrograms.reduce((sum, { program }) => sum + program.match, 0) /
          savedPrograms.length,
      )
    : 0
  const readyCount = entries.filter((entry) => entry.stage === 'Ready to apply').length
  const fixedDeadlineCount = savedPrograms.filter(
    ({ program }) => !/open|rolling/i.test(program.deadline),
  ).length

  useEffect(() => {
    const pid = searchParams.get('pid')?.trim()
    if (!pid) {
      closingPidRef.current = ''
      return
    }
    if (closingPidRef.current === pid) return

    const matchingProgram = savedPrograms.find(({ program }) => program.pid === pid)
    if (matchingProgram && matchingProgram.program.id !== selectedId) {
      setSelectedId(matchingProgram.program.id)
    }
  }, [savedPrograms, searchParams, selectedId])

  function updateEntry(
    programId: string,
    updates: Partial<Omit<SavedProgramEntry, 'programId'>>,
  ) {
    setEntries((current) =>
      current.map((entry) =>
        entry.programId === programId ? { ...entry, ...updates } : entry,
      ),
    )
  }

  function removeProgram(programId: string) {
    setEntries((current) =>
      current.filter((entry) => entry.programId !== programId),
    )
    closeSavedProgram()
  }

  function openSavedProgram(program: FundingProgramRecord) {
    setSelectedId(program.id)
    if (!program.pid) return

    const nextSearchParams = new URLSearchParams(searchParams)
    nextSearchParams.set('pid', program.pid)
    setSearchParams(nextSearchParams, { replace: true })
  }

  function closeSavedProgram() {
    closingPidRef.current = searchParams.get('pid')?.trim() ?? ''
    setSelectedId('')
    const nextSearchParams = new URLSearchParams(searchParams)
    nextSearchParams.delete('pid')
    setSearchParams(nextSearchParams, { replace: true })
  }

  function openSavedProgramApplication(programId: string) {
    const entry = entries.find((item) => item.programId === programId)
    if (!entry?.applicationId) {
      return
    }

    setSelectedId('')
    navigate(getQuickBuildPath(entry.applicationId))
  }

  return (
    <section className="saved-programs-page">
      <header className="saved-programs-header is-listing-topbar">
        <div>
          <h1>{t('workspacePages.savedPrograms.title')}</h1>
          <p>
            {t('workspacePages.savedPrograms.description')}
          </p>
        </div>
        <Link to="/grants-loans" className="saved-programs-header-action">
          <Glyph type="search" />
          {t('workspacePages.savedPrograms.discover')}
        </Link>
      </header>

      <div className="saved-programs-metrics">
        <article className="is-primary">
          <span>{t('workspacePages.savedPrograms.savedPrograms')}</span>
          <strong>{savedPrograms.length}</strong>
          <small>{readyCount} {t('workspacePages.savedPrograms.readyToApply')}</small>
        </article>
        <article>
          <span>{t('workspacePages.savedPrograms.potentialFunding')}</span>
          <strong>
            {new Intl.NumberFormat('en-CA', {
              style: 'currency',
              currency: 'CAD',
              notation: 'compact',
              maximumFractionDigits: 1,
            }).format(totalPotential)}
          </strong>
          <small>{t('workspacePages.savedPrograms.maximumCombined')}</small>
        </article>
        <article>
          <span>{t('workspacePages.savedPrograms.averageMatch')}</span>
          <strong>{averageMatch}%</strong>
          <small>{t('workspacePages.savedPrograms.acrossShortlist')}</small>
        </article>
        <article className="is-deadline">
          <span>{t('workspacePages.savedPrograms.fixedDeadlines')}</span>
          <strong>{fixedDeadlineCount}</strong>
          <small>{t('workspacePages.savedPrograms.calendarReview')}</small>
        </article>
      </div>

      <div className="saved-programs-layout">
        <section className="saved-programs-workspace">
          <div className="saved-programs-toolbar">
            <label>
              <Glyph type="search" />
              <input
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder={t('workspacePages.savedPrograms.search')}
              />
            </label>
            <select
              aria-label={t('workspacePages.savedPrograms.applicationStage')}
              value={stage}
              onChange={(event) =>
                setStage(event.target.value as 'All' | SavedProgramStage)
              }
            >
              <option value="All">{t('workspacePages.savedPrograms.allStages')}</option>
              <option value="Researching">Researching</option>
              <option value="Preparing">Preparing</option>
              <option value="Ready to apply">Ready to apply</option>
            </select>
            <select
              aria-label={t('workspacePages.savedPrograms.fundingType')}
              value={type}
              onChange={(event) =>
                setType(event.target.value as 'All' | 'Grant' | 'Loan')
              }
            >
              <option value="All">{t('workspacePages.savedPrograms.allTypes')}</option>
              <option value="Grant">{t('workspacePages.savedPrograms.grants')}</option>
              <option value="Loan">{t('workspacePages.savedPrograms.loans')}</option>
            </select>
            <select
              aria-label={t('workspacePages.savedPrograms.sort')}
              value={sort}
              onChange={(event) =>
                setSort(
                  event.target.value as
                    | 'Recently saved'
                    | 'Highest match'
                    | 'Largest amount',
                )
              }
            >
              <option value="Recently saved">{t('workspacePages.savedPrograms.recentlySaved')}</option>
              <option value="Highest match">{t('workspacePages.savedPrograms.highestMatch')}</option>
              <option value="Largest amount">{t('workspacePages.savedPrograms.largestAmount')}</option>
            </select>
          </div>

          <div className="saved-programs-list-heading">
            <div>
              <strong>{t('workspacePages.savedPrograms.shortlist')}</strong>
              <span>{visiblePrograms.length} of {savedPrograms.length} programs</span>
            </div>
            <span>{t('workspacePages.savedPrograms.stage')}</span>
            <span>{t('workspacePages.savedPrograms.funding')}</span>
            <span>{t('workspacePages.savedPrograms.match')}</span>
          </div>

          <div className="saved-programs-list">
            {visiblePrograms.map(({ entry, program }) => (
              <article key={program.id} className="saved-program-row">
                <button
                  type="button"
                  className="saved-program-main"
                  onClick={() => openSavedProgram(program)}
                >
                  <span className={`saved-program-type is-${program.type.toLowerCase()}`}>
                    {program.type.charAt(0)}
                  </span>
                  <span>
                    <small>{program.provider}</small>
                    <strong>{program.name}</strong>
                    <em>{program.location} · {program.deadline}</em>
                  </span>
                </button>
                <label className="saved-program-stage">
                  <span className="sr-only">Application stage for {program.name}</span>
                  <select
                    value={entry.stage}
                    onChange={(event) =>
                      updateEntry(program.id, {
                        stage: event.target.value as SavedProgramStage,
                      })
                    }
                  >
                    <option>Researching</option>
                    <option>Preparing</option>
                    <option>Ready to apply</option>
                  </select>
                </label>
                <span className="saved-program-amount">
                  <strong>${program.amount.toLocaleString('en-CA')}</strong>
                  <small>{program.type}</small>
                </span>
                <span className="saved-program-match">
                  <i style={{ '--saved-match': `${program.match}%` } as CSSProperties} />
                  <strong>{program.match}%</strong>
                </span>
                <button
                  type="button"
                  className="saved-program-remove"
                  aria-label={`Remove ${program.name}`}
                  onClick={() => removeProgram(program.id)}
                >
                  <Glyph type="close" />
                </button>
              </article>
            ))}
          </div>

          {visiblePrograms.length === 0 ? (
            <div className="workspace-empty">
              <span><Glyph type="search" /></span>
              <strong>{t('workspacePages.savedPrograms.noMatch')}</strong>
              <p>{t('workspacePages.savedPrograms.resetHint')}</p>
              <button
                type="button"
                onClick={() => {
                  setQuery('')
                  setStage('All')
                  setType('All')
                }}
              >
                {t('workspacePages.savedPrograms.reset')}
              </button>
            </div>
          ) : null}
        </section>

        <aside className="saved-programs-insights">
          <section className="saved-next-action">
            <p>{t('workspacePages.savedPrograms.recommended')}</p>
            <span><Glyph type="spark" /></span>
            <h2>{t('workspacePages.savedPrograms.strongestMatch')}</h2>
            <p>
              {savedPrograms[0]?.program.name ?? 'Your top funding opportunity'} has
              the clearest path to a complete application package.
            </p>
            {savedPrograms[0] ? (
              <button
                type="button"
                onClick={() =>
                  updateEntry(savedPrograms[0].program.id, { stage: 'Preparing' })
                }
              >
                {t('workspacePages.savedPrograms.startPreparing')}
              </button>
            ) : null}
          </section>

          <section className="saved-stage-summary">
            <div>
              <p>{t('workspacePages.savedPrograms.pipeline')}</p>
              <span>{savedPrograms.length} programs</span>
            </div>
            {(['Researching', 'Preparing', 'Ready to apply'] as const).map(
              (stageName) => {
                const count = entries.filter(
                  (entry) => entry.stage === stageName,
                ).length
                return (
                  <article key={stageName}>
                    <span><i className={`is-${stageName.toLowerCase().replaceAll(' ', '-')}`} /></span>
                    <strong>{stageName}</strong>
                    <b>{count}</b>
                  </article>
                )
              },
            )}
          </section>

          <section className="saved-shortlist-tip">
            <Glyph type="spark" />
            <div>
              <strong>{t('workspacePages.savedPrograms.focused')}</strong>
              <p>{t('workspacePages.savedPrograms.focusedHint')}</p>
            </div>
          </section>
        </aside>
      </div>

      {selectedProgram ? (
        <div
          className="clone-record-dialog-backdrop"
          role="presentation"
          onMouseDown={closeSavedProgram}
        >
          <section
            className="clone-record-dialog funding-program-detail"
            role="dialog"
            aria-modal="true"
            aria-labelledby="saved-funding-program-detail-title"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              className="clone-dialog-close"
              aria-label="Close program"
              onClick={closeSavedProgram}
            >
              <Glyph type="close" />
            </button>
            <div className="funding-program-detail-header">
              <div className="funding-program-detail-heading">
                <span className="clone-record-status">{selectedProgram.program.type}</span>
                <h2 id="saved-funding-program-detail-title">{selectedProgram.program.name}</h2>
              </div>
              <div className="funding-program-identifiers" aria-label="Program identifiers">
                <div>
                  <span>PID</span>
                  <strong>{selectedProgram.program.pid || 'Not available'}</strong>
                </div>
                <div>
                  <span>Data source</span>
                  <strong>{selectedProgram.program.sourceName || 'Not specified'}</strong>
                </div>
              </div>
            </div>
            <dl>
              <div className="funding-program-detail-field-wide"><dt>Funding provider</dt><dd>{selectedProgram.program.provider || 'Not specified'}</dd></div>
              <div className="funding-program-detail-field-wide"><dt>Description</dt><dd>{selectedProgram.program.description || 'Not provided'}</dd></div>
              <div className="funding-program-detail-field-wide"><dt>Eligibility</dt><dd>{selectedProgram.program.eligibility || 'Not provided'}</dd></div>
              <div className="funding-program-how-to-start funding-program-detail-field-wide">
                <dt>How to start</dt>
                <dd>{selectedProgram.program.process || 'Not provided'}</dd>
              </div>
              <div><dt>Maximum funding</dt><dd>${selectedProgram.program.amount.toLocaleString('en-CA')}</dd></div>
              <div>
                <dt>Status</dt>
                <dd>
                  <span
                    className={`funding-program-status-indicator ${
                      selectedProgram.program.status === 'active' ? 'is-active' : 'is-archived'
                    }`}
                  >
                    <i aria-hidden="true" />
                    {selectedProgram.program.status === 'active' ? 'Active' : 'Archived'}
                  </span>
                </dd>
              </div>
              <div><dt>Location</dt><dd>{selectedProgram.program.location}</dd></div>
              <div><dt>Country</dt><dd>{selectedProgram.program.country || 'Not specified'}</dd></div>
              <div className="funding-program-url"><dt>Official program site</dt><dd>{selectedProgram.program.url || 'Not provided'}</dd></div>
              <div className="funding-program-detail-field-wide"><dt>Eligible uses</dt><dd>{selectedProgram.program.eligibleUses || 'Not provided'}</dd></div>
              <div className="funding-program-detail-field-wide"><dt>Target company types</dt><dd>{selectedProgram.program.targetCompanyTypes || 'Not provided'}</dd></div>
              <div className="funding-program-detail-field-wide"><dt>Required evidence</dt><dd>{selectedProgram.program.requiredEvidence || 'Not provided'}</dd></div>
            </dl>
            <div className="saved-program-dialog-controls">
              <label>
                <span>Priority</span>
                <select
                  value={selectedProgram.entry.priority}
                  onChange={(event) =>
                    updateEntry(selectedProgram.program.id, {
                      priority: event.target.value as SavedProgramPriority,
                    })
                  }
                >
                  <option>High</option>
                  <option>Medium</option>
                  <option>Low</option>
                </select>
              </label>
              <label>
                <span>Internal note</span>
                <textarea
                  value={selectedProgram.entry.note}
                  onChange={(event) =>
                    updateEntry(selectedProgram.program.id, {
                      note: event.target.value,
                    })
                  }
                  placeholder="Add eligibility questions, next steps, or owner notes."
                />
              </label>
            </div>
            <div className="funding-program-detail-actions">
              <button
                type="button"
                onClick={() => removeProgram(selectedProgram.program.id)}
              >
                Remove
              </button>
              <Link
                to={selectedApplicationPath}
                onClick={() => openSavedProgramApplication(selectedProgram.program.id)}
              >
                Use in Quick Build
              </Link>
            </div>
          </section>
        </div>
      ) : null}
    </section>
  )
}

const applicationStatuses: ApplicationStatus[] = [
  'Draft',
  'In Review',
  'Ready',
  'Submitted',
  'Awarded',
]

function MyApplicationsPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [applications, setApplications] = useState<ApplicationRecord[]>(
    loadApplications,
  )
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState<'All' | ApplicationStatus>('All')
  const [company, setCompany] = useState('All')
  const [sort, setSort] = useState<
    'Nearest deadline' | 'Recently updated' | 'Largest funding'
  >('Nearest deadline')
  const [view, setView] = useState<'list' | 'board'>('list')
  const [selectedId, setSelectedId] = useState('')

  useEffect(() => {
    saveApplications(applications)
  }, [applications])

  const companies = [...new Set(applications.map((application) => application.company))]
  const visibleApplications = applications
    .filter((application) => {
      const matchesQuery =
        `${application.title} ${application.programName} ${application.company} ${application.owner}`
          .toLowerCase()
          .includes(query.trim().toLowerCase())
      return (
        matchesQuery &&
        (status === 'All' || application.status === status) &&
        (company === 'All' || application.company === company)
      )
    })
    .sort((left, right) => {
      if (sort === 'Largest funding') return right.amount - left.amount
      if (sort === 'Recently updated') {
        return applications.indexOf(left) - applications.indexOf(right)
      }
      return left.deadlineOrder - right.deadlineOrder
    })
  const selectedApplication = applications.find(
    (application) => application.id === selectedId,
  )
  const activeCount = applications.filter((application) =>
    ['Draft', 'In Review', 'Ready'].includes(application.status),
  ).length
  const dueSoonCount = applications.filter(
    (application) =>
      application.deadlineOrder <= 60 &&
      !['Submitted', 'Awarded'].includes(application.status),
  ).length
  const submittedCount = applications.filter((application) =>
    ['Submitted', 'Awarded'].includes(application.status),
  ).length
  const awardedValue = applications
    .filter((application) => application.status === 'Awarded')
    .reduce((sum, application) => sum + application.amount, 0)
  const nearestDeadlines = applications
    .filter((application) => application.deadlineOrder < 999)
    .sort((left, right) => left.deadlineOrder - right.deadlineOrder)
    .slice(0, 3)

  function updateApplication(
    applicationId: string,
    updates: Partial<Omit<ApplicationRecord, 'id'>>,
  ) {
    setApplications((current) =>
      updateApplicationRecord(current, applicationId, updates),
    )
  }

  function continueApplication(application: ApplicationRecord) {
    setSelectedId('')
    navigate(getQuickBuildPath(application.id))
  }

  return (
    <section className="applications-page">
      <header className="applications-header is-listing-topbar">
        <div>
          <h1>{t('workspacePages.applications.title')}</h1>
          <p>
            {t('workspacePages.applications.description')}
          </p>
        </div>
        <Link to="/quick-build">
          <Glyph type="spark" />
          {t('workspacePages.applications.newApplication')}
        </Link>
      </header>

      <div className="applications-metrics">
        <article className="is-primary">
          <span>{t('workspacePages.applications.active')}</span>
          <strong>{activeCount}</strong>
          <small>{t('workspacePages.applications.draftReview')}</small>
        </article>
        <article className={dueSoonCount ? 'is-warning' : ''}>
          <span>{t('workspacePages.applications.dueSoon')}</span>
          <strong>{dueSoonCount}</strong>
          <small>{t('workspacePages.applications.deadlineAttention')}</small>
        </article>
        <article>
          <span>{t('workspacePages.applications.submittedAwarded')}</span>
          <strong>{submittedCount}</strong>
          <small>{t('workspacePages.applications.completedWork')}</small>
        </article>
        <article className="is-awarded">
          <span>{t('workspacePages.applications.awardedPipeline')}</span>
          <strong>
            {new Intl.NumberFormat('en-CA', {
              style: 'currency',
              currency: 'CAD',
              notation: 'compact',
              maximumFractionDigits: 1,
            }).format(awardedValue)}
          </strong>
          <small>{t('workspacePages.applications.confirmedValue')}</small>
        </article>
      </div>

      <section className="applications-control-panel">
        <div className="applications-toolbar">
          <label>
            <Glyph type="search" />
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={t('workspacePages.applications.search')}
            />
          </label>
          <select
            aria-label={t('workspacePages.applications.statusFilter')}
            value={status}
            onChange={(event) =>
              setStatus(event.target.value as 'All' | ApplicationStatus)
            }
          >
            <option value="All">{t('workspacePages.applications.allStatuses')}</option>
            {applicationStatuses.map((statusName) => (
              <option key={statusName}>{statusName}</option>
            ))}
          </select>
          <select
            aria-label={t('workspacePages.applications.companyFilter')}
            value={company}
            onChange={(event) => setCompany(event.target.value)}
          >
            <option value="All">{t('workspacePages.applications.allCompanies')}</option>
            {companies.map((companyName) => (
              <option key={companyName}>{companyName}</option>
            ))}
          </select>
          <select
            aria-label={t('workspacePages.applications.sort')}
            value={sort}
            onChange={(event) =>
              setSort(
                event.target.value as
                  | 'Nearest deadline'
                  | 'Recently updated'
                  | 'Largest funding',
              )
            }
          >
            <option value="Nearest deadline">{t('workspacePages.applications.nearestDeadline')}</option>
            <option value="Recently updated">{t('workspacePages.applications.recentlyUpdated')}</option>
            <option value="Largest funding">{t('workspacePages.applications.largestFunding')}</option>
          </select>
          <div className="applications-view-switch" aria-label={t('workspacePages.applications.applicationView')}>
            <button
              type="button"
              className={view === 'list' ? 'is-selected' : ''}
              aria-label={t('workspacePages.applications.listView')}
              onClick={() => setView('list')}
            >
              <Glyph type="menu" />
            </button>
            <button
              type="button"
              className={view === 'board' ? 'is-selected' : ''}
              aria-label={t('workspacePages.applications.boardView')}
              onClick={() => setView('board')}
            >
              <Glyph type="grid" />
            </button>
          </div>
        </div>
        <div className="applications-result-summary">
          <span>{visibleApplications.length} of {applications.length} applications</span>
          {(query || status !== 'All' || company !== 'All') ? (
            <button
              type="button"
              onClick={() => {
                setQuery('')
                setStatus('All')
                setCompany('All')
              }}
            >
              {t('workspacePages.common.clearFilters')}
            </button>
          ) : null}
        </div>
      </section>

      {view === 'list' ? (
        <div className="applications-list-layout">
          <section className="applications-list-panel">
            <div className="applications-list-heading">
              <span>{t('workspacePages.applications.application')}</span>
              <span>{t('workspacePages.applications.status')}</span>
              <span>{t('workspacePages.applications.progress')}</span>
              <span>{t('workspacePages.applications.deadline')}</span>
              <span>{t('workspacePages.applications.funding')}</span>
            </div>
            <div className="applications-list">
              {visibleApplications.map((application) => (
                <article key={application.id} className="application-row">
                  <button
                    type="button"
                    className="application-main"
                    onClick={() => setSelectedId(application.id)}
                  >
                    <span className={`application-symbol is-${application.fundingType.toLowerCase()}`}>
                      {application.fundingType.charAt(0)}
                    </span>
                    <span>
                      <small>{application.company}</small>
                      <strong>{application.title}</strong>
                      <em>{application.programName}</em>
                    </span>
                  </button>
                  <label className="application-status-select">
                    <span className="sr-only">Status for {application.title}</span>
                    <select
                      className={`status-${application.status.toLowerCase().replaceAll(' ', '-')}`}
                      value={application.status}
                      onChange={(event) =>
                        updateApplication(application.id, {
                          status: event.target.value as ApplicationStatus,
                        })
                      }
                    >
                      {applicationStatuses.map((statusName) => (
                        <option key={statusName}>{statusName}</option>
                      ))}
                    </select>
                  </label>
                  <span className="application-progress">
                    <span><i style={{ width: `${application.progress}%` }} /></span>
                    <strong>{application.progress}%</strong>
                  </span>
                  <span className="application-deadline">
                    <strong>{application.deadline}</strong>
                    <small>{application.nextAction}</small>
                  </span>
                  <span className="application-value">
                    <strong>${application.amount.toLocaleString('en-CA')}</strong>
                    <small>{application.documentsComplete}/{application.documentsTotal} documents</small>
                  </span>
                  <button
                    type="button"
                    className="application-open"
                    aria-label={
                      application.strategicReviewReports?.length
                        ? `Open workspace for ${application.title}`
                        : `Open ${application.title}`
                    }
                    onClick={() =>
                      application.strategicReviewReports?.length
                        ? continueApplication(application)
                        : setSelectedId(application.id)
                    }
                  >
                    <Glyph type="arrow" />
                  </button>
                </article>
              ))}
            </div>
          </section>

          <aside className="applications-insights">
            <section className="application-deadline-radar">
              <div>
                <p>Deadline radar</p>
                <span>Next 120 days</span>
              </div>
              {nearestDeadlines.map((application, index) => (
                <button
                  key={application.id}
                  type="button"
                  onClick={() => setSelectedId(application.id)}
                >
                  <span>{String(index + 1).padStart(2, '0')}</span>
                  <span>
                    <strong>{application.programName}</strong>
                    <small>{application.deadline} · {application.company}</small>
                  </span>
                </button>
              ))}
            </section>

            <section className="application-portfolio-health">
              <p>Portfolio health</p>
              <div>
                <strong>
                  {Math.round(
                    applications.reduce(
                      (sum, application) => sum + application.progress,
                      0,
                    ) / applications.length,
                  )}%
                </strong>
                <span>Average completion</span>
              </div>
              <p>
                {applications.filter((application) => application.progress < 50).length}{' '}
                applications need focused work this week.
              </p>
            </section>
          </aside>
        </div>
      ) : (
        <section className="applications-board" aria-label="Application pipeline board">
          {applicationStatuses.map((statusName) => {
            const statusApplications = visibleApplications.filter(
              (application) => application.status === statusName,
            )
            return (
              <div key={statusName} className="applications-board-column">
                <header>
                  <span className={`is-${statusName.toLowerCase().replaceAll(' ', '-')}`} />
                  <strong>{statusName}</strong>
                  <b>{statusApplications.length}</b>
                </header>
                <div>
                  {statusApplications.map((application) => (
                    <button
                      key={application.id}
                      type="button"
                      className="application-board-card"
                      onClick={() => setSelectedId(application.id)}
                    >
                      <span>{application.company}</span>
                      <strong>{application.title}</strong>
                      <small>{application.programName}</small>
                      <div>
                        <b>${application.amount.toLocaleString('en-CA')}</b>
                        <em>{application.deadline}</em>
                      </div>
                      <span className="application-board-progress">
                        <i style={{ width: `${application.progress}%` }} />
                      </span>
                      <footer>
                        <span>{application.owner.split(' ').map((name) => name.charAt(0)).join('')}</span>
                        <small>{application.progress}% complete</small>
                      </footer>
                    </button>
                  ))}
                  {statusApplications.length === 0 ? (
                    <p className="application-board-empty">No applications</p>
                  ) : null}
                </div>
              </div>
            )
          })}
        </section>
      )}

      {visibleApplications.length === 0 ? (
        <div className="workspace-empty applications-empty">
          <span><Glyph type="search" /></span>
          <strong>No applications match</strong>
          <p>Clear the active filters to return to the complete pipeline.</p>
          <button
            type="button"
            onClick={() => {
              setQuery('')
              setStatus('All')
              setCompany('All')
            }}
          >
            Reset filters
          </button>
        </div>
      ) : null}

      {selectedApplication ? (
        <div
          className="clone-record-dialog-backdrop"
          role="presentation"
          onMouseDown={() => setSelectedId('')}
        >
          <section
            className="clone-record-dialog application-detail-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="application-dialog-title"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              className="clone-dialog-close"
              aria-label="Close application"
              onClick={() => setSelectedId('')}
            >
              <Glyph type="close" />
            </button>
            <span className={`clone-record-status status-${selectedApplication.status.toLowerCase().replaceAll(' ', '-')}`}>
              {selectedApplication.status}
            </span>
            <h2 id="application-dialog-title">{selectedApplication.title}</h2>
            <p>{selectedApplication.programName}</p>
            <dl>
              <div><dt>Company</dt><dd>{selectedApplication.company}</dd></div>
              <div><dt>Funding</dt><dd>${selectedApplication.amount.toLocaleString('en-CA')}</dd></div>
              <div><dt>Deadline</dt><dd>{selectedApplication.deadline}</dd></div>
              <div><dt>Owner</dt><dd>{selectedApplication.owner}</dd></div>
            </dl>
            <div className="application-detail-progress">
              <div>
                <strong>Application completion</strong>
                <span>{selectedApplication.progress}%</span>
              </div>
              <span><i style={{ width: `${selectedApplication.progress}%` }} /></span>
              <small>
                {selectedApplication.documentsComplete} of{' '}
                {selectedApplication.documentsTotal} required documents complete
              </small>
            </div>
            <div className="application-detail-controls">
              <label>
                <span>Status</span>
                <select
                  value={selectedApplication.status}
                  onChange={(event) =>
                    updateApplication(selectedApplication.id, {
                      status: event.target.value as ApplicationStatus,
                    })
                  }
                >
                  {applicationStatuses.map((statusName) => (
                    <option key={statusName}>{statusName}</option>
                  ))}
                </select>
              </label>
              <label>
                <span>Completion</span>
                <div className="application-completion-control">
                  <input
                    type="range"
                    min="0"
                    max="100"
                    step="1"
                    value={selectedApplication.progress}
                    onChange={(event) =>
                      updateApplication(selectedApplication.id, {
                        progress: Number(event.target.value),
                      })
                    }
                  />
                  <input
                    type="number"
                    min="0"
                    max="100"
                    aria-label="Completion percentage"
                    value={selectedApplication.progress}
                    onChange={(event) =>
                      updateApplication(selectedApplication.id, {
                        progress: Math.min(
                          100,
                          Math.max(0, Number(event.target.value)),
                        ),
                      })
                    }
                  />
                  <b>%</b>
                </div>
              </label>
              <label className="application-detail-note">
                <span>Internal note</span>
                <textarea
                  value={selectedApplication.note}
                  onChange={(event) =>
                    updateApplication(selectedApplication.id, {
                      note: event.target.value,
                    })
                  }
                  placeholder="Add reviewer feedback, blockers, or next steps."
                />
              </label>
            </div>
            <div className="application-detail-next">
              <Glyph type="spark" />
              <div>
                <strong>Next action</strong>
                <p>{selectedApplication.nextAction}</p>
              </div>
            </div>
            <div className="application-detail-actions">
              <button
                type="button"
                onClick={() =>
                  updateApplication(selectedApplication.id, {
                    status:
                      selectedApplication.status === 'Submitted'
                        ? 'Awarded'
                        : 'Submitted',
                    progress: 100,
                  })
                }
              >
                {selectedApplication.status === 'Submitted'
                  ? 'Mark awarded'
                  : 'Mark submitted'}
              </button>
              <button
                type="button"
                onClick={() => continueApplication(selectedApplication)}
              >
                {selectedApplication.strategicReviewReports?.length
                  ? 'Open workspace'
                  : 'Continue application'}
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </section>
  )
}

const selectedFundingProgramStorageKey = 'bconomics-selected-funding-program-v1'

type ManualFundingProgramDraft = Omit<ManualFundingProgramInput, 'amount' | 'matchScore'> & {
  amount: string
  matchScore: string
}

function createEmptyManualFundingProgram(): ManualFundingProgramDraft {
  return {
    name: '',
    fundingType: 'Grant',
    provider: '',
    amount: '',
    deadline: 'Open',
    programUrl: '',
    location: '',
    country: 'Canada',
    description: '',
    process: '',
    eligibility: '',
    eligibleUses: '',
    targetCompanyTypes: '',
    requiredEvidence: '',
    matchScore: '0',
  }
}

function GrantsLoansPage() {
  const { t } = useTranslation()
  const { config } = usePlatformConfig()
  const platformName = getPlatformDisplayName(config)
  const [query, setQuery] = useState('')
  const [type, setType] = useState<'All' | 'Grant' | 'Loan'>('All')
  const [filtersOpen, setFiltersOpen] = useState(true)
  const [location, setLocation] = useState('All')
  const [sourceName, setSourceName] = useState('All')
  const [amountRange, setAmountRange] = useState<
    'All' | 'under-50' | '50-100' | '100-plus'
  >('All')
  const [minimumMatch, setMinimumMatch] = useState<'All' | '80' | '90'>('All')
  const [deadlineType, setDeadlineType] = useState<'All' | 'Open' | 'Fixed'>(
    'All',
  )
  const [selectedProgram, setSelectedProgram] =
    useState<FundingProgramRecord | null>(null)
  const [searchParams, setSearchParams] = useSearchParams()
  const [sourcePickerOpen, setSourcePickerOpen] = useState(false)
  const [importProgramOpen, setImportProgramOpen] = useState(false)
  const [importProgramSubmitting, setImportProgramSubmitting] = useState(false)
  const [importProgramError, setImportProgramError] = useState('')
  const [importDraft, setImportDraft] = useState<ManualFundingProgramDraft>(
    createEmptyManualFundingProgram,
  )
  const [programs, setPrograms] = useState<FundingProgramRecord[]>([])
  const [programsLoading, setProgramsLoading] = useState(true)
  const [programsError, setProgramsError] = useState('')
  const activeFundingDataSources = config.dataSources.filter(
    (source) => source.module === 'grants-loans' && source.enabled,
  )
  const [savedEntries, setSavedEntries] = useState<SavedProgramEntry[]>([])

  useEffect(() => {
    let isCurrent = true

    loadFundingProgramsViaApi()
      .then((nextPrograms) => {
        if (!isCurrent) return
        setPrograms(nextPrograms)
        replaceFundingProgramCache(nextPrograms)
        setSavedEntries(loadSavedProgramEntries())
      })
      .catch((error: unknown) => {
        if (!isCurrent) return
        setProgramsError(
          error instanceof Error
            ? error.message
            : 'Funding programs could not be loaded from the database.',
        )
      })
      .finally(() => {
        if (isCurrent) setProgramsLoading(false)
      })

    return () => {
      isCurrent = false
    }
  }, [])

  useEffect(() => {
    if (programsLoading) return

    const pid = searchParams.get('pid')
    if (!pid) {
      setSelectedProgram(null)
      return
    }

    setSelectedProgram(
      programs.find((program) => program.pid === pid) ?? null,
    )
  }, [programs, programsLoading, searchParams])

  const locations = [...new Set(programs.map((program) => program.location))].sort()
  const sources = [
    ...new Set(
      programs.map((program) => program.sourceName ?? `${platformName} catalog`),
    ),
  ].sort()
  const visiblePrograms = programs.filter((program) => {
    const matchesQuery =
      `${program.name} ${program.provider} ${program.location} ${program.sourceName}`
        .toLowerCase()
        .includes(query.trim().toLowerCase())
    const matchesType = type === 'All' || program.type === type
    const matchesLocation = location === 'All' || program.location === location
    const matchesSource =
      sourceName === 'All' ||
      (program.sourceName ?? `${platformName} catalog`) === sourceName
    const matchesAmount =
      amountRange === 'All' ||
      (amountRange === 'under-50' && program.amount < 50000) ||
      (amountRange === '50-100' &&
        program.amount >= 50000 &&
        program.amount < 100000) ||
      (amountRange === '100-plus' && program.amount >= 100000)
    const matchesMatch =
      minimumMatch === 'All' || program.match >= Number(minimumMatch)
    const isOpenDeadline = /open|rolling/i.test(program.deadline)
    const matchesDeadline =
      deadlineType === 'All' ||
      (deadlineType === 'Open' && isOpenDeadline) ||
      (deadlineType === 'Fixed' && !isOpenDeadline)

    return (
      matchesQuery &&
      matchesType &&
      matchesLocation &&
      matchesSource &&
      matchesAmount &&
      matchesMatch &&
      matchesDeadline
    )
  })
  const activeFilterCount = [
    type !== 'All',
    location !== 'All',
    sourceName !== 'All',
    amountRange !== 'All',
    minimumMatch !== 'All',
    deadlineType !== 'All',
  ].filter(Boolean).length
  const connectedSources = config.dataSources.filter(
    (source) =>
      source.module === 'grants-loans' &&
      source.enabled &&
      source.status === 'connected',
  ).length
  const totalValue = programs.reduce((sum, program) => sum + program.amount, 0)

  function clearFundingFilters() {
    setType('All')
    setLocation('All')
    setSourceName('All')
    setAmountRange('All')
    setMinimumMatch('All')
    setDeadlineType('All')
  }

  function updateImportDraft(
    field: keyof ManualFundingProgramDraft,
    value: string,
  ) {
    setImportDraft((current) => ({ ...current, [field]: value }))
    setImportProgramError('')
  }

  async function submitManualFundingProgram(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const amount = Number(importDraft.amount.replace(/,/g, ''))
    const matchScore = Number(importDraft.matchScore || 0)
    if (!importDraft.name.trim()) {
      setImportProgramError('Program name is required.')
      return
    }
    if (!Number.isFinite(amount) || amount < 0) {
      setImportProgramError('Enter a valid maximum funding amount.')
      return
    }
    if (!Number.isInteger(matchScore) || matchScore < 0 || matchScore > 100) {
      setImportProgramError('Match score must be a whole number from 0 to 100.')
      return
    }

    setImportProgramSubmitting(true)
    setImportProgramError('')
    try {
      const program = await createManualFundingProgramViaApi({
        ...importDraft,
        amount,
        matchScore,
      })
      setPrograms((current) => {
        const nextPrograms = [program, ...current.filter((item) => item.id !== program.id)]
        replaceFundingProgramCache(nextPrograms)
        return nextPrograms
      })
      setImportDraft(createEmptyManualFundingProgram())
      setImportProgramOpen(false)
    } catch (error) {
      setImportProgramError(
        error instanceof Error
          ? error.message
          : 'The funding program could not be imported.',
      )
    } finally {
      setImportProgramSubmitting(false)
    }
  }

  function openFundingProgram(program: FundingProgramRecord) {
    if (!program.pid) return

    setSelectedProgram(program)
    const nextSearchParams = new URLSearchParams(searchParams)
    nextSearchParams.set('pid', program.pid)
    setSearchParams(nextSearchParams, { replace: true })
  }

  function closeFundingProgram() {
    setSelectedProgram(null)
    const nextSearchParams = new URLSearchParams(searchParams)
    nextSearchParams.delete('pid')
    setSearchParams(nextSearchParams, { replace: true })
  }

  function toggleSavedProgram(programId: string) {
    setSavedEntries((current) => {
      const existingEntry = current.find((entry) => entry.programId === programId)
      if (existingEntry) {
        const next = current.filter((entry) => entry.programId !== programId)
        saveSavedProgramEntries(next)
        void persistSavedProgramEntries(next).catch(() => undefined)
        return next
      }

      const next = addSavedProgram(current, programId)
      const program = programs.find((item) => item.id === programId)
      const newEntry = next.find((entry) => entry.programId === programId)
      const { company, owner } = resolveDefaultApplicationCompany()

      if (!program || !newEntry || !company) {
        saveSavedProgramEntries(next)
        void persistSavedProgramEntries(next).catch(() => undefined)
        return next
      }

      const result = materializeSavedProgramApplication(loadApplications(), {
        applicationId: newEntry.applicationId,
        programName: program.name,
        programUrl: program.url,
        company: company.name,
        fundingType: program.type,
        amount: program.amount,
        deadline: program.deadline,
        owner,
        stage: newEntry.stage,
        note: newEntry.note,
      })

      saveApplications(result.applications)

      const nextWithApplication = next.map((entry) =>
        entry.programId === programId
          ? { ...entry, applicationId: result.applicationId }
          : entry,
      )

      saveSavedProgramEntries(nextWithApplication)
      void persistSavedProgramEntries(nextWithApplication).catch(() => undefined)
      return nextWithApplication
    })
  }

  return (
    <section className="funding-directory">
      <header className="funding-directory-header is-listing-topbar">
        <div>
          <h1>{t('workspacePages.grantsLoans.title')}</h1>
          <p>
            {t('workspacePages.grantsLoans.description')}
          </p>
        </div>
        <div className="funding-directory-header-actions">
          <button
            type="button"
            className="funding-directory-admin saved-programs-header-action"
            onClick={() => {
              setImportProgramError('')
              setImportProgramOpen(true)
            }}
          >
            <Glyph type="file" />
            {t('workspacePages.grantsLoans.import')}
          </button>
          <button
            type="button"
            className="funding-directory-admin saved-programs-header-action"
            onClick={() => setSourcePickerOpen(true)}
          >
            <Glyph type="settings" />
            {t('workspacePages.common.manageDataSources')}
          </button>
        </div>
      </header>

      <div className="funding-directory-metrics">
        <article>
          <span>{t('workspacePages.grantsLoans.available')}</span>
          <strong>{programs.length}</strong>
          <small>{t('workspacePages.grantsLoans.activeCatalogs')}</small>
        </article>
        <article>
          <span>{t('workspacePages.grantsLoans.potentialFunding')}</span>
          <strong>
            {new Intl.NumberFormat('en-CA', {
              style: 'currency',
              currency: 'CAD',
              notation: 'compact',
              maximumFractionDigits: 1,
            }).format(totalValue)}
          </strong>
          <small>{t('workspacePages.grantsLoans.maximumCombined')}</small>
        </article>
        <article className="is-source-metric">
          <span>{t('workspacePages.common.connectedDataSources')}</span>
          <strong>{connectedSources}</strong>
          <small>
            {
              config.dataSources.filter(
                (source) => source.module === 'grants-loans' && source.enabled,
              ).length
            }{' '}
            {t('workspacePages.common.enabled')}
          </small>
        </article>
      </div>

      <section className="funding-directory-results">
        {programsError ? (
          <div className="workspace-empty funding-directory-error" role="alert">
            <span><Glyph type="close" /></span>
            <strong>{t('workspacePages.grantsLoans.loading')}</strong>
            <p>{programsError}</p>
            <button
              type="button"
              onClick={() => window.location.reload()}
            >
              {t('workspacePages.common.start')}
            </button>
          </div>
        ) : null}

        <div className="funding-directory-toolbar">
          <label>
            <Glyph type="search" />
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={t('workspacePages.grantsLoans.search')}
            />
          </label>
          <div>
            {(['All', 'Grant', 'Loan'] as const).map((filterName) => (
              <button
                key={filterName}
                type="button"
                className={type === filterName ? 'is-selected' : ''}
                aria-pressed={type === filterName}
                onClick={() => setType(filterName)}
              >
                {filterName === 'All' ? t('workspacePages.common.all') : filterName === 'Grant' ? t('workspacePages.grantsLoans.grants') : t('workspacePages.grantsLoans.loans')}
              </button>
            ))}
          </div>
          <button
            type="button"
            className={`funding-filter-toggle ${
              filtersOpen || activeFilterCount > 0 ? 'is-active' : ''
            }`}
            aria-expanded={filtersOpen}
            onClick={() => setFiltersOpen((open) => !open)}
          >
            <Glyph type="settings" />
            {t('workspacePages.common.filters')}
            {activeFilterCount > 0 ? <b>{activeFilterCount}</b> : null}
          </button>
          <span>
            {programsLoading
              ? t('workspacePages.grantsLoans.loading')
              : `${visiblePrograms.length} ${t('workspacePages.common.records')}`}
          </span>
        </div>

        {filtersOpen ? (
          <div className="funding-directory-filter-panel">
            <div className="funding-filter-heading">
              <div>
                <strong>{t('workspacePages.grantsLoans.refine')}</strong>
                <span>{t('workspacePages.grantsLoans.refineHint')}</span>
              </div>
              {activeFilterCount > 0 ? (
                <button type="button" onClick={clearFundingFilters}>
                  {t('workspacePages.common.clearAll')}
                </button>
              ) : null}
            </div>
            <div className="funding-filter-fields">
              <label>
                <span>{t('workspacePages.grantsLoans.region')}</span>
                <select
                  value={location}
                  onChange={(event) => setLocation(event.target.value)}
                >
                  <option value="All">{t('workspacePages.grantsLoans.allRegions')}</option>
                  {locations.map((locationName) => (
                    <option key={locationName} value={locationName}>
                      {locationName}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <span>{t('workspacePages.grantsLoans.dataSource')}</span>
                <select
                  value={sourceName}
                  onChange={(event) => setSourceName(event.target.value)}
                >
                  <option value="All">{t('workspacePages.grantsLoans.allSources')}</option>
                  {sources.map((source) => (
                    <option key={source} value={source}>{source}</option>
                  ))}
                </select>
              </label>
              <label>
                <span>{t('workspacePages.grantsLoans.fundingAmount')}</span>
                <select
                  value={amountRange}
                  onChange={(event) =>
                    setAmountRange(
                      event.target.value as typeof amountRange,
                    )
                  }
                >
                  <option value="All">{t('workspacePages.grantsLoans.anyAmount')}</option>
                  <option value="under-50">{t('workspacePages.grantsLoans.under50')}</option>
                  <option value="50-100">{t('workspacePages.grantsLoans.amount50to100')}</option>
                  <option value="100-plus">{t('workspacePages.grantsLoans.amount100Plus')}</option>
                </select>
              </label>
              <label>
                <span>{t('workspacePages.grantsLoans.minimumMatch')}</span>
                <select
                  value={minimumMatch}
                  onChange={(event) =>
                    setMinimumMatch(event.target.value as typeof minimumMatch)
                  }
                >
                  <option value="All">{t('workspacePages.grantsLoans.anyMatch')}</option>
                  <option value="80">{t('workspacePages.grantsLoans.match80')}</option>
                  <option value="90">{t('workspacePages.grantsLoans.match90')}</option>
                </select>
              </label>
              <label>
                <span>{t('workspacePages.grantsLoans.deadline')}</span>
                <select
                  value={deadlineType}
                  onChange={(event) =>
                    setDeadlineType(event.target.value as typeof deadlineType)
                  }
                >
                  <option value="All">{t('workspacePages.grantsLoans.anyDeadline')}</option>
                  <option value="Open">{t('workspacePages.grantsLoans.openRolling')}</option>
                  <option value="Fixed">{t('workspacePages.grantsLoans.fixedDeadline')}</option>
                </select>
              </label>
            </div>
          </div>
        ) : null}

        {activeFilterCount > 0 ? (
          <div className="funding-active-filters" aria-label="Active filters">
            <span>{activeFilterCount} active</span>
            {type !== 'All' ? (
              <button type="button" onClick={() => setType('All')}>
                {type} <b>×</b>
              </button>
            ) : null}
            {location !== 'All' ? (
              <button type="button" onClick={() => setLocation('All')}>
                {location} <b>×</b>
              </button>
            ) : null}
            {sourceName !== 'All' ? (
              <button type="button" onClick={() => setSourceName('All')}>
                {sourceName} <b>×</b>
              </button>
            ) : null}
            {amountRange !== 'All' ? (
              <button type="button" onClick={() => setAmountRange('All')}>
                {amountRange === 'under-50'
                  ? 'Under $50K'
                  : amountRange === '50-100'
                    ? '$50K–$99K'
                    : '$100K+'}{' '}
                <b>×</b>
              </button>
            ) : null}
            {minimumMatch !== 'All' ? (
              <button type="button" onClick={() => setMinimumMatch('All')}>
                {minimumMatch}%+ match <b>×</b>
              </button>
            ) : null}
            {deadlineType !== 'All' ? (
              <button type="button" onClick={() => setDeadlineType('All')}>
                {deadlineType === 'Open' ? t('workspacePages.grantsLoans.openRolling') : t('workspacePages.grantsLoans.fixedDeadline')}{' '}
                <b>×</b>
              </button>
            ) : null}
          </div>
        ) : null}

        <div className="funding-directory-grid">
          {programsLoading ? (
            <div className="workspace-empty">
              <strong>Loading funding programs</strong>
              <p>Reading active programs from the current database.</p>
            </div>
          ) : null}
          {!programsLoading ? visiblePrograms.map((program) => (
            <article key={program.id} className="funding-directory-card">
              <div className="funding-card-topline">
                <span className={`funding-card-type is-${program.type.toLowerCase()}`}>
                  {program.type}
                </span>
                <span className="funding-card-match">{program.match}% match</span>
              </div>
              <div className="funding-card-copy">
                <small>{program.provider}</small>
                <h2>{program.name}</h2>
                <p>{program.location} · {t('workspacePages.grantsLoans.deadline')}: {program.deadline}</p>
              </div>
              <div className="funding-card-value">
                <span>Up to</span>
                <strong>
                  {new Intl.NumberFormat('en-CA', {
                    style: 'currency',
                    currency: 'CAD',
                    maximumFractionDigits: 0,
                  }).format(program.amount)}
                </strong>
              </div>
              <footer>
                <span title={program.sourceName}>
                  <i className={program.sourceId ? 'is-external' : ''} />
                  {program.sourceName ?? `${platformName} catalog`}
                </span>
                <button type="button" onClick={() => openFundingProgram(program)}>
                  View details
                </button>
              </footer>
            </article>
          )) : null}
        </div>

        {!programsLoading && !programsError && visiblePrograms.length === 0 ? (
          <div className="workspace-empty">
            <span><Glyph type="search" /></span>
            <strong>No matching funding programs</strong>
            <p>Try another search term or include all funding types.</p>
            <button
              type="button"
              onClick={() => {
                setQuery('')
                clearFundingFilters()
              }}
            >
              Clear filters
            </button>
          </div>
        ) : null}
      </section>

      {importProgramOpen ? (
        <div
          className="clone-record-dialog-backdrop"
          role="presentation"
          onMouseDown={() => {
            if (!importProgramSubmitting) setImportProgramOpen(false)
          }}
        >
          <section
            className="clone-record-dialog funding-program-import-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="funding-program-import-title"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              className="clone-dialog-close"
              aria-label="Close import program dialog"
              onClick={() => setImportProgramOpen(false)}
              disabled={importProgramSubmitting}
            >
              <Glyph type="close" />
            </button>
            <span className="clone-record-status">Manual import</span>
            <h2 id="funding-program-import-title">Import funding program</h2>
            <p>Add the full program profile to your workspace catalog.</p>
            <form onSubmit={submitManualFundingProgram}>
              <div className="funding-program-import-grid">
                <label className="funding-program-import-field-wide">
                  <span>Program name *</span>
                  <input
                    required
                    value={importDraft.name}
                    onChange={(event) => updateImportDraft('name', event.target.value)}
                    placeholder="e.g. Ontario Market Expansion Grant"
                  />
                </label>
                <label>
                  <span>Funding type *</span>
                  <select
                    value={importDraft.fundingType}
                    onChange={(event) =>
                      updateImportDraft('fundingType', event.target.value)
                    }
                  >
                    <option value="Grant">Grant</option>
                    <option value="Loan">Loan</option>
                  </select>
                </label>
                <label>
                  <span>Funding provider</span>
                  <input
                    value={importDraft.provider}
                    onChange={(event) => updateImportDraft('provider', event.target.value)}
                    placeholder="Organization or agency"
                  />
                </label>
                <label>
                  <span>Maximum funding (CAD) *</span>
                  <input
                    required
                    min="0"
                    step="0.01"
                    type="number"
                    value={importDraft.amount}
                    onChange={(event) => updateImportDraft('amount', event.target.value)}
                    placeholder="250000"
                  />
                </label>
                <label>
                  <span>{t('workspacePages.grantsLoans.deadline')}</span>
                  <input
                    value={importDraft.deadline}
                    onChange={(event) => updateImportDraft('deadline', event.target.value)}
                    placeholder="Open or Aug 31, 2026"
                  />
                </label>
                <label>
                  <span>Official program site</span>
                  <input
                    type="url"
                    value={importDraft.programUrl}
                    onChange={(event) => updateImportDraft('programUrl', event.target.value)}
                    placeholder="https://example.ca/program"
                  />
                </label>
                <label>
                  <span>Location</span>
                  <input
                    value={importDraft.location}
                    onChange={(event) => updateImportDraft('location', event.target.value)}
                    placeholder="Ontario or Canada"
                  />
                </label>
                <label>
                  <span>Country</span>
                  <input
                    value={importDraft.country}
                    onChange={(event) => updateImportDraft('country', event.target.value)}
                    placeholder="Canada"
                  />
                </label>
                <label className="funding-program-import-field-wide">
                  <span>Description</span>
                  <textarea
                    value={importDraft.description}
                    onChange={(event) => updateImportDraft('description', event.target.value)}
                    placeholder="What this program supports and why it exists."
                  />
                </label>
                <label className="funding-program-import-field-wide">
                  <span>How to start</span>
                  <textarea
                    value={importDraft.process}
                    onChange={(event) => updateImportDraft('process', event.target.value)}
                    placeholder="How to begin, who to contact, what to prepare, and how to submit."
                  />
                </label>
                <label className="funding-program-import-field-wide">
                  <span>Eligibility</span>
                  <textarea
                    value={importDraft.eligibility}
                    onChange={(event) => updateImportDraft('eligibility', event.target.value)}
                    placeholder="Who can apply and what requirements apply."
                  />
                </label>
                <label className="funding-program-import-field-wide">
                  <span>Eligible uses</span>
                  <textarea
                    value={importDraft.eligibleUses}
                    onChange={(event) => updateImportDraft('eligibleUses', event.target.value)}
                    placeholder="Equipment, hiring, marketing, working capital, or other approved uses."
                  />
                </label>
                <label className="funding-program-import-field-wide">
                  <span>Target company types</span>
                  <textarea
                    value={importDraft.targetCompanyTypes}
                    onChange={(event) => updateImportDraft('targetCompanyTypes', event.target.value)}
                    placeholder="The companies this program is designed for."
                  />
                </label>
                <label className="funding-program-import-field-wide">
                  <span>Required evidence</span>
                  <textarea
                    value={importDraft.requiredEvidence}
                    onChange={(event) => updateImportDraft('requiredEvidence', event.target.value)}
                    placeholder="Business plan, financial statements, quotes, milestones, and other evidence."
                  />
                </label>
                <label>
                  <span>Match score</span>
                  <input
                    min="0"
                    max="100"
                    step="1"
                    type="number"
                    value={importDraft.matchScore}
                    onChange={(event) => updateImportDraft('matchScore', event.target.value)}
                    placeholder="0"
                  />
                </label>
              </div>
              {importProgramError ? (
                <p className="funding-program-import-error" role="alert">
                  {importProgramError}
                </p>
              ) : null}
              <div className="funding-program-import-actions">
                <button
                  type="button"
                  onClick={() => setImportProgramOpen(false)}
                  disabled={importProgramSubmitting}
                >
                  Cancel
                </button>
                <button type="submit" disabled={importProgramSubmitting}>
                  {importProgramSubmitting ? 'Importing...' : 'Import program'}
                </button>
              </div>
            </form>
          </section>
        </div>
      ) : null}

      {selectedProgram ? (
        <div
          className="clone-record-dialog-backdrop"
          role="presentation"
          onMouseDown={closeFundingProgram}
        >
          <section
            className="clone-record-dialog funding-program-detail"
            role="dialog"
            aria-modal="true"
            aria-labelledby="funding-program-detail-title"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              className="clone-dialog-close"
              aria-label="Close program"
              onClick={closeFundingProgram}
            >
              <Glyph type="close" />
            </button>
            <div className="funding-program-detail-header">
              <div className="funding-program-detail-heading">
                <span className="clone-record-status">{selectedProgram.type}</span>
                <h2 id="funding-program-detail-title">{selectedProgram.name}</h2>
              </div>
              <div className="funding-program-identifiers" aria-label="Program identifiers">
                <div>
                  <span>PID</span>
                  <strong>{selectedProgram.pid || 'Not available'}</strong>
                </div>
                <div>
                  <span>Data source</span>
                  <strong>{selectedProgram.sourceName || 'Not specified'}</strong>
                </div>
              </div>
            </div>
            <dl>
              <div className="funding-program-detail-field-wide"><dt>Funding provider</dt><dd>{selectedProgram.provider || 'Not specified'}</dd></div>
              <div className="funding-program-detail-field-wide"><dt>Description</dt><dd>{selectedProgram.description || 'Not provided'}</dd></div>
              <div className="funding-program-detail-field-wide"><dt>Eligibility</dt><dd>{selectedProgram.eligibility || 'Not provided'}</dd></div>
              <div className="funding-program-how-to-start funding-program-detail-field-wide">
                <dt>How to start</dt>
                <dd>{selectedProgram.process || 'Not provided'}</dd>
              </div>
              <div><dt>Maximum funding</dt><dd>${selectedProgram.amount.toLocaleString('en-CA')}</dd></div>
              <div>
                <dt>Status</dt>
                <dd>
                  <span
                    className={`funding-program-status-indicator ${
                      selectedProgram.status === 'active' ? 'is-active' : 'is-archived'
                    }`}
                  >
                    <i aria-hidden="true" />
                    {selectedProgram.status === 'active' ? 'Active' : 'Archived'}
                  </span>
                </dd>
              </div>
              <div><dt>Location</dt><dd>{selectedProgram.location}</dd></div>
              <div><dt>Country</dt><dd>{selectedProgram.country || 'Not specified'}</dd></div>
              <div className="funding-program-url"><dt>Official program site</dt><dd>{selectedProgram.url || 'Not provided'}</dd></div>
              <div className="funding-program-detail-field-wide"><dt>Eligible uses</dt><dd>{selectedProgram.eligibleUses || 'Not provided'}</dd></div>
              <div className="funding-program-detail-field-wide"><dt>Target company types</dt><dd>{selectedProgram.targetCompanyTypes || 'Not provided'}</dd></div>
              <div className="funding-program-detail-field-wide"><dt>Required evidence</dt><dd>{selectedProgram.requiredEvidence || 'Not provided'}</dd></div>
            </dl>
            <div className="funding-program-detail-actions">
              <button
                type="button"
                className={
                  savedEntries.some(
                    (entry) => entry.programId === selectedProgram.id,
                  )
                    ? 'is-saved'
                    : ''
                }
                onClick={() => toggleSavedProgram(selectedProgram.id)}
              >
                {savedEntries.some(
                  (entry) => entry.programId === selectedProgram.id,
                )
                  ? 'Saved to shortlist'
                  : 'Save program'}
              </button>
              <Link
                to="/quick-build"
                onClick={() =>
                  setPersistentItem(
                    selectedFundingProgramStorageKey,
                    JSON.stringify(selectedProgram),
                  )
                }
              >
                Use in Quick Build
              </Link>
            </div>
          </section>
        </div>
      ) : null}

      {sourcePickerOpen ? (
        <div
          className="clone-record-dialog-backdrop"
          role="presentation"
          onMouseDown={() => setSourcePickerOpen(false)}
        >
          <section
            className="clone-record-dialog funding-source-picker-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="funding-source-picker-title"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              className="clone-dialog-close"
              aria-label="Close data source picker"
              onClick={() => setSourcePickerOpen(false)}
            >
              <Glyph type="close" />
            </button>
            <span className="clone-record-status">{t('workspacePages.grantsLoans.activeSources')}</span>
            <h2 id="funding-source-picker-title">{t('workspacePages.grantsLoans.chooseDataSource')}</h2>
            <p>
              {t('workspacePages.grantsLoans.chooseDataSourceDescription')}
            </p>
            <div className="funding-source-picker-list">
              <button
                type="button"
                className={`funding-source-picker-option ${sourceName === 'All' ? 'is-selected' : ''}`}
                onClick={() => {
                  setSourceName('All')
                  setSourcePickerOpen(false)
                }}
              >
                <span className="funding-source-picker-icon is-all">All</span>
                <span>
                  <strong>{t('workspacePages.grantsLoans.allActiveSources')}</strong>
                  <small>{t('workspacePages.grantsLoans.allEnabledCatalogs')}</small>
                </span>
              </button>
              {activeFundingDataSources.map((source) => (
                <button
                  key={source.id}
                  type="button"
                  className={`funding-source-picker-option ${sourceName === source.name ? 'is-selected' : ''}`}
                  onClick={() => {
                    setSourceName(source.name)
                    setSourcePickerOpen(false)
                  }}
                >
                  <span
                    className={`funding-source-picker-icon is-${source.provider}`}
                    role="img"
                    aria-label={source.provider === 'google-sheets' ? 'Google Sheets' : 'Airtable'}
                  >
                    {source.provider === 'google-sheets' ? 'G' : 'A'}
                  </span>
                  <span>
                    <strong>{source.name}</strong>
                    <small>
                      {source.provider === 'google-sheets' ? 'Google Sheets' : 'Airtable'} · {source.frequency} sync
                    </small>
                  </span>
                  <i className="funding-source-picker-active">Active</i>
                </button>
              ))}
            </div>
            {activeFundingDataSources.length === 0 ? (
              <div className="funding-source-picker-empty">
                No active Grants &amp; Loans sources are configured.
              </div>
            ) : null}
            <Link
              to="/admin#data-sources"
              className="funding-source-picker-admin-link"
              onClick={() => grantAdminAccess()}
            >
              Manage sources in Admin Console
            </Link>
          </section>
        </div>
      ) : null}
    </section>
  )
}

const selectedTemplateStorageKey = 'bconomics-selected-template-v1'

function TemplatesPage() {
  const { t } = useTranslation()
  const { config } = usePlatformConfig()
  const enabledSourceIds = config.dataSources
    .filter((source) => source.enabled && source.module === 'templates')
    .map((source) => source.id)
  const synchronizedTemplates = loadResourceRecords('templates', enabledSourceIds)
  const templates = loadTemplateCatalog(synchronizedTemplates)
  const [query, setQuery] = useState('')
  const [scope, setScope] = useState<'All' | 'Featured' | 'Free' | 'Pro'>('All')
  const [filtersOpen, setFiltersOpen] = useState(true)
  const [category, setCategory] = useState('All')
  const [format, setFormat] = useState<'All' | TemplateFormat>('All')
  const [audience, setAudience] = useState('All')
  const [sourceName, setSourceName] = useState('All')
  const [sort, setSort] = useState<'Most used' | 'Recently updated' | 'A–Z'>(
    'Most used',
  )
  const [selectedTemplate, setSelectedTemplate] = useState<TemplateRecord | null>(
    null,
  )
  const categories = [...new Set(templates.map((template) => template.category))].sort()
  const audiences = [...new Set(templates.map((template) => template.audience))].sort()
  const sources = [...new Set(templates.map((template) => template.sourceName))].sort()
  const visibleTemplates = templates
    .filter((template) => {
      const matchesQuery =
        `${template.title} ${template.description} ${template.category} ${template.format} ${template.sourceName}`
          .toLowerCase()
          .includes(query.trim().toLowerCase())
      const matchesScope =
        scope === 'All' ||
        (scope === 'Featured' && template.featured) ||
        (scope === 'Free' && template.tier === 'Free') ||
        (scope === 'Pro' && template.tier === 'Pro')
      return (
        matchesQuery &&
        matchesScope &&
        (category === 'All' || template.category === category) &&
        (format === 'All' || template.format === format) &&
        (audience === 'All' || template.audience === audience) &&
        (sourceName === 'All' || template.sourceName === sourceName)
      )
    })
    .sort((left, right) => {
      if (sort === 'A–Z') return left.title.localeCompare(right.title)
      if (sort === 'Recently updated') {
        return templates.indexOf(left) - templates.indexOf(right)
      }
      return right.uses - left.uses
    })
  const activeFilterCount = [
    scope !== 'All',
    category !== 'All',
    format !== 'All',
    audience !== 'All',
    sourceName !== 'All',
  ].filter(Boolean).length
  const connectedSources = config.dataSources.filter(
    (source) =>
      source.module === 'templates' &&
      source.enabled &&
      source.status === 'connected',
  ).length
  const totalUses = templates.reduce((sum, template) => sum + template.uses, 0)

  function clearTemplateFilters() {
    setScope('All')
    setCategory('All')
    setFormat('All')
    setAudience('All')
    setSourceName('All')
  }

  function stageTemplate(template: TemplateRecord) {
    setPersistentItem(
      selectedTemplateStorageKey,
      JSON.stringify(template),
    )
  }

  return (
    <section className="template-directory">
      <header className="funding-directory-header template-directory-header is-listing-topbar">
        <div>
          <h1>{t('workspacePages.templates.title')}</h1>
          <p>
            {t('workspacePages.templates.description')}
          </p>
        </div>
        <Link
          to="/admin#data-sources"
          className="funding-directory-admin"
          onClick={() => grantAdminAccess()}
        >
          <Glyph type="settings" />
          {t('workspacePages.common.manageDataSources')}
        </Link>
      </header>

      <div className="funding-directory-metrics template-directory-metrics">
        <article>
          <span>{t('workspacePages.templates.available')}</span>
          <strong>{templates.length}</strong>
          <small>{t('workspacePages.templates.activeLibraries')}</small>
        </article>
        <article>
          <span>{t('workspacePages.templates.communityUsage')}</span>
          <strong>
            {new Intl.NumberFormat('en-CA', {
              notation: 'compact',
              maximumFractionDigits: 1,
            }).format(totalUses)}
          </strong>
          <small>{t('workspacePages.templates.templateStarts')}</small>
        </article>
        <article>
          <span>{t('workspacePages.templates.freeTemplates')}</span>
          <strong>{templates.filter((template) => template.tier === 'Free').length}</strong>
          <small>{t('workspacePages.templates.readyImmediately')}</small>
        </article>
        <article className="is-source-metric">
          <span>{t('workspacePages.common.connectedDataSources')}</span>
          <strong>{connectedSources}</strong>
          <small>
            {
              config.dataSources.filter(
                (source) => source.module === 'templates' && source.enabled,
              ).length
            }{' '}
            {t('workspacePages.common.enabled')}
          </small>
        </article>
      </div>

      <section className="funding-directory-results template-directory-results">
        <div className="funding-directory-toolbar template-directory-toolbar">
          <label>
            <Glyph type="search" />
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={t('workspacePages.templates.search')}
            />
          </label>
          <div>
            {(['All', 'Featured', 'Free', 'Pro'] as const).map((scopeName) => (
              <button
                key={scopeName}
                type="button"
                className={scope === scopeName ? 'is-selected' : ''}
                aria-pressed={scope === scopeName}
                onClick={() => setScope(scopeName)}
              >
                {scopeName === 'All' ? t('workspacePages.templates.all') : scopeName === 'Featured' ? t('workspacePages.templates.featured') : scopeName === 'Free' ? t('workspacePages.templates.free') : t('workspacePages.templates.pro')}
              </button>
            ))}
          </div>
          <button
            type="button"
            className={`funding-filter-toggle ${
              filtersOpen || activeFilterCount > 0 ? 'is-active' : ''
            }`}
            aria-expanded={filtersOpen}
            onClick={() => setFiltersOpen((open) => !open)}
          >
            <Glyph type="settings" />
            {t('workspacePages.common.filters')}
            {activeFilterCount ? <b>{activeFilterCount}</b> : null}
          </button>
          <span>
            {visibleTemplates.length} {t('workspacePages.common.templates')}
          </span>
        </div>

        {filtersOpen ? (
          <div className="funding-directory-filter-panel">
            <div className="funding-filter-heading">
              <div>
                <strong>{t('workspacePages.templates.refine')}</strong>
                <span>{t('workspacePages.templates.refineHint')}</span>
              </div>
              {activeFilterCount ? (
                <button type="button" onClick={clearTemplateFilters}>{t('workspacePages.common.clearAll')}</button>
              ) : null}
            </div>
            <div className="funding-filter-fields template-filter-fields">
              <label>
                <span>{t('workspacePages.templates.allCategories')}</span>
                <select
                  value={category}
                  onChange={(event) => setCategory(event.target.value)}
                >
                  <option value="All">{t('workspacePages.templates.allCategories')}</option>
                  {categories.map((categoryName) => (
                    <option key={categoryName}>{categoryName}</option>
                  ))}
                </select>
              </label>
              <label>
                <span>{t('workspacePages.templates.allFormats')}</span>
                <select
                  value={format}
                  onChange={(event) =>
                    setFormat(event.target.value as 'All' | TemplateFormat)
                  }
                >
                  <option value="All">{t('workspacePages.templates.allFormats')}</option>
                  {(['DOCX', 'XLSX', 'PDF', 'Notion'] as const).map(
                    (formatName) => (
                      <option key={formatName}>{formatName}</option>
                    ),
                  )}
                </select>
              </label>
              <label>
                <span>{t('workspacePages.templates.allAudiences')}</span>
                <select
                  value={audience}
                  onChange={(event) => setAudience(event.target.value)}
                >
                  <option value="All">{t('workspacePages.templates.allAudiences')}</option>
                  {audiences.map((audienceName) => (
                    <option key={audienceName}>{audienceName}</option>
                  ))}
                </select>
              </label>
              <label>
                <span>{t('workspacePages.grantsLoans.dataSource')}</span>
                <select
                  value={sourceName}
                  onChange={(event) => setSourceName(event.target.value)}
                >
                  <option value="All">{t('workspacePages.grantsLoans.allSources')}</option>
                  {sources.map((source) => (
                    <option key={source}>{source}</option>
                  ))}
                </select>
              </label>
              <label>
                <span>{t('workspacePages.socialResources.sortBy')}</span>
                <select
                  value={sort}
                  onChange={(event) =>
                    setSort(
                      event.target.value as
                        | 'Most used'
                        | 'Recently updated'
                        | 'A–Z',
                    )
                  }
                >
                  <option>Most used</option>
                  <option>Recently updated</option>
                  <option>A–Z</option>
                </select>
              </label>
            </div>
          </div>
        ) : null}

        {activeFilterCount ? (
          <div className="funding-active-filters">
            <span>{activeFilterCount} active</span>
            {scope !== 'All' ? (
              <button type="button" onClick={() => setScope('All')}>
                {scope} <b>×</b>
              </button>
            ) : null}
            {category !== 'All' ? (
              <button type="button" onClick={() => setCategory('All')}>
                {category} <b>×</b>
              </button>
            ) : null}
            {format !== 'All' ? (
              <button type="button" onClick={() => setFormat('All')}>
                {format} <b>×</b>
              </button>
            ) : null}
            {audience !== 'All' ? (
              <button type="button" onClick={() => setAudience('All')}>
                {audience} <b>×</b>
              </button>
            ) : null}
            {sourceName !== 'All' ? (
              <button type="button" onClick={() => setSourceName('All')}>
                {sourceName} <b>×</b>
              </button>
            ) : null}
          </div>
        ) : null}

        <div className="template-directory-grid">
          {visibleTemplates.map((template) => (
            <article key={template.id} className="template-directory-card">
              <div className="template-card-topline">
                <span className={`template-format is-${template.format.toLowerCase()}`}>
                  {template.format}
                </span>
                <span className={`template-tier is-${template.tier.toLowerCase()}`}>
                  {template.tier}
                </span>
              </div>
              <div className="template-card-icon">
                <Glyph type={template.format === 'XLSX' ? 'grid' : 'file'} />
              </div>
              <div className="template-card-copy">
                <small>{template.category}</small>
                <h2>{template.title}</h2>
                <p>{template.description}</p>
              </div>
              <div className="template-card-meta">
                <span>{template.audience}</span>
                <span>
                  {template.uses
                    ? `${template.uses.toLocaleString('en-CA')} uses`
                    : 'Synced resource'}
                </span>
              </div>
              <footer>
                <span title={template.sourceName}>
                  <i className={template.sourceId ? 'is-external' : ''} />
                  {template.sourceName}
                </span>
                <div>
                  <button type="button" onClick={() => setSelectedTemplate(template)}>
                    Preview
                  </button>
                  <Link to="/quick-build" onClick={() => stageTemplate(template)}>
                    Use template
                  </Link>
                </div>
              </footer>
            </article>
          ))}
        </div>

        {visibleTemplates.length === 0 ? (
          <div className="workspace-empty">
            <span><Glyph type="search" /></span>
            <strong>No matching templates</strong>
            <p>Try another search term or reset the active filters.</p>
            <button
              type="button"
              onClick={() => {
                setQuery('')
                clearTemplateFilters()
              }}
            >
              Clear filters
            </button>
          </div>
        ) : null}
      </section>

      {selectedTemplate ? (
        <div
          className="clone-record-dialog-backdrop"
          role="presentation"
          onMouseDown={() => setSelectedTemplate(null)}
        >
          <section
            className="clone-record-dialog template-preview-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="template-preview-title"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              className="clone-dialog-close"
              aria-label="Close template preview"
              onClick={() => setSelectedTemplate(null)}
            >
              <Glyph type="close" />
            </button>
            <span className="clone-record-status">{selectedTemplate.format}</span>
            <div className="template-preview-visual">
              <span><Glyph type={selectedTemplate.format === 'XLSX' ? 'grid' : 'file'} /></span>
              <div>
                <i />
                <i />
                <i />
                <i />
              </div>
            </div>
            <h2 id="template-preview-title">{selectedTemplate.title}</h2>
            <p>{selectedTemplate.description}</p>
            <dl>
              <div><dt>Category</dt><dd>{selectedTemplate.category}</dd></div>
              <div><dt>Format</dt><dd>{selectedTemplate.format}</dd></div>
              <div><dt>Best for</dt><dd>{selectedTemplate.audience}</dd></div>
              <div><dt>Access</dt><dd>{selectedTemplate.tier}</dd></div>
              <div><dt>Source</dt><dd>{selectedTemplate.sourceName}</dd></div>
              <div><dt>Updated</dt><dd>{selectedTemplate.updatedAt}</dd></div>
            </dl>
            <div className="template-preview-actions">
              {selectedTemplate.url ? (
                <a href={selectedTemplate.url} target="_blank" rel="noreferrer">
                  View source
                </a>
              ) : (
                <button type="button" onClick={() => setSelectedTemplate(null)}>
                  Close
                </button>
              )}
              <Link to="/quick-build" onClick={() => stageTemplate(selectedTemplate)}>
                Use this template
              </Link>
            </div>
          </section>
        </div>
      ) : null}
    </section>
  )
}

const pinnedSocialResourceStorageKey = 'bconomics-pinned-social-resources-v1'

function SocialResourcesPage() {
  const { t } = useTranslation()
  const { config } = usePlatformConfig()
  const enabledSourceIds = config.dataSources
    .filter((source) => source.enabled && source.module === 'social-resources')
    .map((source) => source.id)
  const synchronizedResources = loadResourceRecords(
    'social-resources',
    enabledSourceIds,
  )
  const resources = loadSocialResourceCatalog(synchronizedResources)
  const [query, setQuery] = useState('')
  const [scope, setScope] = useState<
    'All' | 'People' | 'Organizations' | 'Verified'
  >('All')
  const [filtersOpen, setFiltersOpen] = useState(true)
  const [resourceType, setResourceType] = useState<'All' | SocialResourceType>(
    'All',
  )
  const [location, setLocation] = useState('All')
  const [stage, setStage] = useState('All')
  const [sector, setSector] = useState('All')
  const [sourceName, setSourceName] = useState('All')
  const [sort, setSort] = useState<'Verified first' | 'Recently updated' | 'A–Z'>(
    'Verified first',
  )
  const [selectedResource, setSelectedResource] =
    useState<SocialResourceRecord | null>(null)
  const [pinnedResourceIds, setPinnedResourceIds] = useState<string[]>(() => {
    try {
      const saved = window.localStorage.getItem(pinnedSocialResourceStorageKey)
      return saved ? (JSON.parse(saved) as string[]) : []
    } catch {
      return []
    }
  })
  const [notice, setNotice] = useState('')
  const resourceTypes = [...new Set(resources.map((resource) => resource.type))].sort()
  const locations = [...new Set(resources.map((resource) => resource.location))].sort()
  const stages = [...new Set(resources.flatMap((resource) => resource.stages))].sort()
  const sectors = [...new Set(resources.flatMap((resource) => resource.sectors))].sort()
  const sources = [...new Set(resources.map((resource) => resource.sourceName))].sort()
  const peopleTypes: SocialResourceType[] = [
    'Investor',
    'Angel Investor',
    'Advisor',
  ]
  const visibleResources = resources
    .filter((resource) => {
      const matchesQuery =
        `${resource.name} ${resource.description} ${resource.type} ${resource.organization} ${resource.location} ${resource.sectors.join(' ')} ${resource.stages.join(' ')} ${resource.sourceName}`
          .toLowerCase()
          .includes(query.trim().toLowerCase())
      const matchesScope =
        scope === 'All' ||
        (scope === 'People' && peopleTypes.includes(resource.type)) ||
        (scope === 'Organizations' && !peopleTypes.includes(resource.type)) ||
        (scope === 'Verified' && resource.verified)

      return (
        matchesQuery &&
        matchesScope &&
        (resourceType === 'All' || resource.type === resourceType) &&
        (location === 'All' || resource.location === location) &&
        (stage === 'All' || resource.stages.includes(stage)) &&
        (sector === 'All' || resource.sectors.includes(sector)) &&
        (sourceName === 'All' || resource.sourceName === sourceName)
      )
    })
    .sort((left, right) => {
      if (sort === 'A–Z') return left.name.localeCompare(right.name)
      if (sort === 'Recently updated') {
        return resources.indexOf(left) - resources.indexOf(right)
      }
      return Number(right.verified) - Number(left.verified)
    })
  const activeFilterCount = [
    scope !== 'All',
    resourceType !== 'All',
    location !== 'All',
    stage !== 'All',
    sector !== 'All',
    sourceName !== 'All',
  ].filter(Boolean).length
  const connectedSources = config.dataSources.filter(
    (source) =>
      source.module === 'social-resources' &&
      source.enabled &&
      source.status === 'connected',
  ).length
  const organizationCount = resources.filter(
    (resource) => !peopleTypes.includes(resource.type),
  ).length
  const verifiedCount = resources.filter((resource) => resource.verified).length
  const locationCount = new Set(resources.map((resource) => resource.location)).size

  function clearSocialFilters() {
    setScope('All')
    setResourceType('All')
    setLocation('All')
    setStage('All')
    setSector('All')
    setSourceName('All')
  }

  function togglePinnedResource(resource: SocialResourceRecord) {
    const isPinned = pinnedResourceIds.includes(resource.id)
    const nextIds = isPinned
      ? pinnedResourceIds.filter((id) => id !== resource.id)
      : [...pinnedResourceIds, resource.id]
    setPinnedResourceIds(nextIds)
    setPersistentItem(
      pinnedSocialResourceStorageKey,
      JSON.stringify(nextIds),
    )
    setNotice(
      isPinned
        ? `${resource.name} removed from your contacts.`
        : `${resource.name} saved to your contacts.`,
    )
  }

  return (
    <section className="social-directory">
      <header className="funding-directory-header social-directory-header is-listing-topbar">
        <div>
          <h1>{t('workspacePages.socialResources.title')}</h1>
          <p>
            {t('workspacePages.socialResources.description')}
          </p>
        </div>
        <Link
          to="/admin#data-sources"
          className="funding-directory-admin"
          onClick={() => grantAdminAccess()}
        >
          <Glyph type="settings" />
          {t('workspacePages.common.manageDataSources')}
        </Link>
      </header>

      {notice ? (
        <div className="workspace-inline-notice" role="status">
          <span>{notice}</span>
          <button type="button" onClick={() => setNotice('')} aria-label="Dismiss notice">
            <Glyph type="close" />
          </button>
        </div>
      ) : null}

      <div className="funding-directory-metrics social-directory-metrics">
        <article>
          <span>{t('workspacePages.socialResources.networkRecords')}</span>
          <strong>{resources.length}</strong>
          <small>{t('workspacePages.socialResources.peopleOrganizations')}</small>
        </article>
        <article>
          <span>{t('workspacePages.socialResources.verifiedProfiles')}</span>
          <strong>{verifiedCount}</strong>
          <small>{t('workspacePages.socialResources.reviewedByNetwork')}</small>
        </article>
        <article>
          <span>{t('workspacePages.socialResources.organizations')}</span>
          <strong>{organizationCount}</strong>
          <small>{t('workspacePages.socialResources.fundsAccelerators')}</small>
        </article>
        <article>
          <span>{t('workspacePages.socialResources.markets')}</span>
          <strong>{locationCount}</strong>
          <small>{connectedSources} {t('workspacePages.common.connectedDataSources')}</small>
        </article>
      </div>

      <section className="funding-directory-results social-directory-results">
        <div className="funding-directory-toolbar social-directory-toolbar">
          <label>
            <Glyph type="search" />
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={t('workspacePages.socialResources.search')}
            />
          </label>
          <div>
            {(['All', 'People', 'Organizations', 'Verified'] as const).map((scopeName) => (
              <button
                key={scopeName}
                type="button"
                className={scope === scopeName ? 'is-selected' : ''}
                aria-pressed={scope === scopeName}
                onClick={() => setScope(scopeName)}
              >
                {scopeName === 'All' ? t('workspacePages.common.all') : scopeName === 'People' ? t('workspacePages.socialResources.peopleOrganizations') : scopeName === 'Organizations' ? t('workspacePages.socialResources.organizations') : t('workspacePages.socialResources.verifiedProfiles')}
              </button>
            ))}
          </div>
          <button
            type="button"
            className={`funding-filter-toggle ${
              filtersOpen || activeFilterCount > 0 ? 'is-active' : ''
            }`}
            aria-expanded={filtersOpen}
            onClick={() => setFiltersOpen((open) => !open)}
          >
            <Glyph type="settings" />
            {t('workspacePages.common.filters')}
            {activeFilterCount ? <b>{activeFilterCount}</b> : null}
          </button>
          <span>
            {visibleResources.length} {t('workspacePages.common.records')}
          </span>
        </div>

        {filtersOpen ? (
          <div className="funding-directory-filter-panel">
            <div className="funding-filter-heading">
              <div>
                <strong>{t('workspacePages.socialResources.refine')}</strong>
                <span>{t('workspacePages.socialResources.refineHint')}</span>
              </div>
              {activeFilterCount ? (
                <button type="button" onClick={clearSocialFilters}>{t('workspacePages.common.clearAll')}</button>
              ) : null}
            </div>
            <div className="funding-filter-fields social-filter-fields">
              <label>
                <span>{t('workspacePages.socialResources.profileType')}</span>
                <select
                  value={resourceType}
                  onChange={(event) =>
                    setResourceType(
                      event.target.value as 'All' | SocialResourceType,
                    )
                  }
                >
                  <option value="All">{t('workspacePages.socialResources.allProfileTypes')}</option>
                  {resourceTypes.map((typeName) => (
                    <option key={typeName}>{typeName}</option>
                  ))}
                </select>
              </label>
              <label>
                <span>{t('workspacePages.socialResources.location')}</span>
                <select
                  value={location}
                  onChange={(event) => setLocation(event.target.value)}
                >
                  <option value="All">{t('workspacePages.socialResources.allLocations')}</option>
                  {locations.map((locationName) => (
                    <option key={locationName}>{locationName}</option>
                  ))}
                </select>
              </label>
              <label>
                <span>Investment stage</span>
                <select value={stage} onChange={(event) => setStage(event.target.value)}>
                  <option value="All">All stages</option>
                  {stages.map((stageName) => (
                    <option key={stageName}>{stageName}</option>
                  ))}
                </select>
              </label>
              <label>
                <span>Sector</span>
                <select value={sector} onChange={(event) => setSector(event.target.value)}>
                  <option value="All">All sectors</option>
                  {sectors.map((sectorName) => (
                    <option key={sectorName}>{sectorName}</option>
                  ))}
                </select>
              </label>
              <label>
                <span>Data source</span>
                <select
                  value={sourceName}
                  onChange={(event) => setSourceName(event.target.value)}
                >
                  <option value="All">All sources</option>
                  {sources.map((source) => (
                    <option key={source}>{source}</option>
                  ))}
                </select>
              </label>
              <label>
                <span>Sort by</span>
                <select
                  value={sort}
                  onChange={(event) =>
                    setSort(
                      event.target.value as
                        | 'Verified first'
                        | 'Recently updated'
                        | 'A–Z',
                    )
                  }
                >
                  <option>Verified first</option>
                  <option>Recently updated</option>
                  <option>A–Z</option>
                </select>
              </label>
            </div>
          </div>
        ) : null}

        {activeFilterCount ? (
          <div className="funding-active-filters">
            <span>{activeFilterCount} active</span>
            {scope !== 'All' ? (
              <button type="button" onClick={() => setScope('All')}>
                {scope} <b>×</b>
              </button>
            ) : null}
            {resourceType !== 'All' ? (
              <button type="button" onClick={() => setResourceType('All')}>
                {resourceType} <b>×</b>
              </button>
            ) : null}
            {location !== 'All' ? (
              <button type="button" onClick={() => setLocation('All')}>
                {location} <b>×</b>
              </button>
            ) : null}
            {stage !== 'All' ? (
              <button type="button" onClick={() => setStage('All')}>
                {stage} <b>×</b>
              </button>
            ) : null}
            {sector !== 'All' ? (
              <button type="button" onClick={() => setSector('All')}>
                {sector} <b>×</b>
              </button>
            ) : null}
            {sourceName !== 'All' ? (
              <button type="button" onClick={() => setSourceName('All')}>
                {sourceName} <b>×</b>
              </button>
            ) : null}
          </div>
        ) : null}

        <div className="social-resource-grid">
          {visibleResources.map((resource) => {
            const isPinned = pinnedResourceIds.includes(resource.id)
            const typeClass = resource.type.toLowerCase().replaceAll(' ', '-')
            const initials = resource.name
              .split(' ')
              .slice(0, 2)
              .map((part) => part[0])
              .join('')

            return (
              <article key={resource.id} className="social-resource-card">
                <div className="social-resource-card-topline">
                  <span className={`social-channel is-${typeClass}`}>
                    {resource.type}
                  </span>
                  {resource.verified ? (
                    <span className="social-verified">Verified</span>
                  ) : (
                    <span className="social-unverified">Community</span>
                  )}
                </div>
                <div className={`social-profile-summary is-${typeClass}`}>
                  <span>{initials}</span>
                  <div>
                    <strong>{resource.organization}</strong>
                    <small>{resource.location}</small>
                  </div>
                  <b>{resource.ticket}</b>
                </div>
                <div className="social-resource-copy">
                  <small>{resource.connection}</small>
                  <h2>{resource.name}</h2>
                  <p>{resource.description}</p>
                </div>
                <div className="social-resource-meta">
                  {resource.sectors.slice(0, 2).map((resourceSector) => (
                    <span key={resourceSector}>{resourceSector}</span>
                  ))}
                  <span>{resource.stages.join(' · ')}</span>
                </div>
                <footer>
                  <span title={resource.sourceName}>
                    <i className={resource.sourceId ? 'is-external' : ''} />
                    {resource.sourceName}
                  </span>
                  <div>
                    <button
                      type="button"
                      className={isPinned ? 'is-pinned' : ''}
                      onClick={() => togglePinnedResource(resource)}
                    >
                      {isPinned ? 'Saved' : 'Save'}
                    </button>
                    <button type="button" onClick={() => setSelectedResource(resource)}>
                      View profile
                    </button>
                  </div>
                </footer>
              </article>
            )
          })}
        </div>

        {visibleResources.length === 0 ? (
          <div className="workspace-empty">
            <span><Glyph type="search" /></span>
            <strong>No matching people or organizations</strong>
            <p>Try another search term or reset the active filters.</p>
            <button
              type="button"
              onClick={() => {
                setQuery('')
                clearSocialFilters()
              }}
            >
              Clear filters
            </button>
          </div>
        ) : null}
      </section>

      {selectedResource ? (
        <div
          className="clone-record-dialog-backdrop"
          role="presentation"
          onMouseDown={() => setSelectedResource(null)}
        >
          <section
            className="clone-record-dialog social-resource-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="social-resource-dialog-title"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              className="clone-dialog-close"
              aria-label="Close profile"
              onClick={() => setSelectedResource(null)}
            >
              <Glyph type="close" />
            </button>
            <span className="clone-record-status">{selectedResource.type}</span>
            <div className="social-profile-detail-header">
              <span>
                {selectedResource.name
                  .split(' ')
                  .slice(0, 2)
                  .map((part) => part[0])
                  .join('')}
              </span>
              <div>
                <strong>{selectedResource.organization}</strong>
                <small>{selectedResource.location}</small>
              </div>
              {selectedResource.verified ? <b>Verified profile</b> : null}
            </div>
            <h2 id="social-resource-dialog-title">{selectedResource.name}</h2>
            <p>{selectedResource.description}</p>
            <dl>
              <div><dt>Profile type</dt><dd>{selectedResource.type}</dd></div>
              <div><dt>Organization</dt><dd>{selectedResource.organization}</dd></div>
              <div><dt>Location</dt><dd>{selectedResource.location}</dd></div>
              <div><dt>Investment stage</dt><dd>{selectedResource.stages.join(', ')}</dd></div>
              <div><dt>Typical ticket</dt><dd>{selectedResource.ticket}</dd></div>
              <div><dt>Connection</dt><dd>{selectedResource.connection}</dd></div>
              <div className="social-profile-sectors">
                <dt>Sectors</dt>
                <dd>{selectedResource.sectors.join(', ')}</dd>
              </div>
              <div><dt>Source</dt><dd>{selectedResource.sourceName}</dd></div>
            </dl>
            <div className="social-resource-dialog-actions">
              {selectedResource.url ? (
                <a href={selectedResource.url} target="_blank" rel="noreferrer">
                  Open external profile
                </a>
              ) : (
                <button type="button" onClick={() => setSelectedResource(null)}>
                  Close profile
                </button>
              )}
              <button
                type="button"
                className="is-primary"
                onClick={() => togglePinnedResource(selectedResource)}
              >
                {pinnedResourceIds.includes(selectedResource.id)
                  ? 'Remove from contacts'
                  : 'Save to contacts'}
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </section>
  )
}

const savedToolStorageKey = 'bconomics-saved-tools-v1'

function ToolsPage() {
  const { t } = useTranslation()
  const { config } = usePlatformConfig()
  const enabledSourceIds = config.dataSources
    .filter((source) => source.enabled && source.module === 'tools')
    .map((source) => source.id)
  const tools = loadToolCatalog(loadResourceRecords('tools', enabledSourceIds))
  const [query, setQuery] = useState('')
  const [scope, setScope] = useState<
    'All' | 'Featured' | 'Free plans' | 'Canada'
  >('All')
  const [filtersOpen, setFiltersOpen] = useState(true)
  const [category, setCategory] = useState('All')
  const [toolType, setToolType] = useState<'All' | ToolType>('All')
  const [pricing, setPricing] = useState<'All' | ToolPricing>('All')
  const [region, setRegion] = useState('All')
  const [sourceName, setSourceName] = useState('All')
  const [sort, setSort] = useState<'Most visited' | 'Recently updated' | 'A–Z'>(
    'Most visited',
  )
  const [selectedTool, setSelectedTool] = useState<ToolRecord | null>(null)
  const [savedToolIds, setSavedToolIds] = useState<string[]>(() => {
    try {
      const saved = window.localStorage.getItem(savedToolStorageKey)
      return saved ? (JSON.parse(saved) as string[]) : []
    } catch {
      return []
    }
  })
  const [notice, setNotice] = useState('')
  const categories = [...new Set(tools.map((tool) => tool.category))].sort()
  const sources = [...new Set(tools.map((tool) => tool.sourceName))].sort()
  const visibleTools = tools
    .filter((tool) => {
      const matchesQuery =
        `${tool.name} ${tool.description} ${tool.category} ${tool.bestFor} ${tool.type} ${tool.provider} ${tool.tags.join(' ')}`
          .toLowerCase()
          .includes(query.trim().toLowerCase())
      const matchesScope =
        scope === 'All' ||
        (scope === 'Featured' && tool.featured) ||
        (scope === 'Free plans' && tool.pricing === 'Free plan') ||
        (scope === 'Canada' && tool.region === 'Canada')

      return (
        matchesQuery &&
        matchesScope &&
        (category === 'All' || tool.category === category) &&
        (toolType === 'All' || tool.type === toolType) &&
        (pricing === 'All' || tool.pricing === pricing) &&
        (region === 'All' || tool.region === region) &&
        (sourceName === 'All' || tool.sourceName === sourceName)
      )
    })
    .sort((left, right) => {
      if (sort === 'A–Z') return left.name.localeCompare(right.name)
      if (sort === 'Recently updated') return tools.indexOf(left) - tools.indexOf(right)
      return right.visits - left.visits
    })
  const activeFilterCount = [
    scope !== 'All',
    category !== 'All',
    toolType !== 'All',
    pricing !== 'All',
    region !== 'All',
    sourceName !== 'All',
  ].filter(Boolean).length
  const connectedSources = config.dataSources.filter(
    (source) =>
      source.module === 'tools' &&
      source.enabled &&
      source.status === 'connected',
  ).length
  const freeToolCount = tools.filter((tool) => tool.pricing === 'Free plan').length
  const categoryCount = new Set(tools.map((tool) => tool.category)).size

  function clearToolFilters() {
    setScope('All')
    setCategory('All')
    setToolType('All')
    setPricing('All')
    setRegion('All')
    setSourceName('All')
  }

  function toggleSavedTool(tool: ToolRecord) {
    const isSaved = savedToolIds.includes(tool.id)
    const nextIds = isSaved
      ? savedToolIds.filter((id) => id !== tool.id)
      : [...savedToolIds, tool.id]
    setSavedToolIds(nextIds)
    setPersistentItem(savedToolStorageKey, JSON.stringify(nextIds))
    setNotice(
      isSaved
        ? `${tool.name} removed from your saved tools.`
        : `${tool.name} saved to your founder stack.`,
    )
  }

  return (
    <section className="tool-directory">
      <header className="funding-directory-header tool-directory-header is-listing-topbar">
        <div>
          <h1>{t('workspacePages.tools.title')}</h1>
          <p>
            {t('workspacePages.tools.description')}
          </p>
        </div>
        <Link
          to="/admin#data-sources"
          className="funding-directory-admin"
          onClick={() => grantAdminAccess()}
        >
          <Glyph type="settings" />
          {t('workspacePages.common.manageDataSources')}
        </Link>
      </header>

      {notice ? (
        <div className="workspace-inline-notice" role="status">
          <span>{notice}</span>
          <button type="button" onClick={() => setNotice('')} aria-label="Dismiss notice">
            <Glyph type="close" />
          </button>
        </div>
      ) : null}

      <div className="funding-directory-metrics tool-directory-metrics">
        <article>
          <span>{t('workspacePages.tools.available')}</span>
          <strong>{tools.length}</strong>
          <small>{t('workspacePages.tools.categories')}</small>
        </article>
        <article>
          <span>{t('workspacePages.tools.freePlans')}</span>
          <strong>{freeToolCount}</strong>
          <small>{t('workspacePages.tools.free')}</small>
        </article>
        <article>
          <span>{t('workspacePages.tools.businessCategories')}</span>
          <strong>{categoryCount}</strong>
          <small>{t('workspacePages.tools.categories')}</small>
        </article>
        <article>
          <span>{t('workspacePages.common.connectedDataSources')}</span>
          <strong>{connectedSources}</strong>
          <small>
            {
              config.dataSources.filter(
                (source) => source.module === 'tools' && source.enabled,
              ).length
            }{' '}
            {t('workspacePages.common.enabled')}
          </small>
        </article>
      </div>

      <div className="tool-directory-disclosure">
        <Glyph type="spark" />
        <p>
          {t('workspacePages.tools.refineHint')}
        </p>
      </div>

      <section className="funding-directory-results tool-directory-results">
        <div className="funding-directory-toolbar tool-directory-toolbar">
          <label>
            <Glyph type="search" />
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={t('workspacePages.tools.search')}
            />
          </label>
          <div>
            {(['All', 'Featured', 'Free plans', 'Canada'] as const).map(
              (scopeName) => (
                <button
                  key={scopeName}
                  type="button"
                  className={scope === scopeName ? 'is-selected' : ''}
                  aria-pressed={scope === scopeName}
                  onClick={() => setScope(scopeName)}
                >
                {scopeName === 'All' ? t('workspacePages.common.all') : scopeName === 'Featured' ? t('workspacePages.templates.featured') : scopeName === 'Free plans' ? t('workspacePages.tools.free') : scopeName}
                </button>
              ),
            )}
          </div>
          <button
            type="button"
            className={`funding-filter-toggle ${
              filtersOpen || activeFilterCount > 0 ? 'is-active' : ''
            }`}
            aria-expanded={filtersOpen}
            onClick={() => setFiltersOpen((open) => !open)}
          >
            <Glyph type="settings" />
            {t('workspacePages.common.filters')}
            {activeFilterCount ? <b>{activeFilterCount}</b> : null}
          </button>
          <span>
            {visibleTools.length} {t('workspacePages.tools.available')}
          </span>
        </div>

        {filtersOpen ? (
          <div className="funding-directory-filter-panel">
            <div className="funding-filter-heading">
              <div>
                <strong>{t('workspacePages.tools.refine')}</strong>
                <span>{t('workspacePages.tools.refineHint')}</span>
              </div>
              {activeFilterCount ? (
                <button type="button" onClick={clearToolFilters}>{t('workspacePages.common.clearAll')}</button>
              ) : null}
            </div>
            <div className="funding-filter-fields tool-filter-fields">
              <label>
                <span>{t('workspacePages.tools.category')}</span>
                <select
                  value={category}
                  onChange={(event) => setCategory(event.target.value)}
                >
                  <option value="All">{t('workspacePages.tools.allCategories')}</option>
                  {categories.map((categoryName) => (
                    <option key={categoryName}>{categoryName}</option>
                  ))}
                </select>
              </label>
              <label>
                <span>Product type</span>
                <select
                  value={toolType}
                  onChange={(event) =>
                    setToolType(event.target.value as 'All' | ToolType)
                  }
                >
                  <option value="All">All product types</option>
                  {(
                    [
                      'Software',
                      'Cloud Service',
                      'Financial Service',
                      'Credit Card',
                    ] as const
                  ).map((typeName) => (
                    <option key={typeName}>{typeName}</option>
                  ))}
                </select>
              </label>
              <label>
                <span>Pricing</span>
                <select
                  value={pricing}
                  onChange={(event) =>
                    setPricing(event.target.value as 'All' | ToolPricing)
                  }
                >
                  <option value="All">All pricing models</option>
                  {(
                    ['Free plan', 'Paid plans', 'Usage-based', 'Compare offers'] as const
                  ).map((pricingName) => (
                    <option key={pricingName}>{pricingName}</option>
                  ))}
                </select>
              </label>
              <label>
                <span>Availability</span>
                <select
                  value={region}
                  onChange={(event) => setRegion(event.target.value)}
                >
                  <option value="All">All regions</option>
                  <option>Canada</option>
                  <option>Global</option>
                </select>
              </label>
              <label>
                <span>Data source</span>
                <select
                  value={sourceName}
                  onChange={(event) => setSourceName(event.target.value)}
                >
                  <option value="All">All sources</option>
                  {sources.map((source) => (
                    <option key={source}>{source}</option>
                  ))}
                </select>
              </label>
              <label>
                <span>Sort by</span>
                <select
                  value={sort}
                  onChange={(event) =>
                    setSort(
                      event.target.value as
                        | 'Most visited'
                        | 'Recently updated'
                        | 'A–Z',
                    )
                  }
                >
                  <option>Most visited</option>
                  <option>Recently updated</option>
                  <option>A–Z</option>
                </select>
              </label>
            </div>
          </div>
        ) : null}

        {activeFilterCount ? (
          <div className="funding-active-filters">
            <span>{activeFilterCount} active</span>
            {scope !== 'All' ? (
              <button type="button" onClick={() => setScope('All')}>
                {scope} <b>×</b>
              </button>
            ) : null}
            {category !== 'All' ? (
              <button type="button" onClick={() => setCategory('All')}>
                {category} <b>×</b>
              </button>
            ) : null}
            {toolType !== 'All' ? (
              <button type="button" onClick={() => setToolType('All')}>
                {toolType} <b>×</b>
              </button>
            ) : null}
            {pricing !== 'All' ? (
              <button type="button" onClick={() => setPricing('All')}>
                {pricing} <b>×</b>
              </button>
            ) : null}
            {region !== 'All' ? (
              <button type="button" onClick={() => setRegion('All')}>
                {region} <b>×</b>
              </button>
            ) : null}
            {sourceName !== 'All' ? (
              <button type="button" onClick={() => setSourceName('All')}>
                {sourceName} <b>×</b>
              </button>
            ) : null}
          </div>
        ) : null}

        <div className="tool-directory-grid">
          {visibleTools.map((tool) => {
            const isSaved = savedToolIds.includes(tool.id)
            const typeClass = tool.type.toLowerCase().replaceAll(' ', '-')
            const initials = tool.provider
              .split(' ')
              .slice(0, 2)
              .map((part) => part[0])
              .join('')

            return (
              <article key={tool.id} className="tool-directory-card">
                <div className="tool-card-topline">
                  <span className={`tool-type is-${typeClass}`}>{tool.type}</span>
                  <span className={`tool-pricing is-${tool.pricing.toLowerCase().replaceAll(' ', '-')}`}>
                    {tool.pricing}
                  </span>
                </div>
                <div className={`tool-provider is-${typeClass}`}>
                  <span>{initials}</span>
                  <div>
                    <strong>{tool.provider}</strong>
                    <small>{tool.region}</small>
                  </div>
                  {tool.partnerOffer ? <b>Partner offer</b> : null}
                </div>
                <div className="tool-card-copy">
                  <small>{tool.category}</small>
                  <h2>{tool.name}</h2>
                  <p>{tool.description}</p>
                </div>
                <div className="tool-card-tags">
                  {tool.tags.slice(0, 3).map((tag) => (
                    <span key={tag}>{tag}</span>
                  ))}
                </div>
                <footer>
                  <span title={tool.sourceName}>
                    <i className={tool.sourceId ? 'is-external' : ''} />
                    {tool.sourceName}
                  </span>
                  <div>
                    <button
                      type="button"
                      className={isSaved ? 'is-saved' : ''}
                      onClick={() => toggleSavedTool(tool)}
                    >
                      {isSaved ? 'Saved' : 'Save'}
                    </button>
                    <button type="button" onClick={() => setSelectedTool(tool)}>
                      Details
                    </button>
                    <a href={tool.url} target="_blank" rel="noreferrer">
                      Visit
                    </a>
                  </div>
                </footer>
              </article>
            )
          })}
        </div>

        {visibleTools.length === 0 ? (
          <div className="workspace-empty">
            <span><Glyph type="search" /></span>
            <strong>No matching products</strong>
            <p>Try another search term or reset the active filters.</p>
            <button
              type="button"
              onClick={() => {
                setQuery('')
                clearToolFilters()
              }}
            >
              Clear filters
            </button>
          </div>
        ) : null}
      </section>

      {selectedTool ? (
        <div
          className="clone-record-dialog-backdrop"
          role="presentation"
          onMouseDown={() => setSelectedTool(null)}
        >
          <section
            className="clone-record-dialog tool-detail-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="tool-detail-title"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              className="clone-dialog-close"
              aria-label="Close product details"
              onClick={() => setSelectedTool(null)}
            >
              <Glyph type="close" />
            </button>
            <span className="clone-record-status">{selectedTool.type}</span>
            <div className="tool-detail-provider">
              <span>
                {selectedTool.provider
                  .split(' ')
                  .slice(0, 2)
                  .map((part) => part[0])
                  .join('')}
              </span>
              <div>
                <strong>{selectedTool.provider}</strong>
                <small>{selectedTool.category}</small>
              </div>
              <b>{selectedTool.pricing}</b>
            </div>
            <h2 id="tool-detail-title">{selectedTool.name}</h2>
            <p>{selectedTool.description}</p>
            <dl>
              <div><dt>Product type</dt><dd>{selectedTool.type}</dd></div>
              <div><dt>Best for</dt><dd>{selectedTool.bestFor}</dd></div>
              <div><dt>Availability</dt><dd>{selectedTool.region}</dd></div>
              <div><dt>Pricing model</dt><dd>{selectedTool.pricing}</dd></div>
              <div><dt>Provider</dt><dd>{selectedTool.provider}</dd></div>
              <div><dt>Data source</dt><dd>{selectedTool.sourceName}</dd></div>
            </dl>
            <div className="tool-detail-actions">
              <button type="button" onClick={() => toggleSavedTool(selectedTool)}>
                {savedToolIds.includes(selectedTool.id)
                  ? 'Remove from saved tools'
                  : 'Save to founder stack'}
              </button>
              <a href={selectedTool.url} target="_blank" rel="noreferrer">
                Visit provider
              </a>
            </div>
          </section>
        </div>
      ) : null}
    </section>
  )
}

type WorkspaceKind =
  | 'Founder workspace'
  | 'Partner workspace'
  | 'Client workspace'

type WorkspaceRecord = {
  id: string
  name: string
  kind: WorkspaceKind
}

const workspaceStorageKey = 'bconomics-workspaces-v2'
const activeWorkspaceStorageKey = 'bconomics-active-workspace-v2'
const defaultWorkspaces: WorkspaceRecord[] = [
  {
    id: 'community-workspace',
    name: 'Community workspace',
    kind: 'Founder workspace',
  },
]

function loadWorkspaceRecords(): WorkspaceRecord[] {
  if (typeof window === 'undefined') return defaultWorkspaces

  try {
    const saved = window.localStorage.getItem(workspaceStorageKey)
    if (!saved) return defaultWorkspaces

    const parsed = JSON.parse(saved) as WorkspaceRecord[]
    return Array.isArray(parsed) && parsed.length > 0
      ? parsed
      : defaultWorkspaces
  } catch {
    return defaultWorkspaces
  }
}

function loadActiveWorkspaceId(workspaces: WorkspaceRecord[]) {
  if (typeof window === 'undefined') return workspaces[0]?.id ?? ''

  const saved = window.localStorage.getItem(activeWorkspaceStorageKey)
  return workspaces.some((workspace) => workspace.id === saved)
    ? (saved as string)
    : (workspaces[0]?.id ?? '')
}

function getWorkspaceInitials(name: string) {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0])
      .join('')
      .toUpperCase() || 'WS'
  )
}

type SettingsSection =
  | 'profile'
  | 'workspace'
  | 'notifications'
  | 'security'
  | 'billing'

type UserSettings = {
  fullName: string
  email: string
  phone: string
  role: string
  defaultCompanyId: string
  timezone: string
  language: SupportedLocale
  currency: string
  weeklyDigest: boolean
  deadlineReminders: boolean
  productUpdates: boolean
  securityAlerts: boolean
  twoFactor: boolean
  sessionTimeout: string
  billingCycle: 'monthly' | 'annual'
  stripeCustomerId: string
  stripeSubscriptionId: string
  activePriceItemId: string
}

type BillingTransaction = {
  id: string
  date: string
  amount: string
  currency: PaymentCatalogItem['currency']
  status: string
  priceItemId: string
  label: string
}

type LegacyUserSettings = Partial<UserSettings> & {
  billingTransactions?: BillingTransaction[]
}

type QuickBuildPreferences = {
  usePlatformStructureByDefault: boolean
}

const userSettingsStorageKey = 'bconomics-user-settings-v1'
const billingTransactionsStorageKey = 'bconomics-billing-transactions-v1'
const quickBuildPreferencesStorageKey =
  'bconomics-quick-build-preferences-v1'
const pendingStripeCheckoutStorageKey = 'bconomics-pending-stripe-checkout-v1'
const pendingStripeCheckoutPriceItemStorageKey =
  'bconomics-pending-stripe-price-item-v1'

const defaultUserSettings: UserSettings = {
  fullName: 'Alex Morgan',
  email: 'alex@northstarfoods.ca',
  phone: '+1 416 555 0198',
  role: 'Workspace Admin',
  defaultCompanyId: 'northstar-foods',
  timezone: 'America/Toronto',
  language: 'en-CA',
  currency: 'CAD',
  weeklyDigest: true,
  deadlineReminders: true,
  productUpdates: false,
  securityAlerts: true,
  twoFactor: false,
  sessionTimeout: '30 minutes',
  billingCycle: 'monthly',
  stripeCustomerId: '',
  stripeSubscriptionId: '',
  activePriceItemId: '',
}

const defaultQuickBuildPreferences: QuickBuildPreferences = {
  usePlatformStructureByDefault: true,
}

function loadUserSettings() {
  const normalizeSettings = (settings: UserSettings): UserSettings => {
    const companies = loadCompanyRecords()
    if (
      settings.defaultCompanyId &&
      companies.some((company) => company.id === settings.defaultCompanyId)
    ) {
      return settings
    }

    return {
      ...settings,
      defaultCompanyId: companies[0]?.id ?? '',
    }
  }

  try {
    const saved = window.localStorage.getItem(userSettingsStorageKey)
    if (!saved) return normalizeSettings(defaultUserSettings)

    const parsed = JSON.parse(saved) as LegacyUserSettings
    return normalizeSettings({
      ...defaultUserSettings,
      ...parsed,
      language: normalizeLocale(parsed.language),
    })
  } catch {
    return normalizeSettings(defaultUserSettings)
  }
}

function loadQuickBuildPreferences() {
  try {
    const saved = window.localStorage.getItem(quickBuildPreferencesStorageKey)
    return saved
      ? {
          ...defaultQuickBuildPreferences,
          ...(JSON.parse(saved) as Partial<QuickBuildPreferences>),
        }
      : defaultQuickBuildPreferences
  } catch {
    return defaultQuickBuildPreferences
  }
}

function resolveDefaultApplicationCompany() {
  const settings = loadUserSettings()
  const companies = loadCompanyRecords()
  const defaultCompany =
    companies.find((company) => company.id === settings.defaultCompanyId) ??
    companies[0] ??
    null

  return {
    company: defaultCompany,
    owner: defaultCompany?.owner?.trim() || settings.fullName.trim() || 'Workspace Admin',
  }
}

function loadBillingTransactions() {
  try {
    const savedTransactions = window.localStorage.getItem(
      billingTransactionsStorageKey,
    )
    if (savedTransactions) {
      return JSON.parse(savedTransactions) as BillingTransaction[]
    }

    const savedSettings = window.localStorage.getItem(userSettingsStorageKey)
    if (!savedSettings) return []

    const parsedSettings = JSON.parse(savedSettings) as LegacyUserSettings
    return Array.isArray(parsedSettings.billingTransactions)
      ? parsedSettings.billingTransactions
      : []
  } catch {
    return []
  }
}

function formatSettingsBillingAmount(
  amount: string,
  currency: PaymentCatalogItem['currency'],
) {
  const parsed = Number.parseFloat(amount.replace(/,/gu, ''))

  if (!Number.isFinite(parsed)) {
    return `${currency} ${amount}`
  }

  return new Intl.NumberFormat('en-CA', {
    style: 'currency',
    currency,
    maximumFractionDigits: parsed % 1 === 0 ? 0 : 2,
  }).format(parsed)
}

function isZeroCostPricingItem(item: PaymentCatalogItem | null) {
  if (!item) return false

  const parsed = Number.parseFloat(item.amount.replace(/,/gu, ''))
  return Number.isFinite(parsed) && parsed <= 0
}

function getPricingItemPlanLabel(item: PaymentCatalogItem | null) {
  if (!item) return 'No active plan'
  return item.isDefault || isZeroCostPricingItem(item) ? 'Free Account' : item.name
}

function formatBillingTransactionDate(date: string) {
  const parsed = new Date(date)

  if (Number.isNaN(parsed.getTime())) {
    return date
  }

  return new Intl.DateTimeFormat('en-CA', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(parsed)
}

function getNextPaymentDateLabel(
  item: PaymentCatalogItem | null,
  transactions: BillingTransaction[],
) {
  if (!item || isZeroCostPricingItem(item) || item.billingType === 'one-time') {
    return '--'
  }

  const latestTransaction = [...transactions]
    .filter((transaction) => transaction.priceItemId === item.id)
    .sort((left, right) => right.date.localeCompare(left.date))[0]

  if (!latestTransaction) {
    return '--'
  }

  const parsed = new Date(latestTransaction.date)
  if (Number.isNaN(parsed.getTime())) {
    return '--'
  }

  const nextPaymentDate = new Date(parsed)

  if (item.billingType === 'annual') {
    nextPaymentDate.setFullYear(nextPaymentDate.getFullYear() + 1)
  } else {
    nextPaymentDate.setMonth(nextPaymentDate.getMonth() + 1)
  }

  return formatBillingTransactionDate(nextPaymentDate.toISOString())
}

function getPricingAmountSuffix(item: PaymentCatalogItem | null) {
  if (!item) {
    return 'CAD / month'
  }

  if (item.billingType === 'one-time') {
    return item.currency
  }

  if (item.billingType === 'annual') {
    return `${item.currency} / year`
  }

  return `${item.currency} / month`
}

function getCurrentPlanPaymentLabel(
  item: PaymentCatalogItem | null,
  transactions: BillingTransaction[],
) {
  return `Next payment date ${getNextPaymentDateLabel(item, transactions)}`
}

function buildBillingTransactionId(prefix: 'FREE' | 'INV') {
  const stamp = Date.now().toString().slice(-6)
  return `${prefix}-${stamp}`
}

function normalizeBillingStatus(status: string) {
  const trimmed = status.trim().toLowerCase()

  if (trimmed === 'paid') return 'Paid'
  if (trimmed === 'active') return 'Active'
  if (trimmed === 'succeeded') return 'Succeeded'
  if (trimmed === 'no_payment_required') return 'No payment required'
  if (trimmed === 'unpaid') return 'Unpaid'
  if (trimmed === 'open') return 'Open'

  return status.trim() || 'Completed'
}

function appendBillingTransaction(
  current: BillingTransaction[],
  transaction: BillingTransaction,
) {
  const nextTransactions = [
    transaction,
    ...current.filter(
      (entry) =>
        entry.id !== transaction.id &&
        !(
          entry.priceItemId === transaction.priceItemId &&
          entry.date === transaction.date &&
          entry.status === transaction.status &&
          entry.amount === transaction.amount
        ),
    ),
  ]

  return nextTransactions
    .sort((left, right) => right.date.localeCompare(left.date))
    .slice(0, 20)
}

function savePendingStripeCheckoutPayments(payments: PaymentConfig) {
  if (typeof window === 'undefined') return
  window.sessionStorage.setItem(
    pendingStripeCheckoutStorageKey,
    JSON.stringify(payments),
  )
}

function loadPendingStripeCheckoutPayments() {
  if (typeof window === 'undefined') return null

  const saved = window.sessionStorage.getItem(pendingStripeCheckoutStorageKey)
  if (!saved) return null

  try {
    return JSON.parse(saved) as PaymentConfig
  } catch {
    return null
  }
}

function clearPendingStripeCheckoutPayments() {
  if (typeof window === 'undefined') return
  window.sessionStorage.removeItem(pendingStripeCheckoutStorageKey)
}

function savePendingStripeCheckoutPriceItemId(priceItemId: string) {
  if (typeof window === 'undefined') return
  window.sessionStorage.setItem(
    pendingStripeCheckoutPriceItemStorageKey,
    priceItemId,
  )
}

function loadPendingStripeCheckoutPriceItemId() {
  if (typeof window === 'undefined') return ''
  return (
    window.sessionStorage.getItem(pendingStripeCheckoutPriceItemStorageKey) ?? ''
  )
}

function clearPendingStripeCheckoutPriceItemId() {
  if (typeof window === 'undefined') return
  window.sessionStorage.removeItem(pendingStripeCheckoutPriceItemStorageKey)
}

function SettingsPage() {
  const { config } = usePlatformConfig()
  const { t } = useTranslation()
  const { locale, setLocale } = useLocale()
  const platformName = getPlatformDisplayName(config)
  const location = useLocation()
  const navigate = useNavigate()
  const companies = loadCompanyRecords()
  const initialHash = window.location.hash.slice(1)
  const [activeSection, setActiveSection] = useState<SettingsSection>(
    ['profile', 'workspace', 'notifications', 'security', 'billing'].includes(
      initialHash,
    )
      ? (initialHash as SettingsSection)
      : 'profile',
  )
  const [settings, setSettings] = useState<UserSettings>(loadUserSettings)
  const [billingTransactions, setBillingTransactions] = useState<BillingTransaction[]>(
    loadBillingTransactions,
  )
  const [notice, setNotice] = useState('')
  const [billingActionState, setBillingActionState] = useState<
    'idle' | 'checkout' | 'portal' | 'sync'
  >('idle')
  const sectionItems: Array<{
    id: SettingsSection
    label: string
    description: string
    icon: DashboardGlyph
  }> = [
    {
      id: 'profile',
      label: t('settings.profile'),
      description: t('settings.profileDescription'),
      icon: 'user',
    },
    {
      id: 'workspace',
      label: t('settings.workspace'),
      description: t('settings.workspaceDescription'),
      icon: 'grid',
    },
    {
      id: 'notifications',
      label: t('settings.notifications'),
      description: t('settings.notificationsDescription'),
      icon: 'spark',
    },
    {
      id: 'security',
      label: t('settings.security'),
      description: t('settings.securityDescription'),
      icon: 'settings',
    },
    {
      id: 'billing',
      label: t('settings.billing'),
      description: t('settings.billingDescription'),
      icon: 'file',
    },
  ]
  const activePaymentProvider = config.payments.provider
  const activePricingOptions = useMemo(
    () =>
      config.payments.priceCatalog.filter(
        (item) =>
          item.active &&
          (!config.payments.enabled || item.provider === activePaymentProvider),
      ),
    [activePaymentProvider, config.payments.enabled, config.payments.priceCatalog],
  )
  const defaultPricingOffer =
    activePricingOptions.find((item) => item.isDefault) ??
    config.payments.priceCatalog.find((item) => item.active && item.isDefault) ??
    null
  const selectedPlanItem =
    config.payments.priceCatalog.find(
      (item) => item.active && item.id === settings.activePriceItemId,
    ) ?? null
  const subscribedPlanItem =
    settings.stripeSubscriptionId.trim().length > 0
      ? activePricingOptions.find(
          (item) =>
            item.billingType !== 'one-time' &&
            item.billingType === settings.billingCycle &&
            !isZeroCostPricingItem(item),
        ) ?? null
      : null
  const currentPlanItem =
    selectedPlanItem ??
    subscribedPlanItem ??
    defaultPricingOffer ??
    activePricingOptions.find((item) => item.billingType !== 'one-time') ??
    activePricingOptions[0] ??
    null
  const stripeBillingEnabled =
    config.payments.enabled && config.payments.provider === 'stripe'
  const hasStripeCustomer = settings.stripeCustomerId.trim().length > 0
  const currentPlanLabel = getPricingItemPlanLabel(currentPlanItem)
  const isFreeCurrentPlan = isZeroCostPricingItem(currentPlanItem)
  const recentBillingTransactions = billingTransactions.slice(0, 5)
  const visiblePricingOptions = activePricingOptions.filter(
    (item) => item.id !== currentPlanItem?.id,
  )

  useEffect(() => {
    const hashSection = location.hash.slice(1)
    if (
      ['profile', 'workspace', 'notifications', 'security', 'billing'].includes(
        hashSection,
      )
    ) {
      setActiveSection(hashSection as SettingsSection)
    }
  }, [location.hash])

  useEffect(() => {
    const persistedTransactions = window.localStorage.getItem(
      billingTransactionsStorageKey,
    )
    const savedSettings = window.localStorage.getItem(userSettingsStorageKey)

    if (persistedTransactions || !savedSettings) return

    try {
      const parsedSettings = JSON.parse(savedSettings) as LegacyUserSettings
      const legacyTransactions = Array.isArray(parsedSettings.billingTransactions)
        ? parsedSettings.billingTransactions
        : []

      if (legacyTransactions.length === 0) return

      setBillingTransactions(legacyTransactions)
      setPersistentItem(
        billingTransactionsStorageKey,
        JSON.stringify(legacyTransactions),
      )
    } catch {
      // Ignore malformed legacy records and continue with empty history.
    }
  }, [])

  useEffect(() => {
    const params = new URLSearchParams(location.search)
    const checkoutState = params.get('checkout')
    const sessionId = params.get('session_id')
    const pendingCheckoutPayments = loadPendingStripeCheckoutPayments()
    const pendingCheckoutPriceItemId = loadPendingStripeCheckoutPriceItemId()

    if (checkoutState !== 'success' && checkoutState !== 'cancel') return

    setActiveSection('billing')

    if (checkoutState === 'cancel') {
      clearPendingStripeCheckoutPayments()
      clearPendingStripeCheckoutPriceItemId()
      setNotice('Stripe Checkout was canceled before payment was completed.')
      navigate('/settings#billing', { replace: true })
      return
    }

    const lookupPayments = pendingCheckoutPayments ?? config.payments

    if (!sessionId || lookupPayments.provider !== 'stripe') {
      navigate('/settings#billing', { replace: true })
      return
    }

    let active = true
    setBillingActionState('sync')

    lookupStripeCheckoutSession({
      sessionId,
      payments: lookupPayments,
    })
      .then((session) => {
        if (!active) return

        const pendingCheckoutItem =
          lookupPayments.priceCatalog.find(
            (item) => item.id === pendingCheckoutPriceItemId,
          ) ??
          config.payments.priceCatalog.find(
            (item) => item.id === pendingCheckoutPriceItemId,
          ) ??
          null

        let nextSettings: UserSettings | null = null
        setSettings((current) => {
          const baseSettings: UserSettings = {
            ...current,
            stripeCustomerId: session.customerId ?? current.stripeCustomerId,
            stripeSubscriptionId:
              session.subscriptionId ?? current.stripeSubscriptionId,
            activePriceItemId:
              pendingCheckoutItem?.billingType !== 'one-time'
                ? pendingCheckoutItem?.id ?? current.activePriceItemId
                : current.activePriceItemId,
            billingCycle:
              pendingCheckoutItem?.billingType === 'annual'
                ? 'annual'
                : pendingCheckoutItem?.billingType === 'monthly'
                ? 'monthly'
                : current.billingCycle,
          }
          nextSettings = baseSettings
          return nextSettings
        })
        if (nextSettings) {
          setPersistentItem(userSettingsStorageKey, JSON.stringify(nextSettings))
        }

        if (pendingCheckoutItem) {
          setBillingTransactions((current) => {
            const nextTransactions = appendBillingTransaction(current, {
              id: buildBillingTransactionId('INV'),
              date: new Date().toISOString(),
              amount: pendingCheckoutItem.amount,
              currency: pendingCheckoutItem.currency,
              status: normalizeBillingStatus(
                session.paymentStatus ?? session.status ?? 'Paid',
              ),
              priceItemId: pendingCheckoutItem.id,
              label: pendingCheckoutItem.name,
            })
            setPersistentItem(
              billingTransactionsStorageKey,
              JSON.stringify(nextTransactions),
            )
            return nextTransactions
          })
        }

        if (pendingCheckoutPayments) {
          const nextPlatformConfig = {
            ...config,
            payments: pendingCheckoutPayments,
          }

          void persistLocalPlatformSecureConfig(nextPlatformConfig)
          setPersistentItem(
            platformConfigStorageKey,
            JSON.stringify({
              ...sanitizePlatformConfigForPersistence(nextPlatformConfig),
            }),
          )
        }

        setNotice(
          session.subscriptionId
            ? 'Stripe subscription activated. Your billing portal is now ready.'
            : 'Stripe payment completed successfully.',
        )
        clearPendingStripeCheckoutPayments()
        clearPendingStripeCheckoutPriceItemId()
        navigate('/settings#billing', { replace: true })
      })
      .catch((error) => {
        if (!active) return
        clearPendingStripeCheckoutPriceItemId()
        setNotice(
          error instanceof Error
            ? error.message
            : 'Stripe checkout completed, but the session could not be verified.',
        )
        navigate('/settings#billing', { replace: true })
      })
      .finally(() => {
        if (!active) return
        setBillingActionState('idle')
      })

    return () => {
      active = false
    }
  }, [config, config.payments, location.search, navigate])

  function updateSetting<Key extends keyof UserSettings>(
    key: Key,
    value: UserSettings[Key],
  ) {
    setSettings((current) => ({ ...current, [key]: value }))
  }

  function selectSection(section: SettingsSection) {
    setActiveSection(section)
    navigate(`/settings#${section}`, { replace: true })
    setNotice('')
  }

  async function saveSettings() {
    const serializedSettings = JSON.stringify(settings)
    updateCurrentAuthUserProfile({
      fullName: settings.fullName,
      email: settings.email,
      role: settings.role,
    })
    try {
      const persistenceMode = await persistPersistentItem(
        userSettingsStorageKey,
        serializedSettings,
      )
      setNotice(
        persistenceMode === 'database'
          ? 'Settings saved locally and synced to the database.'
          : 'Settings saved locally. Database sync will resume when available.',
      )
    } catch (error) {
      setNotice(
        `Settings saved locally. Database sync failed: ${
          error instanceof Error ? error.message : 'Please try again.'
        }`,
      )
    }
  }

  function activateFreePlan(item: PaymentCatalogItem) {
    let nextSettings: UserSettings | null = null

    setSettings((current) => {
      nextSettings = {
        ...current,
        activePriceItemId: item.id,
        billingCycle: item.billingType === 'annual' ? 'annual' : 'monthly',
        stripeCustomerId: '',
        stripeSubscriptionId: '',
      }
      return nextSettings
    })

    if (nextSettings) {
      setPersistentItem(userSettingsStorageKey, JSON.stringify(nextSettings))
    }

    setBillingTransactions((current) => {
      const nextTransactions = appendBillingTransaction(current, {
        id: buildBillingTransactionId('FREE'),
        date: new Date().toISOString(),
        amount: item.amount,
        currency: item.currency,
        status: 'Activated',
        priceItemId: item.id,
        label: item.name,
      })
      setPersistentItem(
        billingTransactionsStorageKey,
        JSON.stringify(nextTransactions),
      )
      return nextTransactions
    })

    clearPendingStripeCheckoutPayments()
    clearPendingStripeCheckoutPriceItemId()
    setNotice('Free Account activated. No payment gateway step was required.')
  }

  async function startPricingCheckout(item: PaymentCatalogItem) {
    if (isZeroCostPricingItem(item)) {
      activateFreePlan(item)
      return
    }

    if (!config.payments.enabled) {
      setNotice('Billing is not enabled for this workspace yet.')
      return
    }

    if (item.provider !== config.payments.provider) {
      setNotice(
        `${item.name} is linked to ${item.provider}, but the active payment provider is ${config.payments.provider}.`,
      )
      return
    }

    if (item.provider !== 'stripe') {
      setNotice(
        `${item.name} is linked to Waffo Pancake. Connect its checkout flow before selling it from workspace billing.`,
      )
      return
    }

    try {
      setBillingActionState('checkout')
      savePendingStripeCheckoutPayments(config.payments)
      savePendingStripeCheckoutPriceItemId(item.id)
      const session = await createStripeCheckoutSession({
        priceItemId: item.id,
        customerEmail: settings.email,
        customerId: settings.stripeCustomerId || undefined,
        platformName,
        payments: config.payments,
      })
      window.location.assign(session.url)
    } catch (error) {
      setBillingActionState('idle')
      clearPendingStripeCheckoutPriceItemId()
      setNotice(
        error instanceof Error
          ? error.message
          : 'The selected checkout could not be opened.',
      )
    }
  }

  async function openStripeBillingPortal() {
    if (!stripeBillingEnabled) {
      setNotice('Stripe billing is not enabled for this workspace yet.')
      return
    }

    if (!hasStripeCustomer) {
      setNotice('Complete Stripe checkout once before opening the billing portal.')
      return
    }

    try {
      setBillingActionState('portal')
      const session = await createStripeBillingPortalSession({
        customerId: settings.stripeCustomerId,
        platformName,
        payments: config.payments,
      })
      window.location.assign(session.url)
    } catch (error) {
      setBillingActionState('idle')
      setNotice(
        error instanceof Error
          ? error.message
          : 'The Stripe billing portal could not be opened.',
      )
    }
  }

  function handleEditPaymentMethod() {
    if (isFreeCurrentPlan && !hasStripeCustomer) {
      setNotice('No payment method is required while you are on Free Account.')
      return
    }

    if (hasStripeCustomer) {
      void openStripeBillingPortal()
      return
    }
    setNotice('Start Stripe checkout first to create a customer billing profile.')
  }

  return (
    <section className="settings-centre">
      <header className="settings-centre-header is-listing-topbar">
        <div>
          <h1>{t('navigation.items.settings')}</h1>
          <p>{t('settings.pageDescription')}</p>
        </div>
        <button type="button" className="workspace-primary-action" onClick={saveSettings}>
          <Glyph type="spark" />
          {t('settings.save')}
        </button>
      </header>

      {notice ? (
        <div className="workspace-inline-notice settings-notice" role="status">
          <span>{notice}</span>
          <button type="button" onClick={() => setNotice('')} aria-label="Dismiss notice">
            <Glyph type="close" />
          </button>
        </div>
      ) : null}

      <div className="settings-overview">
        <article>
          <span className="settings-overview-icon"><Glyph type="file" /></span>
          <div><small>{t('settings.currentPlan')}</small><strong>{currentPlanLabel}</strong></div>
          <b>{t('settings.active')}</b>
        </article>
        <article>
          <span className="settings-overview-icon"><Glyph type="grid" /></span>
          <div>
            <small>{t('settings.defaultCompany')}</small>
            <strong>
              {companies.find((company) => company.id === settings.defaultCompanyId)
                ?.name ?? 'Not selected'}
            </strong>
          </div>
          <b>{companies.length} {t('workspacePages.common.companies')}</b>
        </article>
        <article>
          <span className="settings-overview-icon"><Glyph type="settings" /></span>
          <div><small>{t('settings.accountSecurity')}</small><strong>{settings.twoFactor ? t('settings.strong') : t('settings.good')}</strong></div>
          <b>{settings.twoFactor ? t('settings.twoFactorOn') : t('settings.twoFactorRecommended')}</b>
        </article>
      </div>

      <div className="settings-layout">
        <nav className="settings-section-nav" aria-label={t('settings.accountSettings')}>
          <span>{t('settings.accountSettings')}</span>
          {sectionItems.map((item) => (
            <button
              key={item.id}
              type="button"
              className={activeSection === item.id ? 'is-active' : ''}
              aria-current={activeSection === item.id ? 'page' : undefined}
              onClick={() => selectSection(item.id)}
            >
              <i><Glyph type={item.icon} /></i>
              <span><strong>{item.label}</strong><small>{item.description}</small></span>
              <Glyph type="arrow" />
            </button>
          ))}
          <div className="settings-support-card">
            <span><Glyph type="spark" /></span>
            <strong>{t('settings.needHelp')}</strong>
            <p>{t('settings.supportDescription')}</p>
            <a href={`mailto:${config.supportEmail}`}>{t('settings.contactSupport')}</a>
          </div>
        </nav>

        <div className="settings-panel">
          {activeSection === 'profile' ? (
            <section className="settings-section">
              <header>
                <div><span>{t('settings.personalProfile')}</span><h2>{t('settings.accountIdentity')}</h2></div>
                <p>{t('settings.accountIdentityDescription')}</p>
              </header>
              <div className="settings-profile-hero">
                <span>{getUserInitials(settings.fullName || 'Workspace User')}</span>
                <div><strong>{settings.fullName}</strong><small>{settings.role}</small></div>
                <button type="button" onClick={() => setNotice('Profile photo upload is ready for backend storage.')}>
                  {t('settings.changePhoto')}
                </button>
              </div>
              <div className="settings-form-grid">
                <label><span>{t('settings.fullName')}</span><input value={settings.fullName} onChange={(event) => updateSetting('fullName', event.target.value)} /></label>
                <label><span>{t('settings.role')}</span><input value={settings.role} onChange={(event) => updateSetting('role', event.target.value)} /></label>
                <label><span>{t('settings.emailAddress')}</span><input type="email" value={settings.email} onChange={(event) => updateSetting('email', event.target.value)} /></label>
                <label><span>{t('settings.phoneNumber')}</span><input value={settings.phone} onChange={(event) => updateSetting('phone', event.target.value)} /></label>
              </div>
            </section>
          ) : null}

          {activeSection === 'workspace' ? (
            <section className="settings-section">
              <header>
                <div><span>{t('settings.workspaceDefaults')}</span><h2>{t('settings.startWorkflow')}</h2></div>
                <p>{t('settings.workspaceDefaultsDescription')}</p>
              </header>
              <div className="settings-form-grid">
                <label className="is-wide">
                  <span>{t('settings.defaultCompany')}</span>
                  <select value={settings.defaultCompanyId} onChange={(event) => updateSetting('defaultCompanyId', event.target.value)}>
                    {companies.map((company) => <option key={company.id} value={company.id}>{company.name}</option>)}
                  </select>
                  <small>{t('settings.usedByQuickBuild')}</small>
                </label>
                <label><span>{t('settings.timezone')}</span><select value={settings.timezone} onChange={(event) => updateSetting('timezone', event.target.value)}><option>America/Toronto</option><option>America/Vancouver</option><option>America/Halifax</option></select></label>
                <label>
                  <span>{t('settings.language')}</span>
                  <select
                    value={locale}
                    onChange={(event) => {
                      const nextLocale = normalizeLocale(event.target.value)
                      updateSetting('language', nextLocale)
                      setLocale(nextLocale)
                    }}
                  >
                    {languageOptions.map((option) => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </select>
                </label>
                <label><span>Default currency</span><select value={settings.currency} onChange={(event) => updateSetting('currency', event.target.value)}><option>CAD</option><option>USD</option></select></label>
              </div>
              <div className="settings-company-preview">
                <span>{companies.find((company) => company.id === settings.defaultCompanyId)?.name.slice(0, 2).toUpperCase() ?? 'CO'}</span>
                <div><strong>{companies.find((company) => company.id === settings.defaultCompanyId)?.name ?? 'Select a company'}</strong><small>{companies.find((company) => company.id === settings.defaultCompanyId)?.industry ?? 'No industry selected'}</small></div>
                <Link to="/my-companies">Manage companies</Link>
              </div>
            </section>
          ) : null}

          {activeSection === 'notifications' ? (
            <section className="settings-section">
              <header>
                <div><span>Notification preferences</span><h2>Stay informed, not overwhelmed</h2></div>
                <p>Choose which account and funding updates reach your inbox.</p>
              </header>
              <div className="settings-toggle-list">
                {[
                  { key: 'deadlineReminders' as const, title: 'Deadline reminders', copy: 'Upcoming application deadlines and overdue tasks.' },
                  { key: 'weeklyDigest' as const, title: 'Weekly workspace digest', copy: 'Funding matches, score changes, and application progress.' },
                  { key: 'securityAlerts' as const, title: 'Security alerts', copy: 'New sessions, password changes, and sensitive account activity.' },
                  { key: 'productUpdates' as const, title: 'Product updates', copy: `New ${platformName} features, templates, and platform announcements.` },
                ].map((preference) => (
                  <label key={preference.key}>
                    <span><strong>{preference.title}</strong><small>{preference.copy}</small></span>
                    <input type="checkbox" checked={settings[preference.key]} onChange={(event) => updateSetting(preference.key, event.target.checked)} />
                    <i />
                  </label>
                ))}
              </div>
            </section>
          ) : null}

          {activeSection === 'security' ? (
            <section className="settings-section">
              <header>
                <div><span>Account security</span><h2>Protect access to your workspace</h2></div>
                <p>Manage authentication and review active sessions.</p>
              </header>
              <div className="settings-security-card">
                <span><Glyph type="settings" /></span>
                <div><strong>Two-factor authentication</strong><p>Add an authenticator step when signing in.</p></div>
                <label><input type="checkbox" checked={settings.twoFactor} onChange={(event) => updateSetting('twoFactor', event.target.checked)} /><i /></label>
              </div>
              <div className="settings-form-grid">
                <label><span>Automatic sign-out</span><select value={settings.sessionTimeout} onChange={(event) => updateSetting('sessionTimeout', event.target.value)}><option>15 minutes</option><option>30 minutes</option><option>1 hour</option><option>4 hours</option></select></label>
                <label><span>Password</span><button type="button" className="settings-field-button" onClick={() => setNotice('A password reset link is ready to be sent to your email.')}>Send reset link</button></label>
              </div>
              <div className="settings-sessions">
                <div><span><Glyph type="grid" /></span><p><strong>Chrome on macOS</strong><small>Toronto, Canada · Current session</small></p><b>Active now</b></div>
                <div><span><Glyph type="grid" /></span><p><strong>Safari on iPhone</strong><small>Toronto, Canada · Last active Jul 27</small></p><button type="button" onClick={() => setNotice('The selected session has been signed out.')}>Sign out</button></div>
              </div>
            </section>
          ) : null}

          {activeSection === 'billing' ? (
            <section className="settings-section settings-billing">
              <header>
                <div><span>Billing & Subscription</span><h2>Choose how you want to pay</h2></div>
                <p>Review active pricing options, start checkout, and manage billing after purchase.</p>
              </header>
              <div className="settings-current-subscription">
                <strong>Current subscription</strong>
                <article
                  className={
                    currentPlanItem?.billingType === 'monthly'
                      ? 'settings-pricing-card settings-pricing-card-current is-featured'
                      : 'settings-pricing-card settings-pricing-card-current'
                  }
                >
                  <div className="settings-pricing-card-topline">
                    <span>{currentPlanItem?.offeringType ?? 'Service'}</span>
                    <b>
                      {currentPlanItem
                        ? currentPlanItem.billingType === 'one-time'
                          ? 'One-time'
                          : currentPlanItem.billingType
                        : 'Monthly'}
                    </b>
                  </div>
                  <strong>{currentPlanItem?.name ?? currentPlanLabel}</strong>
                  <div
                    className="settings-pricing-description"
                    dangerouslySetInnerHTML={{
                      __html: renderFormattedContent(
                        currentPlanItem?.description ||
                          'Configured in the admin pricing catalogue.',
                        currentPlanItem?.descriptionFormat ?? 'markdown',
                      ),
                    }}
                  />
                  <div className="settings-pricing-price">
                    <div className="settings-pricing-amount-line">
                      <span>
                        {currentPlanItem
                          ? formatSettingsBillingAmount(
                              currentPlanItem.amount,
                              currentPlanItem.currency,
                            )
                          : '$0'}
                      </span>
                      <small>{getPricingAmountSuffix(currentPlanItem)}</small>
                    </div>
                    <small>
                      {getCurrentPlanPaymentLabel(
                        currentPlanItem,
                        billingTransactions,
                      )}
                    </small>
                  </div>
                  <button
                    type="button"
                    className="settings-pricing-action"
                    disabled
                  >
                    Current plan
                  </button>
                </article>
              </div>
              <div className="settings-pricing-grid">
                {visiblePricingOptions.length > 0 ? (
                  visiblePricingOptions.map((item) => (
                    (() => {
                      const isCurrentPlan =
                        item.id === currentPlanItem?.id &&
                        item.billingType !== 'one-time'
                      const isFreeItem = isZeroCostPricingItem(item)

                      return (
                    <article
                      key={item.id}
                      className={
                        item.billingType === 'monthly'
                          ? 'settings-pricing-card is-featured'
                          : 'settings-pricing-card'
                      }
                    >
                      <div className="settings-pricing-card-topline">
                        <span>{item.offeringType}</span>
                        <b>{item.billingType === 'one-time' ? 'One-time' : item.billingType}</b>
                      </div>
                      <strong>{item.name}</strong>
                      <div
                        className="settings-pricing-description"
                        dangerouslySetInnerHTML={{
                          __html: renderFormattedContent(
                            item.description ||
                              'Configured in the admin pricing catalogue.',
                            item.descriptionFormat,
                          ),
                        }}
                      />
                      <div className="settings-pricing-price">
                        <div className="settings-pricing-amount-line">
                          <span>{formatSettingsBillingAmount(item.amount, item.currency)}</span>
                          <small>{getPricingAmountSuffix(item)}</small>
                        </div>
                      </div>
                      <button
                        type="button"
                        className="settings-pricing-action"
                        disabled={
                          billingActionState !== 'idle' ||
                          isCurrentPlan ||
                          (!isFreeItem && item.provider !== 'stripe')
                        }
                        onClick={() => void startPricingCheckout(item)}
                      >
                        {isCurrentPlan
                          ? 'Current plan'
                          : billingActionState === 'checkout'
                          ? 'Opening checkout...'
                          : !isFreeItem && item.provider !== 'stripe'
                            ? 'Checkout unavailable'
                            : isFreeItem
                              ? 'Choose free plan'
                              : item.billingType === 'one-time'
                              ? 'Pay now'
                              : 'Subscribe'}
                      </button>
                    </article>
                      )
                    })()
                  ))
                ) : (
                  <article className="settings-pricing-card is-empty">
                    <div className="settings-pricing-card-topline">
                      <span>Pricing</span>
                      <b>Pending</b>
                    </div>
                    <strong>No active pricing options</strong>
                    <p>
                      Add and activate products or services in the admin console to
                      make them available here.
                    </p>
                  </article>
                )}
              </div>
              <div className="settings-usage-grid">
                <article><span>Document packages</span><strong>23 <small>/ 50</small></strong><i><b style={{ width: '46%' }} /></i></article>
                <article><span>Team seats</span><strong>3 <small>/ 5</small></strong><i><b style={{ width: '60%' }} /></i></article>
                <article><span>Storage</span><strong>1.8 <small>/ 10 GB</small></strong><i><b style={{ width: '18%' }} /></i></article>
              </div>
              <div className="settings-payment-card">
                <div><span>{isFreeCurrentPlan && !hasStripeCustomer ? 'FREE' : 'VISA'}</span><p><strong>{isFreeCurrentPlan && !hasStripeCustomer ? 'No payment method required' : 'Visa ending in 4242'}</strong><small>{isFreeCurrentPlan && !hasStripeCustomer ? 'Free Account does not require a saved billing profile.' : 'Expires 08/28 · Default payment method'}</small></p></div>
                <button type="button" onClick={handleEditPaymentMethod} disabled={billingActionState !== 'idle'}>
                  {isFreeCurrentPlan && !hasStripeCustomer ? 'Not needed' : 'Edit'}
                </button>
              </div>
              <div className="settings-invoices">
                <header><strong>Recent invoices</strong><button type="button" onClick={() => setNotice('Invoice history is ready for backend connection.')}>View all</button></header>
                {recentBillingTransactions.length > 0 ? (
                  recentBillingTransactions.map((transaction) => (
                    <div key={transaction.id}><strong>{transaction.id}</strong><span>{formatBillingTransactionDate(transaction.date)}</span><b>{formatSettingsBillingAmount(transaction.amount, transaction.currency)}</b><em>{transaction.status}</em><button type="button" aria-label={`Download ${transaction.id}`} onClick={() => setNotice(`${transaction.label} receipt export is ready for backend connection.`)}><Glyph type="file" /></button></div>
                  ))
                ) : (
                  <div><strong>No transactions yet</strong><span>Waiting for the first completed billing event</span><b>--</b><em>Empty</em><button type="button" aria-label="Billing history unavailable"><Glyph type="file" /></button></div>
                )}
              </div>
            </section>
          ) : null}
        </div>
      </div>
    </section>
  )
}

type QuickBuildStep = 1 | 2 | 3 | 'workspace'
type WorkspacePhase =
  | 'idle'
  | 'analyzing'
  | 'planning'
  | 'generating'
  | 'reviewing'
  | 'complete'
type WorkspaceSectionStatus = 'waiting' | 'working' | 'complete'
type WorkspaceSectionState = GeneratedPackageSection & {
  status: WorkspaceSectionStatus
  progress: number
  preview: string
}

const quickBuildPhaseRank: Record<WorkspacePhase, number> = {
  idle: 0,
  analyzing: 1,
  planning: 2,
  generating: 3,
  reviewing: 4,
  complete: 5,
}

function waitForWorkspace(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms))
}

function createConfiguredAdvisoryHubSections(
  configuredSections: AdvisoryHubSectionConfig[],
  configuredAgents: AdvisoryHubAgentConfig[],
  configuredDocumentTypes: AdvisoryHubDocumentTypeConfig[],
  bodyById: Record<AdvisoryHubSectionConfig['id'], string>,
) {
  return configuredSections
    .filter((section) => section.enabled)
    .map((section) => ({
      id: section.id,
      title: section.title,
      body:
        bodyById[section.id]?.trim() ||
        `${section.title} is being prepared for reviewer-ready delivery.`,
      agent:
        configuredAgents.find((agent) => agent.id === section.agentId)?.name ||
        configuredAgents[0]?.name ||
        'Advisory agent',
      documentLabel:
        configuredDocumentTypes.find(
          (documentType) => documentType.id === section.documentTypeId,
        )?.name ||
        configuredDocumentTypes[0]?.name ||
        'Document',
      layout: section.layout,
    })) satisfies GeneratedPackageSection[]
}

function getSectionLayoutId(section: GeneratedPackageSection): AdvisoryHubSectionLayout {
  if (section.layout === 'cover-page' || section.layout === 'main-content') {
    return section.layout
  }
  return /(?:^|[-_\s])cover[-_\s]?page$/iu.test(section.id) || /^cover page$/iu.test(section.title.trim())
    ? 'cover-page'
    : 'main-content'
}

function hydrateWorkspaceSections(packageRecord: GeneratedPackage): WorkspaceSectionState[] {
  return packageRecord.sections.map((section) => ({
    ...section,
    status: 'complete',
    progress: 100,
    preview: section.body,
  }))
}

function createSectionVariant(
  section: WorkspaceSectionState,
  programName: string,
  businessName: string,
) {
  return `${section.body} This refreshed pass sharpens the language for ${businessName}, ties the section back to ${programName}, and makes the reviewer takeaway more explicit.`
}

function createReportExportInput(
  packageRecord: GeneratedPackage,
  sections = packageRecord.sections,
  forecast = packageRecord.financialForecast,
): StrategicReportExportInput {
  return {
    title: packageRecord.title,
    businessName: packageRecord.businessName,
    programName: packageRecord.programName,
    sections,
    forecast,
  }
}

function formatForecastCurrency(value: number, currency: string, locale = 'en-CA') {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(value)
}

function FinancialForecastCharts({ forecast }: { forecast: FinancialForecast }) {
  const { t } = useTranslation()
  const { locale } = useLocale()
  const chartWidth = 820
  const chartHeight = 260
  const chartPadding = { top: 22, right: 20, bottom: 34, left: 52 }
  const plotWidth = chartWidth - chartPadding.left - chartPadding.right
  const plotHeight = chartHeight - chartPadding.top - chartPadding.bottom
  const maxValue = Math.max(
    ...forecast.monthly_revenue_totals,
    ...forecast.monthly_expense_totals,
    1,
  )
  const xForIndex = (index: number) =>
    chartPadding.left + (index / Math.max(forecast.months.length - 1, 1)) * plotWidth
  const yForValue = (value: number) =>
    chartPadding.top + ((maxValue - value) / maxValue) * plotHeight
  const linePoints = (values: number[]) =>
    values.map((value, index) => `${xForIndex(index)},${yForValue(value)}`).join(' ')
  const revenuePoints = linePoints(forecast.monthly_revenue_totals)
  const expensePoints = linePoints(forecast.monthly_expense_totals)
  const firstX = xForIndex(0)
  const lastX = xForIndex(forecast.months.length - 1)
  const plotBottom = chartPadding.top + plotHeight
  const revenueArea = `${revenuePoints} ${lastX},${plotBottom} ${firstX},${plotBottom}`
  const netMax = Math.max(
    ...forecast.monthly_net_cash_flow.map((value) => Math.abs(value)),
    1,
  )
  const netChartHeight = 176
  const netZeroY = 76
  const netScale = 58 / netMax
  const netBarWidth = Math.max(5, (chartWidth - 82) / forecast.months.length - 3)
  const tickIndexes = forecast.months
    .map((_, index) => index)
    .filter((index) => index % 6 === 0 || index === forecast.months.length - 1)

  return (
    <div className="generator-forecast-charts">
      <div className="generator-forecast-chart-heading">
        <div>
          <span>{t('forecast.visualisation')}</span>
          <h3>{t('forecast.title')}</h3>
          <p>{t('forecast.description')}</p>
        </div>
        <div className="generator-forecast-legend" aria-label={t('forecast.chartLegend')}>
          <span><i className="is-revenue" />{t('forecast.revenue')}</span>
          <span><i className="is-expense" />{t('forecast.expenses')}</span>
          <span><i className="is-net" />{t('forecast.netCashFlow')}</span>
        </div>
      </div>

      <div className="generator-forecast-chart-panel">
        <div className="generator-forecast-chart-label">
          <strong>{t('forecast.monthlyRevenueExpenses')}</strong>
          <span>{forecast.months[0]?.label} to {forecast.months.at(-1)?.label}</span>
        </div>
        <div className="generator-forecast-svg-wrap">
          <svg
            viewBox={`0 0 ${chartWidth} ${chartHeight}`}
            role="img"
            aria-label={t('forecast.monthlyRevenueExpensesTrend')}
          >
            <defs>
              <linearGradient id="forecast-revenue-fill" x1="0" x2="0" y1="0" y2="1">
                <stop offset="0%" stopColor="#5b6fd1" stopOpacity="0.22" />
                <stop offset="100%" stopColor="#5b6fd1" stopOpacity="0" />
              </linearGradient>
            </defs>
            {[0, 0.25, 0.5, 0.75, 1].map((tick) => {
              const y = chartPadding.top + plotHeight * tick
              const value = maxValue * (1 - tick)
              return (
                <g key={`value-tick-${tick}`}>
                  <line x1={chartPadding.left} x2={chartWidth - chartPadding.right} y1={y} y2={y} className="forecast-grid-line" />
                  <text x={chartPadding.left - 10} y={y + 4} textAnchor="end" className="forecast-axis-label">
                    {formatForecastCurrency(value, forecast.currency, locale)}
                  </text>
                </g>
              )
            })}
            <polygon points={revenueArea} fill="url(#forecast-revenue-fill)" />
            <polyline points={revenuePoints} className="forecast-line is-revenue" />
            <polyline points={expensePoints} className="forecast-line is-expense" />
            {tickIndexes.map((index) => (
              <text key={`month-tick-${forecast.months[index]?.key}`} x={xForIndex(index)} y={chartHeight - 8} textAnchor="middle" className="forecast-axis-label">
                {forecast.months[index]?.label}
              </text>
            ))}
          </svg>
        </div>
      </div>

      <div className="generator-forecast-chart-panel">
        <div className="generator-forecast-chart-label">
          <strong>{t('forecast.netCashFlowByMonth')}</strong>
          <span>{t('forecast.negativeNote')}</span>
        </div>
        <div className="generator-forecast-svg-wrap">
          <svg
            viewBox={`0 0 ${chartWidth} ${netChartHeight}`}
            role="img"
            aria-label={t('forecast.monthlyNetCashFlowBars')}
          >
            <line x1={chartPadding.left} x2={chartWidth - chartPadding.right} y1={netZeroY} y2={netZeroY} className="forecast-zero-line" />
            <text x={chartPadding.left - 10} y={netZeroY + 4} textAnchor="end" className="forecast-axis-label">0</text>
            {forecast.monthly_net_cash_flow.map((value, index) => {
              const height = Math.max(2, Math.abs(value) * netScale)
              const x = chartPadding.left + (index / forecast.months.length) * plotWidth + 2
              const y = value >= 0 ? netZeroY - height : netZeroY
              return (
                <rect
                  key={`net-bar-${forecast.months[index]?.key}`}
                  x={x}
                  y={y}
                  width={netBarWidth}
                  height={height}
                  rx="3"
                  className={`forecast-net-bar ${value >= 0 ? 'is-positive' : 'is-negative'}`}
                />
              )
            })}
            {tickIndexes.map((index) => (
              <text key={`net-month-tick-${forecast.months[index]?.key}`} x={xForIndex(index)} y={netChartHeight - 8} textAnchor="middle" className="forecast-axis-label">
                {forecast.months[index]?.label}
              </text>
            ))}
          </svg>
        </div>
      </div>
    </div>
  )
}

function FinancialForecastGrid({ forecast }: { forecast: FinancialForecast }) {
  const { t } = useTranslation()
  const { locale } = useLocale()
  const [selectedYearIndex, setSelectedYearIndex] = useState(0)
  const selectedYear = forecast.annual_summaries[selectedYearIndex]
  const monthStart = selectedYearIndex * 12
  const visibleMonths = forecast.months.slice(monthStart, monthStart + 12)
  const visibleValues = (values: number[]) => values.slice(monthStart, monthStart + 12)

  return (
    <>
      <div className="generator-forecast-summary">
        {forecast.annual_summaries.map((summary, index) => (
          <button
            key={summary.year}
            type="button"
            className={`generator-forecast-year-tab ${index === selectedYearIndex ? 'is-selected' : ''}`}
            data-year-index={index}
            aria-pressed={index === selectedYearIndex}
            onClick={() => setSelectedYearIndex(index)}
          >
            <strong>{summary.label}</strong>
            <span>{t('forecast.revenue')} {formatForecastCurrency(summary.total_revenue, forecast.currency, locale)}</span>
            <span>{t('forecast.expenses')} {formatForecastCurrency(summary.total_expenses, forecast.currency, locale)}</span>
            <b>{t('forecast.netCashFlow')} {formatForecastCurrency(summary.net_cash_flow, forecast.currency, locale)}</b>
          </button>
        ))}
      </div>
      {selectedYear ? (
        <div className="generator-forecast-table-period" aria-live="polite">
          <span>{t('forecast.lineItem')}</span>
          <strong>{selectedYear.label}</strong>
          <small>{visibleMonths[0]?.label} to {visibleMonths.at(-1)?.label}</small>
        </div>
      ) : null}
      <div className="generator-forecast-scroll">
        <table className="generator-forecast-table">
          <thead>
            <tr>
            <th>{t('forecast.lineItem')}</th>
              {visibleMonths.map((month) => (
                <th key={month.key}>{month.label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {forecast.rows.map((row) => (
              <tr key={row.name} className={`is-${row.category}`}>
                <th>{row.name}</th>
                {visibleValues(row.values).map((value, index) => (
                  <td key={`${row.name}-${visibleMonths[index]?.key ?? index}`}>
                    {formatForecastCurrency(value, forecast.currency, locale)}
                  </td>
                ))}
              </tr>
            ))}
            <tr className="is-total">
              <th>{t('forecast.totalRevenue')}</th>
              {visibleValues(forecast.monthly_revenue_totals).map((value, index) => (
                <td key={`revenue-total-${visibleMonths[index]?.key ?? index}`}>
                  {formatForecastCurrency(value, forecast.currency, locale)}
                </td>
              ))}
            </tr>
            <tr className="is-total">
              <th>{t('forecast.totalExpenses')}</th>
              {visibleValues(forecast.monthly_expense_totals).map((value, index) => (
                <td key={`expense-total-${visibleMonths[index]?.key ?? index}`}>
                  {formatForecastCurrency(value, forecast.currency, locale)}
                </td>
              ))}
            </tr>
            <tr className="is-net">
              <th>{t('forecast.netCashFlow')}</th>
              {visibleValues(forecast.monthly_net_cash_flow).map((value, index) => (
                <td key={`net-${visibleMonths[index]?.key ?? index}`}>
                  {formatForecastCurrency(value, forecast.currency, locale)}
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>
    </>
  )
}

function FinancialForecastTable({
  forecast,
  id = 'financial-forecast-panel',
  showLabel = true,
}: {
  forecast: FinancialForecast
  id?: string
  showLabel?: boolean
}) {
  const { t } = useTranslation()

  return (
    <article id={id} className="generator-ai-card generator-forecast-card">
      <header>
        <div>
          {showLabel ? <span>{t('forecast.financialModel')}</span> : null}
          <h3>{t('forecast.monthlyForecast', { years: forecast.years })}</h3>
        </div>
        <b>{forecast.months.length} months</b>
      </header>
      <FinancialForecastCharts forecast={forecast} />
      <FinancialForecastGrid forecast={forecast} />
      <div className="generator-forecast-assumptions">
        <strong>{t('forecast.planningAssumptions')}</strong>
        {forecast.assumptions.map((assumption) => (
          <span key={assumption}>{assumption}</span>
        ))}
      </div>
    </article>
  )
}

function StrategicReportDocumentPreviewDialog({
  title,
  sections,
  exportInput,
  layouts,
  initialSectionId,
  onClose,
}: {
  title: string
  sections: GeneratedPackageSection[]
  exportInput: StrategicReportExportInput
  layouts: AdvisoryHubLayoutConfig[]
  initialSectionId?: string
  onClose: () => void
}) {
  const sectionRefs = useRef<Record<string, HTMLElement | null>>({})

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  useEffect(() => {
    if (!initialSectionId) return
    sectionRefs.current[initialSectionId]?.scrollIntoView({ block: 'start' })
  }, [initialSectionId])

  return (
    <div className="strategic-report-preview-backdrop" onClick={onClose}>
      <section
        className="strategic-report-preview-dialog strategic-report-document-preview"
        role="dialog"
        aria-modal="true"
        aria-labelledby="strategic-report-document-preview-title"
        onClick={(event) => event.stopPropagation()}
      >
        <header>
          <div>
            <span>Document preview</span>
            <h2 id="strategic-report-document-preview-title">{title}</h2>
            <p>Scroll through the complete analysis and review every generated section.</p>
          </div>
          <button type="button" className="strategic-report-preview-close" aria-label="Close preview" onClick={onClose}>
            <Glyph type="close" />
          </button>
        </header>

        <div className="strategic-report-preview-download-actions">
          <button type="button" onClick={() => void downloadStrategicReportDocx(exportInput)}>
            Download DOCX
          </button>
          <button type="button" onClick={() => void downloadStrategicReportPdf(exportInput)}>
            Download PDF
          </button>
        </div>

        {sections.length > 0 ? (
          <div className="strategic-report-document-scroll">
            {sections.map((section, index) => {
              const layoutId = getSectionLayoutId(section)
              const layout = layouts.find((candidate) => candidate.id === layoutId)
              const layoutStyle = layout ? cssDeclarationsToStyle(layout.css) : undefined

              return layoutId === 'cover-page' ? (
                <article
                  className="strategic-report-document-page strategic-report-cover-page"
                  style={layoutStyle}
                  key={section.id}
                  ref={(element) => {
                    sectionRefs.current[section.id] = element
                  }}
                >
                  <div className="strategic-report-cover-page-accent" aria-hidden="true" />
                  <div className="strategic-report-cover-page-content">
                    <span>Strategic Report</span>
                    <h3>{title}</h3>
                    <strong>{exportInput.businessName}</strong>
                    <p className="strategic-report-cover-page-program">{exportInput.programName}</p>
                    <div className="strategic-report-cover-page-rule" aria-hidden="true" />
                    <p>{coverPageSubtitle(title)}</p>
                    <time dateTime={new Date().toISOString()}>
                      {new Intl.DateTimeFormat('en-CA', {
                        month: 'long',
                        day: 'numeric',
                        year: 'numeric',
                      }).format(new Date())}
                    </time>
                  </div>
                </article>
              ) : (
                <article
                  className="strategic-report-document-page"
                  style={layoutStyle}
                  key={section.id}
                  ref={(element) => {
                    sectionRefs.current[section.id] = element
                  }}
                >
                  <div className="strategic-report-document-page-meta">
                    <span>Section {index + 1} of {sections.length}</span>
                  </div>
                  <h3>{section.title}</h3>
                  <p>{section.body}</p>
                </article>
              )
            })}
          </div>
        ) : (
          <div className="strategic-report-preview-empty">No document sections are available.</div>
        )}
      </section>
    </div>
  )
}

function StrategicReportSectionEditorDialog({
  appId,
  strategicReportId,
  section,
  layouts,
  onClose,
  onSaved,
}: {
  appId: string
  strategicReportId: string
  section: GeneratedPackageSection
  layouts: AdvisoryHubLayoutConfig[]
  onClose: () => void
  onSaved: (section: GeneratedPackageSection) => void
}) {
  const { locale } = useLocale()
  const [content, setContent] = useState(section.body)
  const [layoutId, setLayoutId] = useState<AdvisoryHubSectionLayout>(
    getSectionLayoutId(section),
  )
  const [status, setStatus] = useState<'idle' | 'saving' | 'regenerating'>('idle')
  const [error, setError] = useState('')
  const selectedLayout = layouts.find((layout) => layout.id === layoutId)
  const isBusy = status !== 'idle'

  async function submit(action: 'save' | 'regenerate') {
    setStatus(action === 'save' ? 'saving' : 'regenerating')
    setError('')

    try {
      const response =
        action === 'save'
          ? await updateStrategicReportSectionViaApi({
              app_id: appId,
              strategic_report_id: strategicReportId,
              section_key: section.id,
              content,
              layout: layoutId,
              language: locale,
            })
          : await regenerateStrategicReportSectionViaApi({
              app_id: appId,
              strategic_report_id: strategicReportId,
              section_key: section.id,
              content,
              layout: layoutId,
              language: locale,
            })
      const updatedSection: GeneratedPackageSection = {
        ...section,
        id: response.section.section_key,
        title: response.section.title,
        body: response.section.content,
        layout: response.layout,
      }
      onSaved(updatedSection)
      setContent(updatedSection.body)
      setLayoutId(updatedSection.layout ?? layoutId)
      if (action === 'save') onClose()
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : 'The Strategic Report section could not be updated.',
      )
    } finally {
      setStatus('idle')
    }
  }

  return (
    <div className="strategic-report-preview-backdrop" onClick={onClose}>
      <section
        className="strategic-report-preview-dialog strategic-report-section-editor"
        role="dialog"
        aria-modal="true"
        aria-labelledby="strategic-report-section-editor-title"
        onClick={(event) => event.stopPropagation()}
      >
        <header>
          <div>
            <span>Edit section</span>
            <h2 id="strategic-report-section-editor-title">{section.title}</h2>
            <p>Edit the content, choose a layout, or regenerate only this section.</p>
          </div>
          <button
            type="button"
            className="strategic-report-preview-close"
            aria-label="Close editor"
            onClick={onClose}
            disabled={isBusy}
          >
            <Glyph type="close" />
          </button>
        </header>

        <div className="strategic-report-section-editor-body">
          <label>
            <span>Layout</span>
            <select
              value={layoutId}
              onChange={(event) =>
                setLayoutId(event.target.value as AdvisoryHubSectionLayout)
              }
              disabled={isBusy}
            >
              {layouts.map((layout) => (
                <option key={layout.id} value={layout.id}>
                  {layout.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>Section content</span>
            <textarea
              value={content}
              onChange={(event) => setContent(event.target.value)}
              disabled={isBusy}
              rows={15}
            />
          </label>
          <div className="strategic-report-section-editor-preview">
            <div>
              <strong>Layout preview</strong>
              <small>{selectedLayout?.description}</small>
            </div>
            <article
              className={`strategic-report-section-editor-surface is-${layoutId}`}
              style={selectedLayout ? cssDeclarationsToStyle(selectedLayout.css) : undefined}
            >
              <span>{section.title}</span>
              <p>{content || 'Section content preview'}</p>
            </article>
          </div>
          {error ? <p className="strategic-report-section-editor-error">{error}</p> : null}
        </div>

        <footer className="strategic-report-section-editor-actions">
          <button type="button" onClick={onClose} disabled={isBusy}>
            Cancel
          </button>
          <button type="button" onClick={() => void submit('save')} disabled={isBusy}>
            {status === 'saving' ? 'Saving...' : 'Save'}
          </button>
          <button
            type="button"
            className="strategic-reports-primary-action"
            onClick={() => void submit('regenerate')}
            disabled={isBusy}
          >
            {status === 'regenerating' ? 'Regenerating...' : 'Regenerate'}
          </button>
        </footer>
      </section>
    </div>
  )
}

function StrategicReportFinancialPreviewDialog({
  forecast,
  exportInput,
  onClose,
}: {
  forecast: FinancialForecast
  exportInput: StrategicReportExportInput
  onClose: () => void
}) {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  return (
    <div className="strategic-report-preview-backdrop" onClick={onClose}>
      <section
        className="strategic-report-preview-dialog strategic-report-financial-preview"
        role="dialog"
        aria-modal="true"
        aria-labelledby="strategic-report-financial-preview-title"
        onClick={(event) => event.stopPropagation()}
      >
        <header>
          <div>
            <span>Financial Model</span>
            <h2 id="strategic-report-financial-preview-title">Financial forecast</h2>
            <p>Switch between years to review one twelve-month table at a time.</p>
          </div>
          <button type="button" className="strategic-report-preview-close" aria-label="Close preview" onClick={onClose}>
            <Glyph type="close" />
          </button>
        </header>
        <div className="strategic-report-preview-download-actions">
          <button type="button" onClick={() => void downloadStrategicReportDocx(exportInput)}>
            Download DOCX
          </button>
          <button type="button" onClick={() => void downloadStrategicReportPdf(exportInput)}>
            Download PDF
          </button>
          <button type="button" onClick={() => void downloadStrategicReportXlsx(exportInput)}>
            Download Excel
          </button>
        </div>
        <div className="strategic-report-financial-preview-body">
          <FinancialForecastGrid forecast={forecast} />
        </div>
      </section>
    </div>
  )
}

function StrategicReportContentSection({
  appId,
  strategicReportId,
  eyebrow,
  title,
  description,
  sections,
  exportInput,
  layouts,
  onSectionUpdated,
  emptyMessage,
}: {
  appId: string
  strategicReportId: string
  eyebrow: string
  title: string
  description: string
  sections: GeneratedPackageSection[]
  exportInput: StrategicReportExportInput
  layouts: AdvisoryHubLayoutConfig[]
  onSectionUpdated: (section: GeneratedPackageSection) => void
  emptyMessage?: string
}) {
  const [previewOpen, setPreviewOpen] = useState(false)
  const [previewSectionId, setPreviewSectionId] = useState<string | undefined>()
  const [editingSection, setEditingSection] = useState<GeneratedPackageSection | null>(null)
  const [orderedSections, setOrderedSections] = useState(sections)

  useEffect(() => {
    setOrderedSections(sections)
  }, [sections])

  function moveSection(sectionId: string, direction: 'up' | 'down') {
    setOrderedSections((current) => {
      const currentIndex = current.findIndex((section) => section.id === sectionId)
      const targetIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1
      if (currentIndex < 0 || targetIndex < 0 || targetIndex >= current.length) {
        return current
      }

      const next = [...current]
      const [section] = next.splice(currentIndex, 1)
      next.splice(targetIndex, 0, section)
      return next
    })
  }

  const scopedExportInput = {
    ...exportInput,
    title,
    sections: orderedSections,
  }

  return (
    <section className="strategic-report-content-section">
      <header>
        <div>
          {eyebrow.trim().toLowerCase() !== title.trim().toLowerCase() ? (
            <span>{eyebrow}</span>
          ) : null}
          <h2>{title}</h2>
          <p>{description}</p>
        </div>
        <div className="strategic-report-section-actions">
          <small>{sections.length} source section{sections.length === 1 ? '' : 's'}</small>
          <button
            type="button"
            onClick={() => {
              setPreviewSectionId(undefined)
              setPreviewOpen(true)
            }}
          >
            <Glyph type="file" />
            Download
          </button>
        </div>
      </header>
      {orderedSections.length > 0 ? (
        <div className="strategic-report-table-of-contents">
          <div className="strategic-report-toc-heading">
            <strong>Table of contents</strong>
            <small>Choose a section to open the full analysis. Use the controls to reorder it.</small>
          </div>
          <ol>
            {orderedSections.map((section, index) => (
              <li key={section.id}>
                <button
                  type="button"
                  className="strategic-report-toc-item"
                  onClick={() => {
                    setPreviewSectionId(section.id)
                    setPreviewOpen(true)
                  }}
                >
                  <span>{String(index + 1).padStart(2, '0')}</span>
                  <strong>{section.title}</strong>
                </button>
                <div className="strategic-report-toc-order-actions">
                  <button
                    type="button"
                    className="strategic-report-toc-edit-action"
                    onClick={() => setEditingSection(section)}
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    aria-label={`Move ${section.title} up`}
                    onClick={() => moveSection(section.id, 'up')}
                    disabled={index === 0}
                  >
                    Up
                  </button>
                  <button
                    type="button"
                    aria-label={`Move ${section.title} down`}
                    onClick={() => moveSection(section.id, 'down')}
                    disabled={index === orderedSections.length - 1}
                  >
                    Down
                  </button>
                </div>
              </li>
            ))}
          </ol>
        </div>
      ) : (
        <div className="strategic-report-content-empty">
          <strong>{emptyMessage ?? 'This analysis has not been generated yet.'}</strong>
        </div>
      )}
      {previewOpen ? (
        <StrategicReportDocumentPreviewDialog
          title={title}
          sections={orderedSections}
          exportInput={scopedExportInput}
          layouts={layouts}
          initialSectionId={previewSectionId}
          onClose={() => setPreviewOpen(false)}
        />
      ) : null}
      {editingSection ? (
        <StrategicReportSectionEditorDialog
          appId={appId}
          strategicReportId={strategicReportId}
          section={editingSection}
          layouts={layouts}
          onClose={() => setEditingSection(null)}
          onSaved={(section) => {
            setOrderedSections((current) =>
              current.map((item) => (item.id === section.id ? section : item)),
            )
            onSectionUpdated(section)
            setEditingSection(section)
          }}
        />
      ) : null}
    </section>
  )
}

function StrategicReportGeneratingView({
  application,
  error,
  onRetry,
}: {
  application: ApplicationRecord
  error?: string
  onRetry?: () => void
}) {
  const steps = [
    'Analyze opportunity and reviewer criteria',
    'Build the configured Strategic Report structure',
    'Generate business and technology analysis',
    'Generate the financial model and monthly forecast',
    'Run the final AI review and save the report',
  ]

  return (
    <section className="strategic-reports-page">
      <header className="strategic-reports-header">
        <div>
          <p className="workspace-eyebrow">Strategic Reports</p>
          <h1>Building your Strategic Report.</h1>
          <p>
            {application.programName} · {application.company}. The report is being generated here,
            so you can follow the analysis without returning to Quick Build.
          </p>
        </div>
      </header>

      <section className="strategic-report-analysis-panel strategic-report-generation-panel">
        <header className="strategic-report-analysis-heading">
          <div>
            <span>Analysis Process</span>
            <h2>{error ? 'Generation needs attention.' : 'The report is being built now.'}</h2>
            <p>
              {error ??
                'The application is saved. Strategic Report sections, the financial forecast, and the AI review are running in this page.'}
            </p>
          </div>
          <small>Application {application.appId ?? application.id}</small>
        </header>

        <div className="strategic-report-process-list">
          {steps.map((step, index) => (
            <article key={step}>
              <span>{error ? '!' : index === 0 ? '•' : '○'}</span>
              <div>
                <strong>{step}</strong>
                <p>{index === 0 && !error ? 'Live request in progress.' : 'Queued.'}</p>
              </div>
            </article>
          ))}
        </div>

        {onRetry ? (
          <button type="button" className="strategic-reports-primary-action" onClick={onRetry}>
            Retry generation
          </button>
        ) : null}
      </section>
    </section>
  )
}

function StrategicReportsPage() {
  const { t } = useTranslation()
  const { locale } = useLocale()
  const { config } = usePlatformConfig()
  const location = useLocation()
  const navigate = useNavigate()
  const [generationError, setGenerationError] = useState('')
  const [generationStatus, setGenerationStatus] = useState<'idle' | 'generating' | 'failed'>('idle')
  const [financialPreviewOpen, setFinancialPreviewOpen] = useState(false)
  const [, setRemoteStateRevision] = useState(0)
  const generationApplicationRef = useRef<string | null>(null)
  useEffect(() => {
    let active = true
    void hydratePersistentStorage().then(() => {
      if (active) setRemoteStateRevision((revision) => revision + 1)
    })
    return () => {
      active = false
    }
  }, [location.search])

  const applications = loadApplications()
  const reports = getStrategicReviewReports(applications)
  const requestedAppId =
    new URLSearchParams(location.search).get('app_id')?.trim() ?? ''
  const selectedApplication = requestedAppId
    ? findApplicationRecordByPublicId(applications, requestedAppId)
    : null
  const selectedReport = selectedApplication
    ? reports.find((report) => report.applicationId === selectedApplication.id) ?? null
    : null
  const selectedApplicationId = selectedApplication?.id ?? ''
  const selectedApplicationAppId = selectedApplication?.appId ?? ''
  const selectedApplicationAmount = selectedApplication?.amount ?? 0
  const hasSelectedReport = Boolean(selectedReport)
  const reportApplicationCount = new Set(reports.map((report) => report.applicationId)).size
  const totalSections = reports.reduce(
    (total, report) => total + report.generatedPackage.sections.length,
    0,
  )

  useEffect(() => {
    if (!requestedAppId || !selectedApplicationId || hasSelectedReport) {
      return
    }
    if (generationApplicationRef.current === selectedApplicationId) {
      return
    }

    generationApplicationRef.current = selectedApplicationId
    setGenerationError('')
    setGenerationStatus('generating')

    let active = true
    const abortController = new AbortController()
    const generateReport = async () => {
      try {
        const applicationId = selectedApplicationAppId || selectedApplicationId
        const response = await generateBusinessPlanViaApi({
          app_id: applicationId,
          language: locale,
          signal: abortController.signal,
        })
        const nextPackage = createGeneratedPackageFromBackend(
          response,
          `$${selectedApplicationAmount.toLocaleString(locale)} CAD`,
          'Database application record',
          config.advisoryHub.sections.filter((section) => section.enabled),
          config.advisoryHub.agents,
          config.advisoryHub.documentTypes,
        )
        const currentApplications = loadApplications()
        const currentApplication = findApplicationRecord(
          currentApplications,
          selectedApplicationId,
        )
        if (!currentApplication) {
          throw new Error('The application is no longer available in this workspace.')
        }

        const report = createStrategicReviewReport(currentApplication.id, nextPackage)
        const nextApplications = upsertGeneratedApplication(currentApplications, {
          id: currentApplication.id,
          title: `${nextPackage.programName} application`,
          programName: nextPackage.programName,
          programUrl: currentApplication.programUrl,
          company: nextPackage.businessName,
          fundingType: currentApplication.fundingType,
          amount: currentApplication.amount,
          deadline: currentApplication.deadline,
          owner: currentApplication.owner,
          readinessScore: nextPackage.readinessScore,
          documentCount: nextPackage.documents.length,
          generatedAt: new Date(nextPackage.completedAt),
          strategicReviewReport: report,
        })
        saveApplications(nextApplications)

        if (active) setGenerationStatus('idle')
      } catch (error) {
        if (!active) return
        generationApplicationRef.current = null
        setGenerationStatus('failed')
        setGenerationError(
          error instanceof Error ? error.message : 'Strategic Report generation failed.',
        )
      }
    }

    void generateReport()
    return () => {
      active = false
      abortController.abort()
      if (generationApplicationRef.current === selectedApplicationId) {
        generationApplicationRef.current = null
      }
    }
  }, [
    config.advisoryHub.agents,
    config.advisoryHub.documentTypes,
    config.advisoryHub.sections,
    locale,
    hasSelectedReport,
    requestedAppId,
    selectedApplicationAmount,
    selectedApplicationAppId,
    selectedApplicationId,
  ])

  if (requestedAppId && selectedApplication && !selectedReport) {
    return (
      <StrategicReportGeneratingView
        application={selectedApplication}
        error={generationStatus === 'failed' ? generationError : undefined}
        onRetry={
          generationStatus === 'failed'
            ? () => {
                generationApplicationRef.current = null
                setGenerationError('')
                setGenerationStatus('idle')
              }
            : undefined
        }
      />
    )
  }

  function openReport(report: StrategicReviewReport) {
    const application = applications.find((item) => item.id === report.applicationId)
    if (!application) return

    navigate(
      `/strategic-reports?app_id=${encodeURIComponent(application.appId ?? application.id)}`,
    )
  }

  function closeReport() {
    navigate('/strategic-reports')
  }

  if (selectedReport && selectedApplication) {
    const selectedApplicationRecord = selectedApplication
    const selectedReportRecord = selectedReport
    const packageRecord = selectedReport.generatedPackage
    const forecast = packageRecord.financialForecast
    const firstDocument = packageRecord.documents[0]
    const sectionText = (section: GeneratedPackageSection) =>
      `${section.id} ${section.title} ${section.documentLabel}`.toLowerCase()
    const technologyAnalysisSections = packageRecord.sections.filter((section) =>
      /technology|technical|tech|digital/iu.test(sectionText(section)),
    )
    const financialModelSections = packageRecord.sections.filter((section) =>
      /financial|forecast|cash[-\s]?flow/iu.test(sectionText(section)),
    )
    const businessAnalysisSections = packageRecord.sections.filter(
      (section) =>
        !technologyAnalysisSections.some((technologySection) => technologySection.id === section.id) &&
        !financialModelSections.some((financialSection) => financialSection.id === section.id),
    )
    const businessAnalysisExportInput = createReportExportInput(
      packageRecord,
      businessAnalysisSections,
      undefined,
    )
    businessAnalysisExportInput.title = 'Business Analysis'
    const technologyAnalysisExportInput = createReportExportInput(
      packageRecord,
      technologyAnalysisSections,
      undefined,
    )
    technologyAnalysisExportInput.title = 'Technology Analysis'
    const financialModelExportInput = createReportExportInput(
      packageRecord,
      financialModelSections,
      forecast,
    )
    financialModelExportInput.title = 'Financial Model'
    const reportAgents = [...new Set(packageRecord.sections.map((section) => section.agent))]
    const analysisSteps = [
      {
        label: 'Analyze opportunity',
        detail: 'Funding requirements, reviewer criteria, and evidence needs were identified.',
      },
      {
        label: 'Build funding strategy',
        detail: `${packageRecord.sections.length} configured sections were mapped to the report workflow.`,
      },
      {
        label: 'Generate report sections',
        detail: `${packageRecord.sections.length} sections were generated and saved to this report.`,
      },
      {
        label: 'Generate financial forecast',
        detail: forecast
          ? `${forecast.years}-year forecast with ${forecast.months.length} monthly periods is ready.`
          : 'No financial forecast is attached to this report yet.',
      },
      {
        label: 'AI review & improve',
        detail: 'The completed package is ready for review, editing, and export.',
      },
    ]

    function persistUpdatedSection(updatedSection: GeneratedPackageSection) {
      const currentApplications = loadApplications()
      const nextApplications = currentApplications.map((application) => {
        if (application.id !== selectedApplicationRecord.id) return application

        const reports = (application.strategicReviewReports ?? []).map((report) => {
          if (report.id !== selectedReportRecord.id) return report

          const generatedPackage = report.generatedPackage
          const sections = generatedPackage.sections.map((section) =>
            section.id === updatedSection.id ? updatedSection : section,
          )
          const documents = generatedPackage.documents.map((document) => ({
            ...document,
            summary:
              updatedSection.id === 'executive-summary' ||
              updatedSection.id === 'executive_summary'
                ? updatedSection.body
                : document.summary,
            sections: document.sections.map((section) =>
              section.title === updatedSection.title
                ? { ...section, body: updatedSection.body }
                : section,
            ),
          }))

          return {
            ...report,
            generatedPackage: {
              ...generatedPackage,
              sections,
              documents,
            },
          }
        })

        return {
          ...application,
          strategicReviewReports: reports,
        }
      })

      saveApplications(nextApplications)
      setRemoteStateRevision((revision) => revision + 1)
    }

    return (
      <section className="strategic-reports-page">
        <header className="strategic-reports-header">
          <div>
            <p className="workspace-eyebrow">Strategic Reports</p>
            <h1>{packageRecord.programName}</h1>
            <p>
              {packageRecord.businessName} · {packageRecord.fundingRequest}
            </p>
          </div>
          <div className="strategic-reports-header-actions">
            <button type="button" className="strategic-reports-secondary-action" onClick={closeReport}>
              {t('quickBuild.back')}
            </button>
            <Link
              to={`/quick-build?app_id=${encodeURIComponent(selectedApplication.appId ?? selectedApplication.id)}`}
              className="strategic-reports-primary-action"
            >
              {t('quickBuild.edit')}
            </Link>
          </div>
        </header>

        <div className="strategic-reports-id-row">
          <span>app_id</span>
          <code>{selectedApplication.appId ?? selectedApplication.id}</code>
          <span>report_id</span>
          <code>{selectedReport.id}</code>
        </div>

        <div className="strategic-reports-metrics">
          <article className="is-primary">
            <span>{t('quickBuild.readiness')}</span>
            <strong>{packageRecord.readinessScore}%</strong>
            <small>{t('common.completed')}</small>
          </article>
          <article>
            <span>Sections</span>
            <strong>{packageRecord.sections.length}</strong>
            <small>Configured report sections</small>
          </article>
          <article>
            <span>Financial forecast</span>
            <strong>{forecast ? `${forecast.years} yr` : 'Ready'}</strong>
            <small>{forecast ? `${forecast.months.length} monthly periods` : 'Open the editor to generate'}</small>
          </article>
        </div>

        <section className="strategic-report-analysis-panel">
          <header className="strategic-report-analysis-heading">
            <div>
              <span>Analysis Process</span>
              <h2>How this Strategic Report was built.</h2>
              <p>
                The report keeps the analysis trail visible so you can see how the opportunity,
                strategy, sections, forecast, and review were connected.
              </p>
            </div>
            <small>{packageRecord.sourceMaterial}</small>
          </header>

          <div className="strategic-report-analysis-grid">
            <div className="strategic-report-process-list">
              {analysisSteps.map((step) => (
                <article key={step.label}>
                  <span>✓</span>
                  <div>
                    <strong>{step.label}</strong>
                    <p>{step.detail}</p>
                  </div>
                </article>
              ))}
            </div>

            <div className="strategic-report-analysis-side">
              <article>
                <header>
                  <span>Thought Stream</span>
                  <small>{packageRecord.thoughts.length} updates</small>
                </header>
                <ol>
                  {(packageRecord.thoughts.length > 0
                    ? packageRecord.thoughts
                    : ['The report analysis was completed and saved.']
                  ).map((thought, index) => (
                    <li key={`${thought}-${index}`}>{thought}</li>
                  ))}
                </ol>
              </article>

              <article>
                <header>
                  <span>AI Consulting Team</span>
                  <small>{reportAgents.length} agents</small>
                </header>
                <div className="strategic-report-agent-list">
                  {reportAgents.map((agent) => (
                    <span key={agent}>{agent}</span>
                  ))}
                </div>
              </article>
            </div>
          </div>
        </section>

        <section className="strategic-report-detail-panel strategic-report-overview-panel">
          <div className="strategic-report-detail-heading">
            <div>
              <span>Strategic Report</span>
              <h2>{packageRecord.title}</h2>
              <p>{firstDocument?.summary || 'Review the generated funding package section by section.'}</p>
            </div>
            <small>
              {new Intl.DateTimeFormat(locale, {
                month: 'short',
                day: 'numeric',
                year: 'numeric',
              }).format(new Date(packageRecord.completedAt))}
            </small>
          </div>
        </section>

        <StrategicReportContentSection
          appId={selectedApplication.appId ?? selectedApplication.id}
          strategicReportId={selectedReport.id}
          eyebrow="Business Analysis"
          title="Business analysis"
          description="The business plan is presented as one independent analysis of the company, operating model, and execution case."
          sections={businessAnalysisSections}
          exportInput={businessAnalysisExportInput}
          layouts={config.advisoryHub.layouts}
          onSectionUpdated={persistUpdatedSection}
          emptyMessage="No business analysis section was generated for this report."
        />

        <StrategicReportContentSection
          appId={selectedApplication.appId ?? selectedApplication.id}
          strategicReportId={selectedReport.id}
          eyebrow="Technology Analysis"
          title="Technology analysis"
          description="Review the technology, digital capability, systems, and implementation requirements connected to the opportunity."
          sections={technologyAnalysisSections}
          exportInput={technologyAnalysisExportInput}
          layouts={config.advisoryHub.layouts}
          onSectionUpdated={persistUpdatedSection}
          emptyMessage="Technology analysis has not been generated for this report yet."
        />

        <section className="strategic-report-content-section strategic-report-financial-section">
          <header>
            <div>
              <h2>Financial model</h2>
              <p>Monthly financial forecast and planning assumptions for the funding strategy.</p>
            </div>
            <div className="strategic-report-section-actions">
              <button type="button" onClick={() => setFinancialPreviewOpen(true)} disabled={!forecast}>
                <Glyph type="file" />
                Download
              </button>
            </div>
          </header>
          {forecast ? (
            <FinancialForecastTable forecast={forecast} showLabel={false} />
          ) : (
            <div className="strategic-report-content-empty">
              <strong>Financial forecast has not been generated for this report yet.</strong>
              <Link
                to={`/quick-build?app_id=${encodeURIComponent(selectedApplication.appId ?? selectedApplication.id)}`}
                className="strategic-reports-primary-action"
              >
                Open Quick Build
              </Link>
            </div>
          )}
          {financialPreviewOpen && forecast ? (
            <StrategicReportFinancialPreviewDialog
              forecast={forecast}
              exportInput={financialModelExportInput}
              onClose={() => setFinancialPreviewOpen(false)}
            />
          ) : null}
        </section>

      </section>
    )
  }

  return (
    <section className="strategic-reports-page">
      <header className="strategic-reports-header is-listing-topbar">
        <div>
          <h1>{t('workspacePages.strategicReports.title')}</h1>
          <p>{t('workspacePages.strategicReports.description')}</p>
        </div>
        <Link to="/quick-build" className="strategic-reports-primary-action">
          <Glyph type="spark" />
          {t('quickBuild.generate')}
        </Link>
      </header>

      <div className="strategic-reports-metrics">
        <article className="is-primary">
          <span>{t('workspacePages.strategicReports.report')}</span>
          <strong>{reports.length}</strong>
          <small>{t('workspacePages.strategicReports.generatedInWorkspace')}</small>
        </article>
        <article>
          <span>{t('workspacePages.applications.application')}</span>
          <strong>{reportApplicationCount}</strong>
          <small>{t('workspacePages.strategicReports.linkedApplicationRecords')}</small>
        </article>
        <article>
          <span>{t('workspacePages.strategicReports.sections')}</span>
          <strong>{totalSections}</strong>
          <small>{t('workspacePages.strategicReports.acrossReports')}</small>
        </article>
      </div>

      <section className="strategic-reports-results">
        <div className="strategic-reports-results-heading">
          <div>
            <span>{t('workspacePages.strategicReports.title')}</span>
            <h2>{t('workspacePages.strategicReports.chooseReport')}</h2>
          </div>
          <small>{t('workspacePages.strategicReports.reportCount', { count: reports.length })}</small>
        </div>

        {reports.length > 0 ? (
          <div className="strategic-reports-grid">
            {reports.map((report) => {
              const application = applications.find((item) => item.id === report.applicationId)
              return (
                <button
                  key={report.id}
                  type="button"
                  className="strategic-report-card"
                  onClick={() => openReport(report)}
                >
                  <div className="strategic-report-card-topline">
                  <span><Glyph type="spark" /> {t('workspacePages.strategicReports.report')}</span>
                    <strong>{report.generatedPackage.readinessScore}%</strong>
                  </div>
                  <h3>{report.generatedPackage.programName}</h3>
                  <p>{report.generatedPackage.businessName}</p>
                  <small>app_id · {application?.appId ?? report.applicationId}</small>
                  <footer>
                    <span>{report.generatedPackage.sections.length} {t('workspacePages.strategicReports.sections')}</span>
                    <b>{t('quickBuild.openReport')} <Glyph type="arrow" /></b>
                  </footer>
                </button>
              )
            })}
          </div>
        ) : (
          <div className="strategic-reports-empty">
            <span><Glyph type="spark" /></span>
            <strong>{t('quickBuild.noReports')}</strong>
            <p>{t('quickBuild.noReportsDescription')}</p>
            <Link to="/quick-build">{t('quickBuild.generateNewReport')}</Link>
          </div>
        )}
      </section>
    </section>
  )
}

function findBackendSectionBody(
  sections: BusinessPlanSectionResponse[],
  matcher: RegExp,
) {
  return (
    sections.find(
      (section) =>
        matcher.test(section.section_key) || matcher.test(section.title),
    )?.content ?? ''
  ).trim()
}

function createGeneratedPackageFromBackend(
  response: BusinessPlanGenerateResponse,
  fundingRequest: string,
  sourceMaterial: string,
  configuredSections: AdvisoryHubSectionConfig[],
  configuredAgents: AdvisoryHubAgentConfig[],
  configuredDocumentTypes: AdvisoryHubDocumentTypeConfig[],
): GeneratedPackage {
  const document = response.document
  if (!document) {
    throw new Error('The generation backend did not return a document.')
  }

  const backendSectionIds = new Set(
    document.sections.map((section) => section.section_key),
  )
  const sections = createConfiguredAdvisoryHubSections(
    configuredSections.filter((section) => backendSectionIds.has(section.id)),
    configuredAgents,
    configuredDocumentTypes,
    {
      'executive-summary':
        document.executive_summary.trim() ||
        findBackendSectionBody(document.sections, /executive|summary/iu),
      'cover-page':
        `${document.program_name} Strategic Report for ${document.business_name}.`,
      'business-overview':
        findBackendSectionBody(
          document.sections,
          /company|overview|business[-_\s]?overview/iu,
        ) || document.sections[0]?.content,
      'sales-and-marketing':
        findBackendSectionBody(
          document.sections,
          /market|customer|competition|traction|demand|sales|marketing/iu,
        ),
      'operating-plan': findBackendSectionBody(
        document.sections,
        /operating|operations|implementation|delivery/iu,
      ),
      people: findBackendSectionBody(
        document.sections,
        /people|team|leadership|management|staff/iu,
      ),
      'action-plan': findBackendSectionBody(
        document.sections,
        /action|next[-_\s]?steps|milestone|execution/iu,
      ),
      'technology-cover-page':
        `${document.program_name} Technology Analysis for ${document.business_name}.`,
      'technology-executive-summary':
        findBackendSectionBody(
          document.sections,
          /technology|technical|digital|systems/iu,
        ) || document.executive_summary.trim(),
      'business-technology-overview': findBackendSectionBody(
        document.sections,
        /business.*technology|technology.*overview|digital.*capability/iu,
      ),
      'technology-assessment': findBackendSectionBody(
        document.sections,
        /technology|technical|system|architecture|security|integration/iu,
      ),
      'gap-opportunity-analysis': findBackendSectionBody(
        document.sections,
        /gap|opportunity|risk|challenge|readiness/iu,
      ),
      'technology-roadmap': findBackendSectionBody(
        document.sections,
        /roadmap|implementation|milestone|initiative|next[-_\s]?steps/iu,
      ),
      'technology-ai-review':
        findBackendSectionBody(document.sections, /technology.*review|technical.*review|review/iu) ||
        `The technology analysis is being refined for ${document.program_name} with clearer feasibility, implementation, and reviewer confidence language.`,
      'financial-model':
        findBackendSectionBody(
          document.sections,
          /financial|forecast|cash[-_\s]?flow|use[-_\s]?of[-_\s]?funds/iu,
        ),
      'funding-narrative':
        findBackendSectionBody(
          document.sections,
          /narrative|funding|implementation|milestone|project/iu,
        ),
      'ai-review':
        findBackendSectionBody(document.sections, /risk|review/iu) ||
        `The package is being refined for ${document.program_name} with stronger measurable outcomes, reviewer confidence language, and clearer next-step logic.`,
      'company-overview': findBackendSectionBody(
        document.sections,
        /company|overview|business[-_\s]?overview/iu,
      ),
      'market-analysis': findBackendSectionBody(
        document.sections,
        /market|customer|competition|traction|demand/iu,
      ),
    },
  )

  const readinessScore = Math.min(
    96,
    Math.max(72, 70 + document.sections.length * 3 + Math.min(document.key_strengths.length, 3)),
  )

  const businessPlanDocument: GeneratedDocument = {
    title: document.title,
    readinessScore,
    summary: document.executive_summary,
    sections: document.sections.map((section) => ({
      title: section.title,
      body: section.content,
    })),
    metrics: [
      { label: 'Funding Request', value: fundingRequest },
      { label: 'Program', value: document.program_name },
      { label: 'Business', value: document.business_name },
      { label: 'Sections', value: `${document.sections.length}` },
    ],
    milestones: document.next_steps,
    financialForecast: document.financial_forecast,
  }

  return {
    title: document.title,
    strategicReportId: response.strategic_report_id,
    programName: document.program_name,
    businessName: document.business_name,
    fundingRequest,
    sourceMaterial,
    completedAt: response.completed_at ?? new Date().toISOString(),
    readinessScore,
    thoughts: [
      ...document.key_strengths.map((item) => `Strength detected: ${item}`),
      ...document.risks.map((item) => `Risk considered: ${item}`),
      ...document.next_steps.map((item) => `Next step: ${item}`),
    ].slice(0, 8),
    documents: [businessPlanDocument],
    sections,
    financialForecast: document.financial_forecast,
  }
}

function QuickBuildPage({
  initialView = 'form',
}: {
  initialView?: 'form' | 'workspace'
}) {
  const { t } = useTranslation()
  const { locale } = useLocale()
  const location = useLocation()
  const navigate = useNavigate()
  const draftStorageKey = 'bconomics-quick-build-draft-v1'
  const generatedDocumentsStorageKey = 'bconomics-generated-documents-v1'
  const { config } = usePlatformConfig()
  const platformName = getPlatformDisplayName(config)
  const [programName, setProgramName] = useState('')
  const [programUrl, setProgramUrl] = useState('')
  const [amount, setAmount] = useState('')
  const [useWinningTemplate, setUseWinningTemplate] = useState(
    () => loadQuickBuildPreferences().usePlatformStructureByDefault,
  )
  const [fileName, setFileName] = useState('')
  const [businessName, setBusinessName] = useState('')
  const [fullName, setFullName] = useState('')
  const [businessIdea, setBusinessIdea] = useState('')
  const [teamIntro, setTeamIntro] = useState('')
  const [formMessage, setFormMessage] = useState('')
  const [activeStep, setActiveStep] = useState<QuickBuildStep>(1)
  const [currentApplicationId, setCurrentApplicationId] = useState<string | null>(null)
  const [generatedPackage, setGeneratedPackage] = useState<GeneratedPackage | null>(null)
  const [strategicReviewReports, setStrategicReviewReports] = useState<StrategicReviewReport[]>(
    () => getStrategicReviewReports(loadApplications()),
  )
  const [selectedStrategicReviewReportId, setSelectedStrategicReviewReportId] = useState<
    string | null
  >(null)
  const [workspacePhase, setWorkspacePhase] = useState<WorkspacePhase>('idle')
  const [workspaceSections, setWorkspaceSections] = useState<WorkspaceSectionState[]>([])
  const [workspaceThoughts, setWorkspaceThoughts] = useState<string[]>([])
  const [selectedSectionId, setSelectedSectionId] = useState<string | null>(null)
  const [editorMode, setEditorMode] = useState(false)
  const [companyPickerOpen, setCompanyPickerOpen] = useState(false)
  const [companyOptions, setCompanyOptions] = useState<CompanyRecord[]>([])
  const [companyQuery, setCompanyQuery] = useState('')
  const [programPickerOpen, setProgramPickerOpen] = useState(false)
  const [programQuery, setProgramQuery] = useState('')
  const [programType, setProgramType] = useState<'All' | 'Grant' | 'Loan'>('All')
  const generationRun = useRef(0)
  const appIdFromQuery =
    new URLSearchParams(location.search).get('app_id')?.trim() ?? ''
  const companyIdFromQuery =
    new URLSearchParams(location.search).get('company_id')?.trim() ?? ''
  const programIdFromQuery =
    new URLSearchParams(location.search).get('program_id')?.trim() ?? ''
  const hasApplicationQuery = Boolean(appIdFromQuery)
  const hasBuildContextQuery = Boolean(
    appIdFromQuery || companyIdFromQuery || programIdFromQuery,
  )
  const fundingProgramCatalog = useMemo(
    () =>
      loadFundingPrograms(
        config.dataSources.filter((source) => source.enabled).map((source) => source.id),
      ),
    [config.dataSources],
  )
  const advisoryHubSections = useMemo(() => {
    const enabledSections = config.advisoryHub.sections.filter(
      (section) => section.enabled,
    )
    return enabledSections.length > 0
      ? enabledSections
      : config.advisoryHub.sections.slice(0, 1)
  }, [config.advisoryHub.sections])
  const advisoryHubAgents = config.advisoryHub.agents
  const advisoryHubDocumentTypes = config.advisoryHub.documentTypes
  const selectedStrategicReviewReport = strategicReviewReports.find(
    (report) => report.id === selectedStrategicReviewReportId,
  )
  const showsStrategicReviewListing = initialView === 'workspace' && !selectedStrategicReviewReport
  const strategicReviewApplicationCount = new Set(
    strategicReviewReports.map((report) => report.applicationId),
  ).size

  useEffect(() => {
    if (hasBuildContextQuery) return

    const savedDraft = window.localStorage.getItem(draftStorageKey)
    if (!savedDraft) return

    try {
      const draft = JSON.parse(savedDraft) as Record<string, string | boolean>
      setProgramName(String(draft.programName ?? ''))
      setProgramUrl(String(draft.programUrl ?? ''))
      setAmount(String(draft.amount ?? ''))
      if (typeof draft.useWinningTemplate === 'boolean') {
        setUseWinningTemplate(draft.useWinningTemplate)
      }
      setFileName(String(draft.fileName ?? ''))
      setBusinessName(String(draft.businessName ?? ''))
      setFullName(String(draft.fullName ?? ''))
      setBusinessIdea(String(draft.businessIdea ?? ''))
      setTeamIntro(String(draft.teamIntro ?? ''))
      setFormMessage('Draft restored from your workspace.')
    } catch {
      removePersistentItem(draftStorageKey)
    }
  }, [hasBuildContextQuery])

  useEffect(() => {
    if (
      window.localStorage.getItem(quickBuildPreferencesStorageKey) !== null
    ) {
      return
    }

    setPersistentItem(
      quickBuildPreferencesStorageKey,
      JSON.stringify(defaultQuickBuildPreferences),
    )
  }, [])

  useEffect(() => {
    if (!hasApplicationQuery) return

    const applications = loadApplications()
    const matchingApplication =
      findApplicationRecordByAppId(applications, appIdFromQuery) ??
      findApplicationRecord(applications, appIdFromQuery)

    if (!matchingApplication) {
      setFormMessage('This application could not be found in My Applications.')
      return
    }

    const matchingReport = matchingApplication.strategicReviewReports?.at(-1)
    const matchingCompany = loadCompanyRecords().find(
      (company) =>
        company.id === companyIdFromQuery ||
        company.name === matchingApplication.company,
    )

    void restoreApplicationWorkspace(
      matchingApplication,
      matchingReport
        ? `${matchingReport.generatedPackage.title} opened in Strategic Report.`
        : `${matchingApplication.title} restored from My Applications.`,
      matchingReport,
      matchingCompany,
    )
  }, [appIdFromQuery, companyIdFromQuery, hasApplicationQuery])

  useEffect(() => {
    if (
      hasApplicationQuery ||
      (!companyIdFromQuery && !programIdFromQuery)
    ) return

    const matchingCompany = loadCompanyRecords().find(
      (company) => company.id === companyIdFromQuery,
    )
    const matchingProgram = fundingProgramCatalog.find(
      (program) => program.id === programIdFromQuery,
    )

    if (matchingProgram) {
      setProgramName(matchingProgram.name)
      setProgramUrl(matchingProgram.url)
      setAmount(matchingProgram.amount.toLocaleString(locale))
    }

    if (matchingCompany) {
      setBusinessName(matchingCompany.name)
      setFullName(matchingCompany.owner)
      setBusinessIdea(matchingCompany.description)
      setTeamIntro(
        matchingCompany.teamIntro ||
          `${matchingCompany.owner} leads a ${matchingCompany.employees || 'growing'}-person ${
            matchingCompany.industry ? matchingCompany.industry.toLowerCase() : 'business'
          } team in ${matchingCompany.location || 'Canada'}.`,
      )
      setFormMessage(`${matchingCompany.name} and the selected funding program are ready.`)
    }
  }, [
    companyIdFromQuery,
    fundingProgramCatalog,
    hasApplicationQuery,
    locale,
    programIdFromQuery,
  ])

  useEffect(() => {
    if (hasBuildContextQuery) return

    const selectedProgram = window.localStorage.getItem(selectedFundingProgramStorageKey)
    if (!selectedProgram) return

    try {
      const program = JSON.parse(selectedProgram) as FundingProgramRecord
      stageFundingProgramSelection(
        program,
        `${program.name} selected for this funding package.`,
      )
    } catch {
      // Ignore stale selections from older local builds.
    } finally {
      removePersistentItem(selectedFundingProgramStorageKey)
    }
  }, [hasBuildContextQuery])

  useEffect(() => {
    if (hasBuildContextQuery) return

    const selectedTemplate = window.localStorage.getItem(selectedTemplateStorageKey)
    if (!selectedTemplate) return

    try {
      const template = JSON.parse(selectedTemplate) as TemplateRecord
      setUseWinningTemplate(true)
      setFileName(`${template.title}.${template.format.toLowerCase()}`)
      setFormMessage(`${template.title} selected from Templates.`)
    } catch {
      // Ignore stale selections from older local builds.
    } finally {
      removePersistentItem(selectedTemplateStorageKey)
    }
  }, [hasBuildContextQuery])

  useEffect(() => {
    if (initialView === 'workspace') {
      if (hasApplicationQuery) return

      setStrategicReviewReports(getStrategicReviewReports(loadApplications()))
      setSelectedStrategicReviewReportId(null)
      setGeneratedPackage(null)
      setWorkspacePhase('idle')
      setWorkspaceSections([])
      setWorkspaceThoughts([])
      setSelectedSectionId(null)
      setEditorMode(false)
      setActiveStep('workspace')
      setFormMessage('')
      return
    }

    setActiveStep(generatedPackage ? 3 : 1)
  }, [hasApplicationQuery, initialView])

  useEffect(
    () => () => {
      generationRun.current += 1
    },
    [],
  )

  useEffect(() => {
    if (!companyPickerOpen && !programPickerOpen) {
      return
    }

    const previousOverflow = document.body.style.overflow
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setCompanyPickerOpen(false)
        setProgramPickerOpen(false)
      }
    }

    document.body.style.overflow = 'hidden'
    window.addEventListener('keydown', closeOnEscape)
    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', closeOnEscape)
    }
  }, [companyPickerOpen, programPickerOpen])

  const programComplete = [programName, programUrl, amount].filter((value) =>
    value.trim(),
  ).length
  const businessComplete = [businessName, fullName, businessIdea, teamIntro].filter((value) =>
    value.trim(),
  ).length
  const isGenerating = ['analyzing', 'planning', 'generating', 'reviewing'].includes(
    workspacePhase,
  )
  const streamProgressAverage =
    workspaceSections.length > 0
      ? workspaceSections.reduce((sum, section) => sum + section.progress, 0) / workspaceSections.length
      : 0
  const workspaceProgress =
    workspacePhase === 'idle'
      ? 0
      : workspacePhase === 'analyzing'
        ? 10
        : workspacePhase === 'planning'
          ? 24
          : workspacePhase === 'generating'
            ? Math.round(26 + streamProgressAverage * 0.6)
            : workspacePhase === 'reviewing'
              ? 92
              : 100
  const visibleCompanyOptions = companyOptions.filter((company) =>
    `${company.name} ${company.legalName} ${company.industry} ${company.owner}`
      .toLowerCase()
      .includes(companyQuery.trim().toLowerCase()),
  )
  const visibleFundingPrograms = fundingProgramCatalog.filter((program) => {
    const matchesQuery =
      `${program.name} ${program.provider} ${program.location} ${program.sourceName}`
        .toLowerCase()
        .includes(programQuery.trim().toLowerCase())
    return matchesQuery && (programType === 'All' || program.type === programType)
  })
  const previewSection =
    workspaceSections.find((section) => section.id === selectedSectionId) ??
    workspaceSections.find((section) => section.status === 'working') ??
    workspaceSections.find((section) => section.status === 'complete') ??
    workspaceSections[0] ??
    null
  const summaryProgram = programName || generatedPackage?.programName || 'Not selected'
  const summaryFundingRequest =
    (amount ? `$${amount} CAD` : generatedPackage?.fundingRequest) || 'Not entered'
  const summaryBusiness = businessName || generatedPackage?.businessName || 'Not entered'
  const analyzeChecklist = [
    programName ? `${programName} requirements detected` : 'Program requirements detected',
    amount ? `Funding amount mapped to ${summaryFundingRequest}` : 'Funding amount captured',
    'Mandatory sections and evidence checklist',
    'Evaluation criteria and reviewer preferences',
    'Preferred writing tone and commercialization signals',
  ]
  const planningChecklist = advisoryHubSections.map((section) => section.title)
  const workflowGenerationGroups = Array.from(
    new Set(
      advisoryHubSections
        .filter((section) => section.id !== 'ai-review')
        .map((section) =>
          advisoryHubDocumentTypes.find(
            (documentType) => documentType.id === section.documentTypeId,
          )?.name,
        )
        .filter((label): label is string => Boolean(label)),
    ),
  )
  const hasAiReviewSection = advisoryHubSections.some(
    (section) => section.id === 'ai-review',
  )
  const workflowItems = [
    {
      label: t('quickBuild.workflow.understandProgram'),
      status:
        workspacePhase === 'analyzing'
          ? 'working'
          : quickBuildPhaseRank[workspacePhase] > quickBuildPhaseRank.analyzing
            ? 'complete'
            : 'waiting',
    },
    {
      label: t('quickBuild.workflow.analyzeBusiness'),
      status:
        workspacePhase === 'planning'
          ? 'working'
          : quickBuildPhaseRank[workspacePhase] > quickBuildPhaseRank.planning
            ? 'complete'
            : 'waiting',
    },
    {
      label: t('quickBuild.workflow.buildOutline'),
      status:
        workspacePhase === 'planning'
          ? 'working'
          : quickBuildPhaseRank[workspacePhase] > quickBuildPhaseRank.planning
            ? 'complete'
            : 'waiting',
    },
    ...workflowGenerationGroups.map((documentLabel) => {
      const matchingSections = workspaceSections.filter(
        (section) => section.documentLabel === documentLabel,
      )

      return {
        label: t('quickBuild.workflow.generate', { document: documentLabel }),
        status:
          matchingSections.length > 0 &&
          matchingSections.every((section) => section.status === 'complete')
            ? ('complete' as const)
            : matchingSections.some((section) => section.status === 'working')
              ? ('working' as const)
              : ('waiting' as const),
      }
    }),
    ...(hasAiReviewSection
      ? [
          {
            label: t('quickBuild.workflow.aiReview'),
            status:
              workspacePhase === 'reviewing'
                ? ('working' as const)
                : workspacePhase === 'complete'
                  ? ('complete' as const)
                  : ('waiting' as const),
          },
        ]
      : []),
  ] as const
  const analysisAgent = advisoryHubAgents.find((agent) =>
    /analyst|opportunity|requirement/iu.test(`${agent.name} ${agent.role}`),
  )
  const planningAgent = advisoryHubAgents.find((agent) =>
    /consult|strategy|business/iu.test(`${agent.name} ${agent.role}`),
  )
  const reviewAgent = advisoryHubAgents.find((agent) =>
    /review|quality|compliance/iu.test(`${agent.name} ${agent.role}`),
  )
  const activeAgent =
    workspacePhase === 'analyzing'
      ? analysisAgent?.name
      : workspacePhase === 'planning'
        ? planningAgent?.name
        : workspacePhase === 'reviewing'
          ? reviewAgent?.name
          : previewSection?.status === 'working'
            ? previewSection.agent
            : null
  const agentCards = advisoryHubAgents.map((agent) => ({
    name: agent.name,
    helper: `${agent.role}. ${agent.prompt}`,
    status:
      activeAgent === agent.name
        ? ('working' as const)
        : workspaceSections.some(
              (section) =>
                section.agent === agent.name && section.status === 'complete',
            ) ||
            (workspacePhase === 'complete' &&
              (agent.name === reviewAgent?.name ||
                quickBuildPhaseRank[workspacePhase] >
                  quickBuildPhaseRank.planning))
          ? ('completed' as const)
          : ('waiting' as const),
  }))
  const completedSections = workspaceSections.filter(
    (section) => section.status === 'complete',
  ).length
  const workspaceLifecycle = [
    t('advisory.analyze'),
    t('quickBuild.workflow.buildOutline'),
    t('quickBuild.workflow.generate', { document: t('navigation.items.quickBuild') }),
    t('quickBuild.financialForecast'),
    t('quickBuild.workflow.generate', { document: t('quickBuild.fundingProgram') }),
    t('quickBuild.workflow.aiReview'),
    t('advisory.ready'),
  ] as const
  const stageSupportPoints =
    activeStep === 1
      ? t('quickBuild.support.program', { returnObjects: true })
      : activeStep === 2
        ? t('quickBuild.support.business', { returnObjects: true })
        : t('quickBuild.support.review', { returnObjects: true })
  const localizedStageSupportPoints = stageSupportPoints as string[]
  const stageSupportCards = localizedStageSupportPoints.map((point, index) => ({
    point,
    icon:
      activeStep === 1
        ? (['file', 'currency', 'search'][index] as DashboardGlyph)
        : activeStep === 2
          ? (['grid', 'user', 'spark'][index] as DashboardGlyph)
          : (['search', 'user', 'spark'][index] as DashboardGlyph),
  }))
  const workspaceStagePills = workspaceLifecycle.map((label, index) => {
    const status =
      workspacePhase === 'complete'
        ? 'complete'
        : workspacePhase === 'analyzing'
          ? index === 0
            ? 'working'
            : 'waiting'
          : workspacePhase === 'planning'
            ? index <= 1
              ? index === 1
                ? 'working'
                : 'complete'
              : 'waiting'
            : workspacePhase === 'generating'
              ? index <= 4
                ? index === 2 ||
                  index === 3 ||
                  index === 4
                  ? 'working'
                  : 'complete'
                : 'waiting'
              : workspacePhase === 'reviewing'
                ? index <= 5
                  ? index === 5
                    ? 'working'
                    : 'complete'
                  : 'waiting'
                : 'waiting'
    return { label, status }
  })
  const workspaceSignalCards = [
    {
      label: t('advisory.currentLead'),
      value: activeAgent ?? 'Queued',
      helper: t('advisory.nextMove'),
    },
    {
      label: t('advisory.sectionsReady'),
      value: `${completedSections}/${workspaceSections.length || advisoryHubSections.length}`,
      helper: t('advisory.completedLive'),
    },
    {
      label: t('advisory.thoughtStream'),
      value: `${workspaceThoughts.length}`,
      helper: t('advisory.narrationPublished'),
    },
    {
      label: t('advisory.nextOutput'),
      value:
        workspacePhase === 'complete'
          ? t('advisory.exportPackage')
          : previewSection?.title ?? t('advisory.sectionStream'),
      helper: t('advisory.founderExpectation'),
    },
  ] as const

  function persistGeneratedPackage(
    nextPackage: GeneratedPackage,
    applicationId = currentApplicationId,
    syncApplication = true,
  ) {
    setGeneratedPackage(nextPackage)
    if (syncApplication && applicationId) {
      const savedApplications = loadApplications()
      const currentApplication = findApplicationRecord(savedApplications, applicationId)
      if (currentApplication) {
        const currentReport = currentApplication.strategicReviewReports?.find(
          (report) => report.id === selectedStrategicReviewReportId,
        )
        saveApplications(
          upsertGeneratedApplication(savedApplications, {
            id: currentApplication.id,
            title: currentApplication.title,
            programName: currentApplication.programName,
            company: currentApplication.company,
            fundingType: currentApplication.fundingType,
            amount: currentApplication.amount,
            deadline: currentApplication.deadline,
            owner: currentApplication.owner,
            readinessScore: nextPackage.readinessScore,
            documentCount: nextPackage.documents.length,
            generatedAt: new Date(nextPackage.completedAt),
            strategicReviewReport: currentReport
              ? {
                  ...currentReport,
                  generatedPackage: nextPackage,
                }
              : undefined,
          }),
        )
        setStrategicReviewReports(getStrategicReviewReports(loadApplications()))
      }
    }
    removePersistentItem(generatedDocumentsStorageKey)
  }

  function stageFundingProgramSelection(program: FundingProgramRecord, message: string) {
    setCurrentApplicationId(null)
    setGeneratedPackage(null)
    setWorkspacePhase('idle')
    setWorkspaceSections([])
    setWorkspaceThoughts([])
    setSelectedSectionId(null)
    setEditorMode(false)
    setActiveStep(1)
    setProgramName(program.name)
    setProgramUrl(program.url)
    setAmount(program.amount.toLocaleString(locale))
    setFormMessage(message)
  }

  function updateUseWinningTemplatePreference(nextValue: boolean) {
    setUseWinningTemplate(nextValue)
    setPersistentItem(
      quickBuildPreferencesStorageKey,
      JSON.stringify({
        usePlatformStructureByDefault: nextValue,
      } satisfies QuickBuildPreferences),
    )
  }

  async function restoreApplicationWorkspace(
    application: ApplicationRecord,
    message?: string,
    report?: StrategicReviewReport,
    company?: CompanyRecord,
  ) {
    const matchedProgram = findFundingProgramByName(application.programName)
    const matchedCompany =
      company ?? loadCompanyRecords().find((item) => item.name === application.company)
    const selectedReport =
      report ?? application.strategicReviewReports?.at(-1) ?? undefined
    const packageRecord = selectedReport?.generatedPackage
    setCurrentApplicationId(application.id)
    setSelectedStrategicReviewReportId(selectedReport?.id ?? null)
    setProgramName(application.programName)
    setProgramUrl(application.programUrl || matchedProgram?.url || '')
    setAmount(application.amount.toLocaleString(locale))
    setBusinessName(matchedCompany?.name ?? application.company)
    setFullName(matchedCompany?.owner ?? application.owner)
    setBusinessIdea(matchedCompany?.description ?? '')
    setTeamIntro(
      matchedCompany?.teamIntro ||
        (matchedCompany
          ? `${matchedCompany.owner} leads a ${matchedCompany.employees || 'growing'}-person ${
              matchedCompany.industry ? matchedCompany.industry.toLowerCase() : 'business'
            } team in ${matchedCompany.location || 'Canada'}.`
          : ''),
    )
    if (packageRecord) {
      const applyPackage = (nextPackage: GeneratedPackage) => {
        setGeneratedPackage(nextPackage)
        setWorkspaceSections(hydrateWorkspaceSections(nextPackage))
        setWorkspaceThoughts(nextPackage.thoughts)
        setSelectedSectionId(nextPackage.sections[0]?.id ?? null)
      }

      applyPackage(packageRecord)
      setWorkspaceThoughts(packageRecord.thoughts)
      setSelectedSectionId(packageRecord.sections[0]?.id ?? null)
      setWorkspacePhase('complete')
      setEditorMode(false)
      setActiveStep('workspace')

      if (!packageRecord.financialForecast && selectedReport) {
          setFormMessage(`${message ?? 'Strategic Report opened.'} Loading financial forecast...`)
          try {
            const financialForecast = await generateFinancialForecastViaApi({
              app_id: application.appId ?? application.id,
              language: locale,
            })
          const nextPackage = { ...packageRecord, financialForecast }
          const nextApplications = loadApplications().map((currentApplication) =>
            currentApplication.id !== application.id
              ? currentApplication
              : {
                  ...currentApplication,
                  strategicReviewReports: currentApplication.strategicReviewReports?.map(
                    (currentReport) =>
                      currentReport.id === selectedReport.id
                        ? { ...currentReport, generatedPackage: nextPackage }
                        : currentReport,
                  ),
                },
          )
          saveApplications(nextApplications)
          setStrategicReviewReports(getStrategicReviewReports(nextApplications))
          applyPackage(nextPackage)
          setFormMessage(`${message ?? 'Strategic Report opened.'} Financial forecast ready.`)
        } catch {
          setFormMessage(
            `${message ?? 'Strategic Report opened.'} Financial forecast could not be loaded.`,
          )
        }
      }
    }
    if (message) {
      setFormMessage(message)
    }
  }

  function openStrategicReviewReport(report: StrategicReviewReport) {
    const application = findApplicationRecord(loadApplications(), report.applicationId)
    if (!application) {
      setFormMessage('This Strategic Report is no longer linked to an application.')
      return
    }

    navigate(getStrategicReportsPath(application.id))
  }

  function returnToStrategicReviewReports() {
    generationRun.current += 1
    setStrategicReviewReports(getStrategicReviewReports(loadApplications()))
    setSelectedStrategicReviewReportId(null)
    setGeneratedPackage(null)
    setWorkspacePhase('idle')
    setWorkspaceSections([])
    setWorkspaceThoughts([])
    setSelectedSectionId(null)
    setEditorMode(false)
    setFormMessage('')
    setActiveStep('workspace')
  }

  function resetProgram() {
    setProgramName('')
    setProgramUrl('')
    setAmount('')
    setUseWinningTemplate(
      loadQuickBuildPreferences().usePlatformStructureByDefault,
    )
    setFileName('')
    setFormMessage('')
  }

  function resetBusiness() {
    setBusinessName('')
    setFullName('')
    setBusinessIdea('')
    setTeamIntro('')
    generationRun.current += 1
    setWorkspacePhase('idle')
    setWorkspaceSections([])
    setWorkspaceThoughts([])
    setSelectedSectionId(null)
    setEditorMode(false)
    setCurrentApplicationId(null)
    setGeneratedPackage(null)
    removePersistentItem(generatedDocumentsStorageKey)
    setFormMessage('')
  }

  function openCompanyPicker() {
    setCompanyOptions(loadCompanyRecords())
    setCompanyQuery('')
    setCompanyPickerOpen(true)
  }

  function openProgramPicker() {
    setProgramQuery('')
    setProgramType('All')
    setProgramPickerOpen(true)
  }

  function importFundingProgram(program: FundingProgramRecord) {
    setProgramName(program.name)
    setProgramUrl(program.url)
    setAmount(program.amount.toLocaleString(locale))
    setProgramPickerOpen(false)
    setFormMessage(`${program.name} imported from Grants & Loans.`)
  }

  function importCompany(
    company: CompanyRecord,
    options?: {
      closePicker?: boolean
      message?: string
    },
  ) {
    setBusinessName(company.name)
    setFullName(company.owner)
    setBusinessIdea(company.description)
    setTeamIntro(
      `${company.owner} leads a ${company.employees || 'growing'}-person ${
        company.industry ? company.industry.toLowerCase() : 'business'
      } team in ${company.location || 'Canada'}.`,
    )
    if (options?.closePicker !== false) {
      setCompanyPickerOpen(false)
    }
    setFormMessage(options?.message ?? `${company.name} imported from My Companies.`)
  }

  function importDefaultCompanyForBusinessStep() {
    const defaultCompanyId = loadUserSettings().defaultCompanyId
    if (!defaultCompanyId) {
      return
    }

    const defaultCompany = loadCompanyRecords().find(
      (company) => company.id === defaultCompanyId,
    )
    if (!defaultCompany) {
      return
    }

    importCompany(defaultCompany, {
      closePicker: false,
      message: `${defaultCompany.name} imported from Default company.`,
    })
  }

  function saveDraft() {
    setPersistentItem(
      draftStorageKey,
      JSON.stringify({
        programName,
        programUrl,
        amount,
        useWinningTemplate,
        fileName,
        businessName,
        fullName,
        businessIdea,
        teamIntro,
      }),
    )
    setFormMessage('Draft saved securely to your workspace.')
  }

  function resumeGeneratedWorkspace() {
    if (!generatedPackage) {
      return
    }

    setWorkspaceSections(hydrateWorkspaceSections(generatedPackage))
    setWorkspaceThoughts(generatedPackage.thoughts)
    setSelectedSectionId(generatedPackage.sections[0]?.id ?? null)
    setWorkspacePhase('complete')
    setEditorMode(false)
    setActiveStep('workspace')
    setFormMessage(`Reopened ${generatedPackage.title}.`)
  }

  function continueToBusiness() {
    if (programComplete < 3) {
      setFormMessage('Add the program name, official URL, and funding amount.')
      return
    }
    setActiveStep(2)
    importDefaultCompanyForBusinessStep()
  }

  function continueToReview() {
    if (businessComplete < 4) {
      setFormMessage('Complete the company, founder, business idea, and team fields.')
      return
    }
    setFormMessage('')
    setActiveStep(3)
  }

  async function streamSection(
    currentRun: number,
    sectionId: string,
    finalBody: string,
    steps = Math.max(8, Math.min(18, Math.ceil(finalBody.length / 28))),
  ) {
    setSelectedSectionId(sectionId)
    for (let stepIndex = 1; stepIndex <= steps; stepIndex += 1) {
      if (generationRun.current !== currentRun) {
        return false
      }

      const previewLength = Math.round((finalBody.length * stepIndex) / steps)
      setWorkspaceSections((previous) =>
        previous.map((section) =>
          section.id === sectionId
            ? {
                ...section,
                status: 'working',
                progress: Math.round((stepIndex / steps) * 100),
                preview: finalBody.slice(0, previewLength),
              }
            : section,
        ),
      )
      await waitForWorkspace(stepIndex === 1 ? 180 : 90)
    }

    setWorkspaceSections((previous) =>
      previous.map((section) =>
        section.id === sectionId
          ? {
              ...section,
              status: 'complete',
              progress: 100,
              preview: finalBody,
              body: finalBody,
            }
          : section,
      ),
    )
    return true
  }

  async function generateDocuments() {
    if (isGenerating) {
      return
    }

    const fundingNeed = Number(amount.replace(/[^0-9.]/g, ''))
    if (programComplete < 3 || !Number.isFinite(fundingNeed)) {
      setFormMessage('Complete the funding program details before launching Strategic Report.')
      setActiveStep(1)
      return
    }

    if (businessComplete < 4) {
      setFormMessage('Complete the business profile before launching Strategic Report.')
      setActiveStep(2)
      return
    }

    let applicationId = currentApplicationId
    let applicationPublicId: string | undefined
    if (applicationId) {
      applicationPublicId = findApplicationRecord(loadApplications(), applicationId)?.appId
    }
    if (!applicationId) {
      const selectedProgram = findFundingProgramByName(programName)
      setFormMessage('Creating your application before starting Strategic Report...')
      try {
        const createdApplication = await createApplicationViaApi({
          programName,
          programUrl,
          provider: selectedProgram?.provider,
          location: selectedProgram?.location,
          fundingType: selectedProgram?.type ?? 'Grant',
          amount: fundingNeed,
          deadline: selectedProgram?.deadline ?? 'Open',
          deadlineOrder: selectedProgram
            ? selectedProgram.deadline === 'Rolling intake' || selectedProgram.deadline === 'Open'
              ? 999
              : 0
            : 999,
          company: businessName,
          founderName: fullName,
          businessSummary: businessIdea,
          teamBackground: teamIntro,
          language: locale,
        })
        const createdRecord: ApplicationRecord = {
          id: createdApplication.id,
          appId: createdApplication.appId,
          title: createdApplication.title,
          programName: createdApplication.programName,
          programUrl: createdApplication.programUrl,
          company: createdApplication.company,
          fundingType: createdApplication.fundingType,
          amount: createdApplication.amount,
          status: 'Draft',
          progress: 0,
          deadline: createdApplication.deadline,
          deadlineOrder: createdApplication.deadlineOrder,
          owner: createdApplication.owner,
          updatedAt: 'Created just now',
          documentsComplete: 0,
          documentsTotal: Math.max(1, advisoryHubSections.length),
          nextAction: 'Complete the strategic report',
          note: 'Created from Quick Build.',
          strategicReviewReports: [],
        }
        const applications = loadApplications().filter(
          (application) => application.id !== createdRecord.id,
        )
        saveApplications([createdRecord, ...applications])
        applicationId = createdRecord.id
        applicationPublicId = createdRecord.appId
        setCurrentApplicationId(applicationId)
      } catch (error) {
        const detail = error instanceof Error ? error.message : 'Unknown application error.'
        setFormMessage(`Application could not be created: ${detail}`)
        return
      }
    }

    removePersistentItem(draftStorageKey)
    setFormMessage(`Application ${applicationId} created. Opening Strategic Reports...`)
    navigate(
      getStrategicReportsPathForApplication({
        id: applicationId,
        appId: applicationPublicId,
      }),
    )
    return

  }

  function cancelGeneration() {
    generationRun.current += 1
    if (generatedPackage) {
      setWorkspaceSections(hydrateWorkspaceSections(generatedPackage))
      setWorkspaceThoughts(generatedPackage.thoughts)
      setSelectedSectionId(generatedPackage.sections[0]?.id ?? null)
      setWorkspacePhase('complete')
      setFormMessage('Generation cancelled. Your last completed package is still available.')
      return
    }

    setWorkspacePhase('idle')
    setWorkspaceSections([])
    setWorkspaceThoughts([])
    setSelectedSectionId(null)
    setActiveStep(3)
    setFormMessage('Generation cancelled. Your inputs are still available.')
  }

  function openFinancialForecast() {
    if (!generatedPackage?.financialForecast) {
      setFormMessage('This Strategic Report does not contain a financial forecast yet.')
      return
    }

    setSelectedSectionId('financial-model')
    setEditorMode(false)
    window.setTimeout(
      () =>
        document
          .getElementById('financial-forecast-panel')
          ?.scrollIntoView({ behavior: 'smooth', block: 'start' }),
      0,
    )
  }

  function openEditor() {
    setActiveStep('workspace')
    setEditorMode(true)
    setSelectedSectionId(previewSection?.id ?? workspaceSections[0]?.id ?? null)
    window.setTimeout(
      () =>
        document
          .getElementById('quick-preview-panel')
          ?.scrollIntoView({ behavior: 'smooth', block: 'start' }),
      0,
    )
  }

  function updatePreviewSection(nextBody: string) {
    if (!previewSection) {
      return
    }

    const updatedSections = workspaceSections.map((section) =>
      section.id === previewSection.id
        ? {
            ...section,
            body: nextBody,
            preview: nextBody,
            progress: 100,
            status: 'complete' as const,
          }
        : section,
    )
    setWorkspaceSections(updatedSections)

    if (!generatedPackage) {
      return
    }

    const nextPackage = {
      ...generatedPackage,
      sections: updatedSections.map(({ status: _status, progress: _progress, preview, ...section }) => ({
        ...section,
        body: preview || section.body,
      })),
    }
    persistGeneratedPackage(nextPackage)
  }

  async function regenerateSection(sectionId: string) {
    const targetSection = workspaceSections.find((section) => section.id === sectionId)
    if (!targetSection || isGenerating) {
      return
    }

    const currentRun = generationRun.current + 1
    generationRun.current = currentRun
    const regeneratedBody = createSectionVariant(
      targetSection,
      summaryProgram,
      summaryBusiness === 'Not entered' ? businessName || 'your company' : summaryBusiness,
    )

    setActiveStep('workspace')
    setEditorMode(false)
    setWorkspacePhase('generating')
    setWorkspaceThoughts((previous) => [
      ...previous,
      `Regenerating ${targetSection.title.toLowerCase()} with sharper reviewer language.`,
    ])
    setWorkspaceSections((previous) =>
      previous.map((section) =>
        section.id === sectionId
          ? { ...section, status: 'working', progress: 8, preview: '' }
          : section,
      ),
    )

    const completed = await streamSection(currentRun, sectionId, regeneratedBody, 10)
    if (!completed) {
      return
    }

    setWorkspacePhase(generatedPackage ? 'complete' : 'idle')
    setWorkspaceThoughts((previous) => [
      ...previous,
      `${targetSection.title} regenerated and synced back into the package editor.`,
    ])

    if (!generatedPackage) {
      return
    }

    const nextSections = workspaceSections.map((section) =>
      section.id === sectionId
        ? {
            ...section,
            body: regeneratedBody,
            preview: regeneratedBody,
            status: 'complete' as const,
            progress: 100,
          }
        : section,
    )
    setWorkspaceSections(nextSections)
    const nextPackage = {
      ...generatedPackage,
      sections: nextSections.map(({ status: _status, progress: _progress, preview, ...section }) => ({
        ...section,
        body: preview || section.body,
      })),
    }
    persistGeneratedPackage(nextPackage)
  }

  function workspaceExportInput() {
    if (!generatedPackage) {
      return null
    }

    const sections = workspaceSections.map(({ status: _status, progress: _progress, preview, ...section }) => ({
      ...section,
      body: preview || section.body,
    }))
    return createReportExportInput(generatedPackage, sections)
  }

  async function downloadDocxExport() {
    const input = workspaceExportInput()
    if (!input) {
      setFormMessage('Generate the package first, then export it.')
      return
    }

    await downloadStrategicReportDocx(input)
    setFormMessage('DOCX export downloaded.')
  }

  async function downloadPdfExport() {
    const input = workspaceExportInput()
    if (!input) {
      setFormMessage('Generate the package first, then export it.')
      return
    }

    await downloadStrategicReportPdf(input)
    setFormMessage('PDF export downloaded.')
  }

  async function downloadExcelExport() {
    const input = workspaceExportInput()
    if (!input) {
      setFormMessage('Generate the package first, then export it.')
      return
    }

    await downloadStrategicReportXlsx(input)
    setFormMessage('Excel export downloaded.')
  }

  async function shareWorkspace() {
    const shareUrl = `${window.location.origin}/quick-build`
    try {
      await window.navigator.clipboard.writeText(shareUrl)
      setFormMessage('Workspace link copied to the clipboard.')
    } catch {
      setFormMessage(`Copy this workspace link: ${shareUrl}`)
    }
  }

  return (
    <section className="generator-page">
      <header className={`generator-header ${showsStrategicReviewListing ? 'is-report-listing' : 'is-quick-build'}`}>
        <div>
          {showsStrategicReviewListing ? (
            <p className="generator-eyebrow">{t('quickBuild.advisoryHub')}</p>
          ) : null}
          <h1>
            {showsStrategicReviewListing
              ? t('quickBuild.reportsTitle')
              : t('navigation.items.quickBuild')}
          </h1>
          <p>
            {showsStrategicReviewListing
              ? t('quickBuild.reportsDescription')
              : t('quickBuild.subtitle')}
          </p>
        </div>
        {showsStrategicReviewListing ? (
          <Link to="/quick-build" className="generator-save-button">
            <Glyph type="spark" />
            {t('quickBuild.generate')}
          </Link>
        ) : (
          <button type="button" className="generator-save-button" onClick={saveDraft}>
            <Glyph type="file" />
            {t('quickBuild.saveDraft')}
          </button>
        )}
      </header>

      {formMessage ? (
        <p
          className={`generator-message ${
            formMessage.includes('Complete') || formMessage.includes('Add')
              ? 'is-warning'
              : ''
          }`}
          role="status"
        >
          {formMessage}
        </p>
      ) : null}

      <div
        className={`generator-shell ${activeStep === 'workspace' ? 'is-workspace' : ''} ${
          showsStrategicReviewListing ? 'is-report-listing' : ''
        } is-sidebar-hidden`}
      >
        <div className={`generator-workspace ${activeStep === 'workspace' ? 'is-ai-workspace' : ''}`}>
          {showsStrategicReviewListing ? (
            <section className="generator-stage advisory-report-listing-stage">
              <div className="advisory-report-listing-heading">
                <div>
                  <span>{t('quickBuild.reportsTitle')}</span>
                  <h2>{t('quickBuild.chooseReport')}</h2>
                  <p>
                    {t('quickBuild.reportsDescription')}
                  </p>
                </div>
                <div className="advisory-report-listing-stats">
                  <article>
                    <small>{t('quickBuild.reports')}</small>
                    <strong>{strategicReviewReports.length}</strong>
                  </article>
                  <article>
                    <small>{t('quickBuild.applications')}</small>
                    <strong>{strategicReviewApplicationCount}</strong>
                  </article>

                </div>
              </div>

              {strategicReviewReports.length > 0 ? (
                <div className="advisory-report-list">
                  {strategicReviewReports.map((report) => {
                    const application = findApplicationRecord(loadApplications(), report.applicationId)
                    return (
                      <button
                        key={report.id}
                        type="button"
                        className="advisory-report-row"
                        onClick={() => openStrategicReviewReport(report)}
                      >
                        <span className="advisory-report-symbol">
                          <Glyph type="spark" />
                        </span>
                        <span className="advisory-report-main">
                          <span className="advisory-report-label">{t('quickBuild.strategicReport')}</span>
                          <strong>{report.generatedPackage.programName}</strong>
                          <small>app_id {application?.appId ?? report.applicationId}</small>
                          <small>{report.generatedPackage.businessName}</small>
                        </span>
                        <span className="advisory-report-score">
                          <strong>{report.generatedPackage.readinessScore}%</strong>
                          <small>{t('quickBuild.readiness')}</small>
                        </span>
                        <span className="advisory-report-date">
                          <strong>
                            {new Intl.DateTimeFormat(locale, {
                              month: 'short',
                              day: 'numeric',
                              year: 'numeric',
                            }).format(new Date(report.generatedPackage.completedAt))}
                          </strong>
                          <small>{t('common.completed')}</small>
                        </span>
                        <span className="advisory-report-open">
                          {t('quickBuild.openReport')}
                          <Glyph type="arrow" />
                        </span>
                      </button>
                    )
                  })}
                </div>
              ) : (
                <div className="advisory-report-empty">
                  <span><Glyph type="spark" /></span>
                  <strong>{t('quickBuild.noReports')}</strong>
                  <p>{t('quickBuild.noReportsDescription')}</p>
                  <Link to="/quick-build">{t('quickBuild.generateNewReport')}</Link>
                </div>
              )}
            </section>
          ) : null}

          {activeStep === 1 ? (
            <section className="generator-stage">
              <div className="generator-stage-heading generator-stage-heading-row">
                <div>
                  <span>{t('quickBuild.stepOne')} · {t('workspacePages.quickBuild.aboutMinutes')}</span>
                  <h2>{t('workspacePages.quickBuild.opportunityQuestion')}</h2>
                  <p>{t('workspacePages.quickBuild.opportunityDescription')}</p>
                </div>
                <button type="button" onClick={openProgramPicker}>
                  <Glyph type="search" />
                  {t('quickBuild.importPrograms')}
                </button>
              </div>

              <div className="generator-stage-ribbon">
                {stageSupportCards.map((item) => (
                  <article key={item.point}>
                    <span className="generator-stage-ribbon-icon">
                      <Glyph type={item.icon} />
                    </span>
                    <span>{item.point}</span>
                  </article>
                ))}
              </div>

              <div className="generator-stage-panel">
                <div className="generator-stage-panel-copy">
                  <span>{t('quickBuild.opportunityBrief')}</span>
                  <h3>{t('quickBuild.sourceOfTruth')}</h3>
                  <p>
                    {t('workspacePages.quickBuild.sourceTruthDescription')}
                  </p>
                </div>
                <div className="generator-stage-panel-form">
                  <div className="generator-form-grid">
                    <label className="generator-field generator-field-wide">
                      <span>{t('quickBuild.programName')} <b>{t('common.required')}</b></span>
                      <input
                        value={programName}
                        onChange={(event) => setProgramName(event.target.value)}
                        placeholder="e.g. FedDev Ontario Growth Program"
                      />
                    </label>
                    <label className="generator-field">
                      <span>{t('quickBuild.officialUrl')} <b>{t('common.required')}</b></span>
                      <input
                        type="url"
                        value={programUrl}
                        onChange={(event) => setProgramUrl(event.target.value)}
                        placeholder="https://example.ca/program"
                      />
                    </label>
                    <label className="generator-field">
                      <span>{t('quickBuild.targetAmount')} <b>{t('common.required')}</b></span>
                      <div className="generator-money-field">
                        <i>$</i>
                        <input
                          inputMode="decimal"
                          value={amount}
                          onChange={(event) => setAmount(event.target.value)}
                          placeholder="250,000"
                        />
                        <em>CAD</em>
                      </div>
                    </label>
                  </div>

                  <div className="generator-source-row">
                    <label className="generator-upload">
                      <input
                        type="file"
                        accept=".pdf,.jpg,.jpeg,.png,.docx,.xlsx"
                        onChange={(event) => setFileName(event.target.files?.[0]?.name ?? '')}
                      />
                      <span className="generator-upload-icon">
                        <Glyph type="file" />
                      </span>
                      <span>
                        <strong>{fileName || t('quickBuild.addFiles')}</strong>
                        <small>{t('workspacePages.quickBuild.pdfDocxXlsx')} · {t('workspacePages.quickBuild.optional')}</small>
                      </span>
                      <b>{fileName ? t('quickBuild.replace') : t('quickBuild.browse')}</b>
                    </label>
                    <label className="generator-template-toggle">
                      <input
                        type="checkbox"
                        checked={useWinningTemplate}
                        onChange={(event) =>
                          updateUseWinningTemplatePreference(
                            event.target.checked,
                          )
                        }
                      />
                      <span />
                      <div>
                        <strong>{t('quickBuild.useStructure', { platform: platformName })}</strong>
                        <small>{t('workspacePages.quickBuild.recommendedNoTemplate')}</small>
                      </div>
                    </label>
                  </div>
                </div>
              </div>

              <div className="generator-stage-actions">
                <button type="button" className="is-quiet" onClick={resetProgram}>
                  {t('quickBuild.clear')}
                </button>
                <button type="button" className="is-primary" onClick={continueToBusiness}>
                  {t('quickBuild.continueBusiness')}
                  <Glyph type="arrow" />
                </button>
              </div>
            </section>
          ) : null}

          {activeStep === 2 ? (
            <section className="generator-stage">
              <div className="generator-stage-heading generator-stage-heading-row">
                <div>
                  <span>{t('quickBuild.stepTwo')} · {t('workspacePages.quickBuild.aboutFiveMinutes')}</span>
                  <h2>{t('workspacePages.quickBuild.businessQuestion')}</h2>
                  <p>{t('workspacePages.quickBuild.businessDescription')}</p>
                </div>
                <button type="button" onClick={openCompanyPicker}>
                  <Glyph type="grid" />
                  {t('quickBuild.importCompany')}
                </button>
              </div>

              <div className="generator-stage-ribbon">
                {stageSupportCards.map((item) => (
                  <article key={item.point}>
                    <span className="generator-stage-ribbon-icon">
                      <Glyph type={item.icon} />
                    </span>
                    <span>{item.point}</span>
                  </article>
                ))}
              </div>

              <div className="generator-stage-panel is-business">
                <div className="generator-stage-panel-copy">
                  <span>{t('quickBuild.businessNarrative')}</span>
                  <h3>{t('quickBuild.fundableStory')}</h3>
                  <p>
                    {t('workspacePages.quickBuild.businessDescription')}
                  </p>
                </div>
                <div className="generator-stage-panel-form">
                  <div className="generator-form-grid">
                    <label className="generator-field">
                      <span>{t('quickBuild.businessName')} <b>{t('common.required')}</b></span>
                      <input
                        value={businessName}
                        onChange={(event) => setBusinessName(event.target.value)}
                        placeholder="ABC Inc."
                      />
                    </label>
                    <label className="generator-field">
                      <span>{t('quickBuild.leadApplicant')} <b>{t('common.required')}</b></span>
                      <input
                        value={fullName}
                        onChange={(event) => setFullName(event.target.value)}
                        placeholder="John Joe"
                      />
                    </label>
                    <label className="generator-field generator-field-wide">
                      <span>{t('quickBuild.businessIdea')} <b>{t('common.required')}</b></span>
                      <textarea
                        value={businessIdea}
                        onChange={(event) => setBusinessIdea(event.target.value)}
                        placeholder="What problem do you solve, for whom, and how does the business make money?"
                      />
                      <small>{businessIdea.length} characters</small>
                    </label>
                    <label className="generator-field generator-field-wide">
                      <span>{t('quickBuild.teamExperience')} <b>{t('common.required')}</b></span>
                      <textarea
                        value={teamIntro}
                        onChange={(event) => setTeamIntro(event.target.value)}
                        placeholder="Describe the founders, relevant experience, and key responsibilities."
                      />
                      <small>{teamIntro.length} characters</small>
                    </label>
                  </div>
                </div>
              </div>

              <div className="generator-stage-actions">
                <button type="button" className="is-quiet" onClick={resetBusiness}>
                  {t('quickBuild.clear')}
                </button>
                <button type="button" className="is-secondary" onClick={() => setActiveStep(1)}>
                  {t('quickBuild.back')}
                </button>
                <button type="button" className="is-primary" onClick={continueToReview}>
                  {t('quickBuild.reviewPackage')}
                  <Glyph type="arrow" />
                </button>
              </div>
            </section>
          ) : null}

          {activeStep === 3 ? (
            <section className="generator-stage generator-review-stage">
              <div className="generator-stage-heading">
                <span>{t('quickBuild.stepThree')}</span>
                <h2>{t('quickBuild.reviewTitle')}</h2>
                <p>
                  {t('workspacePages.quickBuild.reviewDetails')}
                </p>
              </div>

              <div className="generator-stage-ribbon">
                {stageSupportCards.map((item) => (
                  <article key={item.point}>
                    <span className="generator-stage-ribbon-icon">
                      <Glyph type={item.icon} />
                    </span>
                    <span>{item.point}</span>
                  </article>
                ))}
              </div>

              <div className="generator-review-grid">
                <article className="generator-review-panel">
                  <header>
                    <div>
                      <span>{t('quickBuild.stepOne')}</span>
                      <h3>{t('quickBuild.fundingProgram')}</h3>
                    </div>
                    <button type="button" onClick={() => setActiveStep(1)}>
                      {t('quickBuild.edit')}
                    </button>
                  </header>
                  <dl className="generator-review-list">
                    <div>
                      <dt>{t('quickBuild.programName')}</dt>
                      <dd>{programName || 'Not entered'}</dd>
                    </div>
                    <div>
                      <dt>{t('quickBuild.officialUrl')}</dt>
                      <dd>{programUrl || 'Not entered'}</dd>
                    </div>
                    <div>
                      <dt>{t('quickBuild.targetAmount')}</dt>
                      <dd>{amount ? `$${amount} CAD` : 'Not entered'}</dd>
                    </div>
                    <div>
                      <dt>{t('quickBuild.sourceFiles')}</dt>
                      <dd>{fileName || 'None uploaded'}</dd>
                    </div>
                    <div>
                      <dt>{t('quickBuild.structure')}</dt>
                      <dd>{useWinningTemplate ? `${platformName} structure enabled` : 'Official source only'}</dd>
                    </div>
                  </dl>
                </article>

                <article className="generator-review-panel">
                  <header>
                    <div>
                      <span>{t('quickBuild.stepTwo')}</span>
                      <h3>{t('quickBuild.businessProfile')}</h3>
                    </div>
                    <button type="button" onClick={() => setActiveStep(2)}>
                      {t('quickBuild.edit')}
                    </button>
                  </header>
                  <dl className="generator-review-list">
                    <div>
                      <dt>{t('quickBuild.businessName')}</dt>
                      <dd>{businessName || 'Not entered'}</dd>
                    </div>
                    <div>
                      <dt>{t('quickBuild.leadApplicant')}</dt>
                      <dd>{fullName || 'Not entered'}</dd>
                    </div>
                    <div>
                      <dt>{t('quickBuild.businessIdea')}</dt>
                      <dd className="is-multiline">{businessIdea || 'Not entered'}</dd>
                    </div>
                    <div>
                      <dt>{t('quickBuild.teamExperience')}</dt>
                      <dd className="is-multiline">{teamIntro || 'Not entered'}</dd>
                    </div>
                  </dl>
                </article>
              </div>

              <div className="generator-review-callout is-final-review">
                <Glyph type="spark" />
                <div>
                  <strong>{t('quickBuild.finalCheck')}</strong>
                  <p>
                    The AI package will use these details to shape the opportunity fit,
                    business plan, financial logic, and funding narrative.
                  </p>
                </div>
              </div>

              {generatedPackage ? (
                <div className="generator-review-callout">
                  <Glyph type="grid" />
                  <div>
                    <strong>Last generated package is ready to reopen</strong>
                    <p>
                      {generatedPackage.title} was restored from this workspace. You can
                      keep editing the three-step brief, or reopen the finished package
                      when you need exports, edits, or sharing.
                    </p>
                  </div>
                  <button type="button" className="generator-inline-action" onClick={resumeGeneratedWorkspace}>
                    {t('quickBuild.resume')}
                  </button>
                </div>
              ) : null}

              <div className="generator-stage-actions">
                <button type="button" className="is-secondary" onClick={() => setActiveStep(2)}>
                  {t('quickBuild.back')}
                </button>
                <button
                  type="button"
                  className="is-primary is-generate"
                  onClick={generateDocuments}
                  disabled={isGenerating}
                >
                  <Glyph type="spark" />
                  Start
                </button>
              </div>
            </section>
          ) : null}

          {activeStep === 'workspace' && !showsStrategicReviewListing ? (
            <section className="generator-stage generator-ai-stage">
              {initialView === 'workspace' ? (
                <button
                  type="button"
                  className="advisory-report-back"
                  onClick={returnToStrategicReviewReports}
                >
                  <Glyph type="arrow" />
                  {t('advisory.backToReports')}
                </button>
              ) : null}
              <div className="generator-ai-hero">
                <div className="generator-ai-hero-copy">
                  <span>{t('advisory.advisoryMode')}</span>
                  <h2>{t('advisory.title')}</h2>
                  <p>
                    The platform behaves like an AI funding team: it analyzes the
                    opportunity, plans the structure, generates each section live, and
                    leaves the founder with an editable package.
                  </p>
                  <div className="generator-ai-phase-strip">
                    {workspaceStagePills.map((item) => (
                      <span key={item.label} className={`is-${item.status}`}>
                        {item.label}
                      </span>
                    ))}
                  </div>
                  {selectedStrategicReviewReportId ? (
                    <div className="generator-strategic-report-id">
                      <span>{t('quickBuild.strategicReportId')}</span>
                      <code>{selectedStrategicReviewReportId}</code>
                    </div>
                  ) : null}
                </div>
                <div className="generator-ai-status">
                  <div className="generator-ai-status-heading">
                    <small>{summaryProgram}</small>
                    <strong>
                      {workspacePhase === 'complete'
                        ? t('advisory.ready')
                        : workspacePhase === 'analyzing'
                          ? 'Analyzing opportunity'
                          : workspacePhase === 'planning'
                            ? 'Building funding strategy'
                            : workspacePhase === 'reviewing'
                              ? 'Running AI review'
                              : previewSection
                                ? `Generating ${previewSection.title}`
                                : 'Waiting to start'}
                    </strong>
                    <span>{workspaceProgress}% complete</span>
                  </div>
                  <div className="generator-ai-status-metrics">
                    {workspaceSignalCards.map((item) => (
                      <article key={item.label}>
                        <small>{item.label}</small>
                        <strong>{item.value}</strong>
                        <span>{item.helper}</span>
                      </article>
                    ))}
                  </div>
                </div>
              </div>

              <div className="generator-ai-grid">
                <div className="generator-ai-column">
                  <article className="generator-ai-card">
                    <header>
                      <div>
                        <span>Analyze</span>
                        <h3>Opportunity understanding</h3>
                      </div>
                      <b className={quickBuildPhaseRank[workspacePhase] >= 2 ? 'is-complete' : ''}>
                        {quickBuildPhaseRank[workspacePhase] >= 2 ? 'Done' : 'Live'}
                      </b>
                    </header>
                    <ul className="generator-ai-checklist">
                      {analyzeChecklist.map((item) => (
                        <li
                          key={item}
                          className={
                            quickBuildPhaseRank[workspacePhase] >= 2
                              ? 'is-complete'
                              : workspacePhase === 'analyzing'
                                ? 'is-working'
                                : ''
                          }
                        >
                          <i>
                            {quickBuildPhaseRank[workspacePhase] >= 2
                              ? '✓'
                              : workspacePhase === 'analyzing'
                                ? '•'
                                : '○'}
                          </i>
                          {item}
                        </li>
                      ))}
                    </ul>
                  </article>

                  <article className="generator-ai-card">
                    <header>
                      <div>
                        <span>Planning</span>
                        <h3>Document structure</h3>
                      </div>
                      <b className={quickBuildPhaseRank[workspacePhase] >= 3 ? 'is-complete' : ''}>
                        {quickBuildPhaseRank[workspacePhase] >= 3 ? 'Planned' : 'Queued'}
                      </b>
                    </header>
                    <ul className="generator-ai-checklist">
                      {planningChecklist.map((item) => (
                        <li
                          key={item}
                          className={
                            quickBuildPhaseRank[workspacePhase] >= 3
                              ? 'is-complete'
                              : workspacePhase === 'planning'
                                ? 'is-working'
                                : ''
                          }
                        >
                          <i>
                            {quickBuildPhaseRank[workspacePhase] >= 3
                              ? '✓'
                              : workspacePhase === 'planning'
                                ? '•'
                                : '○'}
                          </i>
                          {item}
                        </li>
                      ))}
                    </ul>
                  </article>

                  <article className="generator-ai-card">
                    <header>
                      <div>
                        <span>{t('advisory.agents')}</span>
                        <h3>{t('advisory.consultingTeam')}</h3>
                      </div>
                    </header>
                    <div className="generator-agent-list">
                      {agentCards.map((agent) => (
                        <article key={agent.name} className={`generator-agent-card is-${agent.status}`}>
                          <div>
                            <strong>{agent.name}</strong>
                            <small>{agent.helper}</small>
                          </div>
                          <b>
                            {agent.status === 'completed'
                              ? t('advisory.completed')
                              : agent.status === 'working'
                                ? t('advisory.working')
                                : t('advisory.waiting')}
                          </b>
                        </article>
                      ))}
                    </div>
                  </article>

                  <article className="generator-ai-card">
                    <header>
                      <div>
                        <span>{t('advisory.workflow')}</span>
                        <h3>{t('advisory.systemDoing')}</h3>
                      </div>
                    </header>
                    <div className="generator-workflow-list">
                      {workflowItems.map((item) => (
                        <div key={item.label} className={`generator-workflow-item is-${item.status}`}>
                          <i>
                            {item.status === 'complete'
                              ? '✓'
                              : item.status === 'working'
                                ? '⏳'
                                : '○'}
                          </i>
                          <span>{item.label}</span>
                        </div>
                      ))}
                    </div>
                  </article>

                </div>

                <div className="generator-ai-column">
                  <article className="generator-ai-card">
                    <header>
                      <div>
                        <span>{t('advisory.sectionGeneration')}</span>
                        <h3>{t('advisory.multipleSections')}</h3>
                      </div>
                    </header>
                    <div className="generator-stream-list">
                      {workspaceSections.map((section) => (
                        <article
                          key={section.id}
                          className={`generator-stream-item ${
                            previewSection?.id === section.id ? 'is-selected' : ''
                          }`}
                        >
                          <button
                            type="button"
                            className="generator-stream-meta"
                            onClick={() => {
                              setSelectedSectionId(section.id)
                              setEditorMode(false)
                            }}
                          >
                            <div>
                              <small>{section.documentLabel}</small>
                              <strong>{section.title}</strong>
                            </div>
                            <b>
                              {section.status === 'complete'
                                ? t('common.done')
                                : section.status === 'working'
                                  ? t('advisory.writing')
                                  : t('advisory.waiting')}
                            </b>
                          </button>
                          <div className="generator-stream-bar">
                            <span style={{ width: `${section.progress}%` }} />
                          </div>
                          {section.status === 'complete' ? (
                            <button
                              type="button"
                              className="generator-stream-regenerate"
                              onClick={() => regenerateSection(section.id)}
                            >
                              {t('advisory.regenerateSection')}
                            </button>
                          ) : null}
                        </article>
                      ))}
                    </div>
                  </article>

                  <article className="generator-ai-card generator-thoughts-card">
                    <header>
                      <div>
                        <span>{t('advisory.thoughtStream')}</span>
                        <h3>{t('advisory.narration')}</h3>
                      </div>
                    </header>
                    <div className="generator-thought-list">
                      {[...workspaceThoughts].reverse().map((thought, index) => (
                        <p key={`${thought}-${index}`}>{thought}</p>
                      ))}
                    </div>
                  </article>

                  <article className="generator-ai-preview" id="quick-preview-panel">
                    <div className="generator-ai-preview-header">
                      <div>
                        <span>{t('advisory.livePreview')}</span>
                        <h3>{previewSection?.title ?? 'Waiting for section data'}</h3>
                        <p>
                          {previewSection
                            ? `${previewSection.documentLabel} · ${previewSection.agent}`
                            : 'The live editor will appear as soon as the first section starts generating.'}
                        </p>
                      </div>
                      <div className="generator-ai-preview-actions">
                        {workspacePhase === 'complete' && previewSection ? (
                          <button type="button" onClick={openEditor}>
                            {editorMode ? 'Editing section' : 'Edit section'}
                          </button>
                        ) : null}
                        {isGenerating ? (
                          <button type="button" onClick={cancelGeneration}>
                            Cancel
                          </button>
                        ) : null}
                      </div>
                    </div>

                    {previewSection ? (
                      editorMode && workspacePhase === 'complete' ? (
                        <label className="generator-editor-field">
                          <span>Editable section body</span>
                          <textarea
                            value={previewSection.preview || previewSection.body}
                            onChange={(event) => updatePreviewSection(event.target.value)}
                          />
                        </label>
                      ) : (
                        <div className="generator-ai-preview-body">
                          <p>{previewSection.preview || previewSection.body}</p>
                        </div>
                      )
                    ) : (
                      <div className="generator-ai-preview-body is-empty">
                        <p>Launch Strategic Report to begin streaming the funding package.</p>
                      </div>
                    )}

                    {workspacePhase === 'complete' && generatedPackage ? (
                      <div className="generator-ai-ready">
                        <div className="generator-ai-ready-heading">
                          <div>
                            <span>Funding Package Ready</span>
                            <h3>{generatedPackage.title}</h3>
                          </div>
                          <b>{generatedPackage.readinessScore}% ready</b>
                        </div>
                        <div className="generator-ai-ready-grid">
                          {advisoryHubSections.map((section) => (
                            <div key={section.id}>
                              <i>✓</i>
                              <span>{section.title}</span>
                            </div>
                          ))}
                        </div>
                        <div className="generator-ai-ready-actions">
                          {generatedPackage.financialForecast ? (
                            <button type="button" onClick={openFinancialForecast}>
                              View Financial Forecast
                            </button>
                          ) : null}
                          <button type="button" onClick={openEditor}>
                            Open Editor
                          </button>
                          <button type="button" onClick={() => void downloadDocxExport()}>
                            Download DOCX
                          </button>
                          <button type="button" onClick={() => void downloadPdfExport()}>
                            Download PDF
                          </button>
                          {generatedPackage.financialForecast ? (
                            <button type="button" onClick={() => void downloadExcelExport()}>
                              Download Excel
                            </button>
                          ) : null}
                          <button type="button" onClick={shareWorkspace}>
                            Share Workspace
                          </button>
                        </div>
                      </div>
                    ) : null}
                  </article>

                </div>

                {generatedPackage?.financialForecast ? (
                  <FinancialForecastTable forecast={generatedPackage.financialForecast} />
                ) : null}
              </div>
            </section>
          ) : null}
        </div>

      </div>

      {programPickerOpen ? (
        <div
          className="company-picker-backdrop"
          role="presentation"
          onMouseDown={() => setProgramPickerOpen(false)}
        >
          <section
            className="company-picker funding-program-picker"
            role="dialog"
            aria-modal="true"
            aria-labelledby="program-picker-title"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <header>
              <div>
                <p className="workspace-eyebrow">Grants &amp; Loans</p>
                <h2 id="program-picker-title">Choose a funding program</h2>
                <p>Import an opportunity and continue with its official details.</p>
              </div>
              <button
                type="button"
                aria-label="Close funding program picker"
                onClick={() => setProgramPickerOpen(false)}
              >
                <Glyph type="close" />
              </button>
            </header>

            <div className="funding-program-picker-tools">
              <label className="company-picker-search">
                <Glyph type="search" />
                <input
                  type="search"
                  value={programQuery}
                  onChange={(event) => setProgramQuery(event.target.value)}
                  placeholder="Search program, provider, or location"
                  autoFocus
                />
              </label>
              <div>
                {(['All', 'Grant', 'Loan'] as const).map((type) => (
                  <button
                    key={type}
                    type="button"
                    className={programType === type ? 'is-selected' : ''}
                    onClick={() => setProgramType(type)}
                  >
                    {type}
                  </button>
                ))}
              </div>
            </div>

            <div className="company-picker-list funding-program-picker-list">
              {visibleFundingPrograms.map((program) => (
                <button
                  key={program.id}
                  type="button"
                  className="funding-program-option"
                  onClick={() => importFundingProgram(program)}
                >
                  <span className={`funding-program-type type-${program.type.toLowerCase()}`}>
                    {program.type.charAt(0)}
                  </span>
                  <span className="company-picker-copy">
                    <strong>{program.name}</strong>
                    <small>{program.provider} · {program.location}</small>
                    <em>
                      {program.type} · Deadline: {program.deadline} ·{' '}
                      {program.sourceName ?? `${platformName} catalog`}
                    </em>
                  </span>
                  <span className="funding-program-amount">
                    <b>${program.amount.toLocaleString(locale)}</b>
                    <small>Maximum</small>
                  </span>
                  <span className="company-picker-score">
                    <b>{program.match}%</b>
                    <small>Match</small>
                  </span>
                  <span className="company-picker-select">
                    Select <Glyph type="arrow" />
                  </span>
                </button>
              ))}
            </div>

            {visibleFundingPrograms.length === 0 ? (
              <div className="company-picker-empty">
                <strong>No matching programs</strong>
                <p>Try another search term or switch the funding type.</p>
              </div>
            ) : null}

            <footer>
              <span>{fundingProgramCatalog.length} opportunities available</span>
              <Link to="/grants-loans">
                Browse Grants &amp; Loans <Glyph type="arrow" />
              </Link>
            </footer>
          </section>
        </div>
      ) : null}

      {companyPickerOpen ? (
        <div
          className="company-picker-backdrop"
          role="presentation"
          onMouseDown={() => setCompanyPickerOpen(false)}
        >
          <section
            className="company-picker"
            role="dialog"
            aria-modal="true"
            aria-labelledby="company-picker-title"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <header>
              <div>
                <p className="workspace-eyebrow">My Companies</p>
                <h2 id="company-picker-title">Choose a company to import</h2>
                <p>Select the business profile you want to use for this funding package.</p>
              </div>
              <button
                type="button"
                aria-label="Close company picker"
                onClick={() => setCompanyPickerOpen(false)}
              >
                <Glyph type="close" />
              </button>
            </header>

            <label className="company-picker-search">
              <Glyph type="search" />
              <input
                type="search"
                value={companyQuery}
                onChange={(event) => setCompanyQuery(event.target.value)}
                placeholder="Search company, industry, or owner"
                autoFocus
              />
            </label>

            <div className="company-picker-list">
              {visibleCompanyOptions.map((company) => (
                <button
                  key={company.id}
                  type="button"
                  className="company-picker-option"
                  onClick={() => importCompany(company)}
                >
                  <span className={`company-picker-logo ${company.logo ? 'has-logo' : ''}`}>
                    {company.logo ? <img src={company.logo} alt="" /> : company.name.charAt(0)}
                  </span>
                  <span className="company-picker-copy">
                    <strong>{company.name}</strong>
                    <small>
                      {company.industry} · {company.location}
                    </small>
                    <em>{company.owner}</em>
                  </span>
                  <span className="company-picker-score">
                    <b>{company.readiness}%</b>
                    <small>Ready</small>
                  </span>
                  <span className="company-picker-select">
                    Select <Glyph type="arrow" />
                  </span>
                </button>
              ))}
            </div>

            {visibleCompanyOptions.length === 0 ? (
              <div className="company-picker-empty">
                <strong>No matching companies</strong>
                <p>Try another search term or add a company to your portfolio.</p>
              </div>
            ) : null}

            <footer>
              <span>{companyOptions.length} companies available</span>
              <Link to="/my-companies">
                Manage My Companies <Glyph type="arrow" />
              </Link>
            </footer>
          </section>
        </div>
      ) : null}

    </section>
  )
}

function formatDashboardDate(date: Date = new Date(), locale = 'en-CA') {
  return new Intl.DateTimeFormat(locale, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  }).format(date)
}

function getDashboardGreeting(date: Date = new Date()) {
  const hour = date.getHours()
  if (hour < 12) return 'Good morning'
  if (hour < 18) return 'Good afternoon'
  return 'Good evening'
}

function getDashboardFirstName(fullName: string | undefined) {
  return fullName?.trim().split(/\s+/)[0] ?? ''
}

function formatDashboardCurrency(value: number, compact = false) {
  return new Intl.NumberFormat('en-CA', {
    style: 'currency',
    currency: 'CAD',
    notation: compact ? 'compact' : 'standard',
    maximumFractionDigits: compact ? 1 : 0,
  }).format(Math.max(0, value))
}

function formatDashboardDeadline(
  deadline: string,
  locale: SupportedLocale = 'en-CA',
  dueLabel = 'Due',
  noDeadlineLabel = 'No deadline',
) {
  const normalized = deadline.trim()
  if (!normalized) return noDeadlineLabel

  const parsed = Date.parse(normalized)
  if (Number.isNaN(parsed)) return normalized

  return `${dueLabel} ${new Intl.DateTimeFormat(locale, {
    month: 'short',
    day: 'numeric',
  }).format(new Date(parsed))}`
}

function formatDashboardActivityTime(value: string) {
  const parsed = Date.parse(value)
  if (Number.isNaN(parsed)) {
    return value.replace(/^Updated\s+/u, '') || 'Recently'
  }

  return new Intl.DateTimeFormat('en-CA', {
    month: 'short',
    day: 'numeric',
  }).format(new Date(parsed))
}

function formatDashboardApplicationMeta(
  application: ApplicationRecord,
  locale: SupportedLocale,
  dueLabel: string,
  noDeadlineLabel: string,
) {
  const deadline = application.deadline.trim()
  const deadlineLabel = formatDashboardDeadline(deadline, locale, dueLabel, noDeadlineLabel)
  return `${formatDashboardCurrency(application.amount)} · ${deadlineLabel}`
}

function OverviewPage({ userName }: { userName?: string }) {
  const { t } = useTranslation()
  const { locale } = useLocale()
  const { config } = usePlatformConfig()
  const visibleQuickActions = quickActionRoutes.filter(
    (action) => config.modules[action.path.slice(1) as PlatformModuleId] !== false,
  )
  const firstName = getDashboardFirstName(userName)
  const applications = loadApplications()
  const companies = loadCompanyRecords()
  const settings = loadUserSettings()
  const currentCompany =
    companies.find((company) => company.id === settings.defaultCompanyId) ??
    companies[0] ??
    null
  const enabledSourceIds = config.dataSources
    .filter((source) => source.enabled)
    .map((source) => source.id)
  const fundingPrograms = loadFundingPrograms(enabledSourceIds)
  const savedProgramEntries = loadSavedProgramEntries()
  const savedProgramIds = new Set(savedProgramEntries.map((entry) => entry.programId))
  const savedPrograms = fundingPrograms.filter((program) => savedProgramIds.has(program.id))
  const reports = getStrategicReviewReports(applications)
  const activeApplications = applications.filter(
    (application) => application.status !== 'Awarded',
  )
  const applicationsNeedingAttention = activeApplications.filter(
    (application) => application.progress < 85,
  )
  const focusApplication = [...activeApplications].sort(
    (left, right) => left.deadlineOrder - right.deadlineOrder,
  )[0] ?? null
  const applicationRows = activeApplications.slice(0, 3)
  const topMatches = [...fundingPrograms]
    .sort((left, right) => right.match - left.match)
    .slice(0, 2)
  const matchedFunding = savedPrograms.reduce(
    (total, program) => total + program.amount,
    0,
  )
  const generatedDocumentCount = reports.reduce(
    (total, report) => total + report.generatedPackage.documents.length,
    0,
  )
  const discoveryProgram = fundingPrograms[0] ?? null
  const discoveryApplication = discoveryProgram && currentCompany
    ? applications.find(
        (application) =>
          application.programName === discoveryProgram.name &&
          application.company === currentCompany.name,
      ) ?? null
    : null
  const readinessScore = discoveryProgram && currentCompany
    ? calculateScoutingScores(
        discoveryProgram,
        currentCompany,
        discoveryApplication,
      ).overall
    : 0
  const readinessTarget = 80
  const readinessReached = readinessScore >= readinessTarget
  const readinessPath = discoveryProgram && currentCompany
    ? `/discovery?program_id=${encodeURIComponent(discoveryProgram.id)}&company_id=${encodeURIComponent(currentCompany.id)}`
    : '/discovery'
  const activityItems = [
    currentCompany
      ? {
          icon: 'user' as const,
          title: `${currentCompany.name} ${t('workspacePages.dashboard.profileUpdated')}`,
          time: formatDashboardActivityTime(currentCompany.updatedAt),
        }
      : null,
    reports[0]
      ? {
          icon: 'spark' as const,
          title: `${reports[0].generatedPackage.programName} ${t('workspacePages.dashboard.reportGenerated')}`,
          time: formatDashboardActivityTime(reports[0].generatedPackage.completedAt),
        }
      : null,
    applications[0]
      ? {
          icon: 'file' as const,
          title: `${applications[0].programName} ${t('workspacePages.dashboard.applicationUpdated')}`,
          time: formatDashboardActivityTime(applications[0].updatedAt),
        }
      : null,
  ].filter((item): item is NonNullable<typeof item> => item !== null)

  return (
    <section className="workspace-dashboard">
      <header className="workspace-dashboard-header">
        <div className="workspace-dashboard-heading">
          <h1>{t('workspacePages.dashboard.title')}</h1>
          <p>{t('workspacePages.dashboard.description')}</p>
        </div>
        <div className="workspace-dashboard-greeting">
          <p className="workspace-eyebrow">{formatDashboardDate(new Date(), locale)}</p>
          <strong>
            {t(`workspacePages.dashboard.${getDashboardGreeting() === 'Good morning' ? 'goodMorning' : getDashboardGreeting() === 'Good afternoon' ? 'goodAfternoon' : 'goodEvening'}`)}
            {firstName ? `, ${firstName}.` : '.'}
          </strong>
        </div>
      </header>

      <div className="dashboard-command-grid">
        <article className="dashboard-readiness-card">
          <div className="dashboard-card-topline">
            <span>{t('workspacePages.dashboard.fundingReadiness')}</span>
            <Link to={readinessPath}>{t('workspacePages.dashboard.viewAssessment')}</Link>
          </div>
          <div className="dashboard-readiness-content">
            <div className="dashboard-score-ring">
              <span><strong>{readinessScore}</strong>/100</span>
            </div>
            <div>
              <p>{readinessReached ? t('workspacePages.dashboard.applicationReady') : t('workspacePages.dashboard.almostApplicationReady')}</p>
              <h2>{readinessReached ? t('workspacePages.dashboard.storyOnTrack') : t('workspacePages.dashboard.strengthenStory')}</h2>
              <span>
                {t(
                  readinessReached
                    ? 'workspacePages.dashboard.readinessReachedDescription'
                    : 'workspacePages.dashboard.readinessMissingDescription',
                  { score: readinessTarget },
                )}
              </span>
              <Link to={readinessPath}>
                {t('workspacePages.dashboard.continueAssessment')} <Glyph type="arrow" />
              </Link>
            </div>
          </div>
        </article>

        <article className="dashboard-focus-card">
          <div className="dashboard-card-topline">
            <span>{t('workspacePages.dashboard.todaysFocus')}</span>
            <b>{applicationsNeedingAttention.length} {t('workspacePages.dashboard.actions')}</b>
          </div>
          <h2>{t('workspacePages.dashboard.nextBestMove')}</h2>
          {focusApplication ? (
            <>
              <div className="dashboard-focus-action">
                <span><Glyph type="file" /></span>
                <div>
                  <strong>{focusApplication.programName}</strong>
                  <small>{formatDashboardDeadline(focusApplication.deadline, locale, t('workspacePages.dashboard.due'), t('workspacePages.dashboard.noDeadline'))} · {focusApplication.progress}% complete</small>
                </div>
              </div>
              <div className="dashboard-focus-progress">
                <span style={{ width: `${focusApplication.progress}%` }} />
              </div>
              <Link to="/my-applications">{t('workspacePages.dashboard.openApplication')} <Glyph type="arrow" /></Link>
            </>
          ) : (
            <p className="application-board-empty">{t('workspacePages.dashboard.noActiveApplications')}</p>
          )}
        </article>
      </div>

      <div className="dashboard-metrics">
        <article>
          <span>{t('workspacePages.dashboard.matchedFunding')}</span>
          <strong>{formatDashboardCurrency(matchedFunding, true)}</strong>
          <small>{savedProgramEntries.length} {t('workspacePages.dashboard.savedPrograms')}</small>
        </article>
        <article>
          <span>{t('workspacePages.dashboard.activeApplications')}</span>
          <strong>{activeApplications.length}</strong>
          <small>{applicationsNeedingAttention.length} {t('workspacePages.dashboard.requireAttention')}</small>
        </article>
        <article>
          <span>{t('workspacePages.dashboard.savedOpportunities')}</span>
          <strong>{savedProgramEntries.length}</strong>
          <small>{savedPrograms.filter((program) => program.deadline !== 'Rolling intake').length} {t('workspacePages.dashboard.fixedDeadlines')}</small>
        </article>
        <article>
          <span>{t('workspacePages.dashboard.documentsGenerated')}</span>
          <strong>{generatedDocumentCount}</strong>
          <small>{reports.length} {t('workspacePages.dashboard.strategicReports')}</small>
        </article>
      </div>

      <div className="dashboard-content-grid">
        <section className="dashboard-panel dashboard-applications">
          <div className="dashboard-panel-header">
            <div>
              <p className="workspace-eyebrow">{t('workspacePages.dashboard.applicationPipeline')}</p>
              <h2>{t('workspacePages.dashboard.keepDeadlinesMoving')}</h2>
            </div>
            <Link to="/my-applications">{t('workspacePages.common.viewAll')}</Link>
          </div>
          <div className="dashboard-application-list">
            {applicationRows.map((application) => (
              <Link to="/my-applications" key={application.id} className="dashboard-application-row">
                <span className="dashboard-application-icon"><Glyph type="file" /></span>
                <span>
                  <strong>{application.programName}</strong>
                  <small>{formatDashboardApplicationMeta(application, locale, t('workspacePages.dashboard.due'), t('workspacePages.dashboard.noDeadline'))}</small>
                </span>
                <span className="dashboard-row-progress">
                  <b>{application.progress}%</b>
                  <i><em style={{ width: `${application.progress}%` }} /></i>
                </span>
                <Glyph type="arrow" />
              </Link>
            ))}
            {applicationRows.length === 0 ? (
              <p className="application-board-empty">No applications yet</p>
            ) : null}
          </div>
        </section>

        <section className="dashboard-panel dashboard-opportunities">
          <div className="dashboard-panel-header">
            <div>
              <p className="workspace-eyebrow">{t('workspacePages.dashboard.topMatches')}</p>
              <h2>{t('workspacePages.dashboard.recommendedFunding')}</h2>
            </div>
            <Link to="/grants-loans">{t('workspacePages.dashboard.explore')}</Link>
          </div>
          <div className="dashboard-opportunity-list">
            {topMatches.map((program) => (
              <Link to="/grants-loans" key={program.id}>
                <span className="dashboard-match">{program.match}% match</span>
                <strong>{program.name}</strong>
                <small>Up to {formatDashboardCurrency(program.amount, true)} · {program.type}</small>
                <b>{program.match >= 90 ? 'Strong fit for your growth stage' : 'Potential fit for your business'} <Glyph type="arrow" /></b>
              </Link>
            ))}
            {topMatches.length === 0 ? (
              <p className="application-board-empty">No funding matches yet</p>
            ) : null}
          </div>
        </section>
      </div>

      <div className="dashboard-lower-grid">
        <section className="dashboard-panel dashboard-quick-panel">
          <div className="dashboard-panel-header">
            <div>
              <p className="workspace-eyebrow">{t('workspacePages.dashboard.shortcuts')}</p>
              <h2>{t('workspacePages.dashboard.moveWorkForward')}</h2>
            </div>
          </div>
          <div className="dashboard-quick-links">
            {visibleQuickActions.map((action) => (
              <Link key={action.label} to={action.path}>
                <span><Glyph type={action.icon} /></span>
                <strong>{action.label}</strong>
                <Glyph type="arrow" />
              </Link>
            ))}
          </div>
        </section>

        <section className="dashboard-panel dashboard-activity-panel">
          <div className="dashboard-panel-header">
            <div>
              <p className="workspace-eyebrow">{t('workspacePages.dashboard.workspaceActivity')}</p>
              <h2>{t('workspacePages.dashboard.recentlyUpdated')}</h2>
            </div>
          </div>
          <div className="dashboard-activity-list">
            {activityItems.map((activity) => (
              <article key={`${activity.title}-${activity.time}`}>
                <span><Glyph type={activity.icon} /></span>
                <p><strong>{activity.title}</strong><small>{activity.time}</small></p>
              </article>
            ))}
            {activityItems.length === 0 ? (
              <p className="application-board-empty">{t('workspacePages.dashboard.noRecentActivity')}</p>
            ) : null}
          </div>
        </section>
      </div>
    </section>
  )
}

export function DashboardPage() {
  const { t } = useTranslation()
  const { sectionId } = useParams()
  const navigate = useNavigate()
  const [partnerOpen, setPartnerOpen] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const sidebarScrollRef = useRef<HTMLDivElement>(null)
  const workspaceControlRef = useRef<HTMLDivElement>(null)
  const [workspaceMenuOpen, setWorkspaceMenuOpen] = useState(false)
  const [workspaceCreatorOpen, setWorkspaceCreatorOpen] = useState(false)
  const [workspaceName, setWorkspaceName] = useState('')
  const [workspaceKind, setWorkspaceKind] =
    useState<WorkspaceKind>('Founder workspace')
  const [workspaces, setWorkspaces] = useState<WorkspaceRecord[]>(
    loadWorkspaceRecords,
  )
  const [activeWorkspaceId, setActiveWorkspaceId] = useState(() =>
    loadActiveWorkspaceId(workspaces),
  )
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(dashboardGroups.map((group) => [group.title, true])),
  )
  const { config } = usePlatformConfig()
  const platformName = getPlatformDisplayName(config)
  const activeWorkspace =
    workspaces.find((workspace) => workspace.id === activeWorkspaceId) ??
    workspaces[0]
  const [currentAuthUser, setCurrentAuthUser] = useState(() => getCurrentAuthUser())
  const [notificationDismissed, setNotificationDismissed] = useState(false)
  const notificationBar = config.notificationBar

  useEffect(() => {
    setNotificationDismissed(false)
  }, [notificationBar.audience, notificationBar.enabled, notificationBar.message])

  const currentItem = useMemo(() => findDashboardItem(sectionId), [sectionId])
  const visibleGroups = dashboardGroups
    .map((group) => ({
      ...group,
      items: group.items.filter(
        (item) =>
          item.id === 'dashboard' ||
          config.modules[item.id as PlatformModuleId] !== false,
      ),
    }))
    .filter((group) => group.items.length > 0)

  useEffect(() => {
    const pageName = currentItem?.label ?? 'Dashboard'
    document.title = `${pageName} | ${platformName}`
  }, [currentItem, platformName])

  useEffect(() => {
    const scrollArea = sidebarScrollRef.current
    const activeItem = scrollArea?.querySelector<HTMLElement>('.clone-nav-item.is-active')
    if (!scrollArea || !activeItem) return

    const scrollRect = scrollArea.getBoundingClientRect()
    const itemRect = activeItem.getBoundingClientRect()
    if (itemRect.top < scrollRect.top) {
      scrollArea.scrollBy({ top: itemRect.top - scrollRect.top - 8 })
    } else if (itemRect.bottom > scrollRect.bottom) {
      scrollArea.scrollBy({ top: itemRect.bottom - scrollRect.bottom + 8 })
    }
  }, [currentItem, openGroups, partnerOpen])

  useEffect(() => {
    const refreshCurrentAuthUser = () => {
      setCurrentAuthUser(getCurrentAuthUser())
    }

    window.addEventListener(authUserUpdatedEvent, refreshCurrentAuthUser)
    window.addEventListener('storage', refreshCurrentAuthUser)
    return () => {
      window.removeEventListener(authUserUpdatedEvent, refreshCurrentAuthUser)
      window.removeEventListener('storage', refreshCurrentAuthUser)
    }
  }, [])

  useEffect(() => {
    if (!workspaceMenuOpen) return

    function closeWorkspaceMenu(event: PointerEvent) {
      if (
        event.target instanceof Node &&
        !workspaceControlRef.current?.contains(event.target)
      ) {
        setWorkspaceMenuOpen(false)
        setWorkspaceCreatorOpen(false)
      }
    }

    function closeWorkspaceMenuWithKeyboard(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setWorkspaceMenuOpen(false)
        setWorkspaceCreatorOpen(false)
      }
    }

    document.addEventListener('pointerdown', closeWorkspaceMenu)
    document.addEventListener('keydown', closeWorkspaceMenuWithKeyboard)
    return () => {
      document.removeEventListener('pointerdown', closeWorkspaceMenu)
      document.removeEventListener('keydown', closeWorkspaceMenuWithKeyboard)
    }
  }, [workspaceMenuOpen])

  if (sectionId === 'my-subscriptions') {
    return <Navigate to="/settings#billing" replace />
  }

  if (sectionId && !currentItem) {
    return <Navigate to="/404" replace />
  }

  if (
    sectionId &&
    currentItem &&
    (config.modules[currentItem.id as PlatformModuleId] === false ||
      (partnerItems.some((item) => item.id === currentItem.id) &&
        !config.modules['partner-portal']))
  ) {
    return <Navigate to="/dashboard" replace />
  }

  const isOverview = !sectionId || sectionId === 'dashboard'
  const isQuickBuild = currentItem?.id === 'quick-build'
  const isStrategicReports = currentItem?.id === 'strategic-reports'
  const isDiscovery = currentItem?.id === 'discovery'
  const isMyCompanies = currentItem?.id === 'my-companies'
  const isGrantsLoans = currentItem?.id === 'grants-loans'
  const isSavedPrograms = currentItem?.id === 'funding-shortlist'
  const isMyApplications = currentItem?.id === 'my-applications'
  const isTemplates = currentItem?.id === 'templates'
  const isSocialResources = currentItem?.id === 'social-resources'
  const isTools = currentItem?.id === 'tools'
  const isSettings = currentItem?.id === 'settings'
  const showsProgramPanels = false
  const notificationUrl = getSafeNotificationUrl(notificationBar.actionUrl)
  const showNotificationBar =
    notificationBar.enabled &&
    Boolean(notificationBar.message.trim()) &&
    (notificationBar.audience === 'all' || hasAdminAccess()) &&
    !notificationDismissed

  function signOut() {
    clearAuthSession()
    revokeAdminAccess()
    window.sessionStorage.clear()
    setSidebarOpen(false)
    navigate('/login', { replace: true })
  }

  function selectWorkspace(workspaceId: string) {
    setActiveWorkspaceId(workspaceId)
    setPersistentItem(activeWorkspaceStorageKey, workspaceId)
    setWorkspaceMenuOpen(false)
    setWorkspaceCreatorOpen(false)
    setSidebarOpen(false)
  }

  function createWorkspace(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const name = workspaceName.trim()
    if (!name) return

    const workspace: WorkspaceRecord = {
      id: `workspace-${Date.now()}`,
      name,
      kind: workspaceKind,
    }
    const nextWorkspaces = [...workspaces, workspace]
    setWorkspaces(nextWorkspaces)
    setActiveWorkspaceId(workspace.id)
    setPersistentItem(
      workspaceStorageKey,
      JSON.stringify(nextWorkspaces),
    )
    setPersistentItem(activeWorkspaceStorageKey, workspace.id)
    setWorkspaceName('')
    setWorkspaceKind('Founder workspace')
    setWorkspaceCreatorOpen(false)
    setWorkspaceMenuOpen(false)
    setSidebarOpen(false)
  }

  return (
    <div className="dashboard-clone">
      <header className="clone-mobile-header">
        <Link className="clone-brand" to="/">
          <span className="clone-brand-badge">
            {config.platformLogo ? (
              <img
                src={config.platformLogo}
                alt={`${getPlatformDisplayName(config)} logo`}
              />
            ) : (
              getPlatformInitial(config)
            )}
          </span>
          <span className="clone-brand-text">{getPlatformDisplayName(config)}</span>
        </Link>
        <button
          type="button"
          aria-label={t('navigation.openNavigation')}
          onClick={() => setSidebarOpen(true)}
        >
          <Glyph type="menu" />
        </button>
      </header>

      {sidebarOpen ? (
        <button
          type="button"
          className="clone-sidebar-backdrop"
          aria-label={t('navigation.closeNavigation')}
          onClick={() => setSidebarOpen(false)}
        />
      ) : null}

      <aside className={`clone-sidebar ${sidebarOpen ? 'is-open' : ''}`}>
        <button
          type="button"
          className="clone-sidebar-close"
          aria-label="Close navigation"
          onClick={() => setSidebarOpen(false)}
        >
          <Glyph type="close" />
        </button>
        <Link className="clone-brand" to="/">
          <span className="clone-brand-badge">
            {config.platformLogo ? (
              <img
                src={config.platformLogo}
                alt={`${getPlatformDisplayName(config)} logo`}
              />
            ) : (
              getPlatformInitial(config)
            )}
          </span>
          <span className="clone-brand-text">{getPlatformDisplayName(config)}</span>
        </Link>

        <div className="clone-sidebar-context">
          <div
            className={`clone-workspace-control ${
              workspaceMenuOpen ? 'is-open' : ''
            }`}
            ref={workspaceControlRef}
          >
            <button
              type="button"
              className="clone-workspace-switcher"
              aria-expanded={workspaceMenuOpen}
              aria-haspopup="dialog"
              onClick={() => {
                setWorkspaceMenuOpen((current) => !current)
                setWorkspaceCreatorOpen(false)
              }}
            >
              <span className="clone-workspace-avatar">
                {getWorkspaceInitials(activeWorkspace?.name ?? '')}
              </span>
              <span>
                <strong>{activeWorkspace?.name ?? 'Select workspace'}</strong>
                <small>{activeWorkspace?.kind ?? 'Workspace'}</small>
              </span>
              <span className="clone-workspace-chevron">
                <Glyph type="arrow" />
              </span>
            </button>

            {workspaceMenuOpen ? (
              <div
                className="clone-workspace-menu"
                role="dialog"
              aria-label={t('navigation.workspaces')}
              >
                <header>
                  <span>{t('navigation.workspaces')}</span>
                  <b>{workspaces.length}</b>
                </header>

                <div className="clone-workspace-list">
                  {workspaces.map((workspace) => (
                    <button
                      key={workspace.id}
                      type="button"
                      className={
                        workspace.id === activeWorkspaceId ? 'is-active' : ''
                      }
                      onClick={() => selectWorkspace(workspace.id)}
                    >
                      <span>{getWorkspaceInitials(workspace.name)}</span>
                      <span>
                        <strong>{workspace.name}</strong>
                        <small>{workspace.kind}</small>
                      </span>
                      {workspace.id === activeWorkspaceId ? <b>{t('navigation.current')}</b> : null}
                    </button>
                  ))}
                </div>

                {workspaceCreatorOpen ? (
                  <form
                    className="clone-workspace-create-form"
                    onSubmit={createWorkspace}
                  >
                    <label>
                      <span>{t('navigation.workspaceName')}</span>
                      <input
                        autoFocus
                        value={workspaceName}
                        placeholder="e.g. Northstar team"
                        onChange={(event) => setWorkspaceName(event.target.value)}
                      />
                    </label>
                    <label>
                        <span>{t('navigation.workspaceType')}</span>
                      <select
                        value={workspaceKind}
                        onChange={(event) =>
                          setWorkspaceKind(event.target.value as WorkspaceKind)
                        }
                      >
                        <option value="Founder workspace">{t('navigation.founderWorkspace')}</option>
                        <option value="Partner workspace">{t('navigation.partnerWorkspace')}</option>
                        <option value="Client workspace">{t('navigation.clientWorkspace')}</option>
                      </select>
                    </label>
                    <div>
                      <button
                        type="button"
                        onClick={() => setWorkspaceCreatorOpen(false)}
                      >
                        {t('navigation.cancel')}
                      </button>
                      <button type="submit" disabled={!workspaceName.trim()}>
                        {t('navigation.create')}
                      </button>
                    </div>
                  </form>
                ) : (
                  <button
                    type="button"
                    className="clone-workspace-add"
                    onClick={() => setWorkspaceCreatorOpen(true)}
                  >
                    <span>+</span>
                    {t('navigation.createWorkspace')}
                  </button>
                )}

                <Link
                  to="/settings#workspace"
                  className="clone-workspace-settings"
                  onClick={() => {
                    setWorkspaceMenuOpen(false)
                    setSidebarOpen(false)
                  }}
                >
                  <Glyph type="settings" />
                  <span>
                    <strong>{t('navigation.workspaceSettings')}</strong>
                    <small>{t('navigation.defaultsRegionCompany')}</small>
                  </span>
                  <Glyph type="arrow" />
                </Link>
              </div>
            ) : null}
          </div>
        </div>

        <div className="clone-sidebar-scroll" ref={sidebarScrollRef}>
          {visibleGroups.map((group) => (
            <section key={group.title} className="clone-nav-group">
              <button
                type="button"
                className="clone-group-title"
                aria-expanded={openGroups[group.title]}
                onClick={() =>
                  setOpenGroups((current) => ({
                    ...current,
                    [group.title]: !current[group.title],
                  }))
                }
              >
                  <span>{
                    navigationGroupTranslationKeys[group.title]
                      ? t(navigationGroupTranslationKeys[group.title], { defaultValue: group.title })
                      : group.title
                  }</span>
                <span
                  className={`clone-chevron ${
                    openGroups[group.title] ? 'is-open' : ''
                  }`}
                >
                  <Glyph type="arrow" />
                </span>
              </button>

              {openGroups[group.title] ? (
                <div className="clone-group-items">
                  {group.items.map((item) => (
                    <NavLink
                      key={item.id}
                      to={itemPath(item.id)}
                      end={item.id === 'dashboard'}
                      onClick={() => setSidebarOpen(false)}
                      className={({ isActive }) =>
                        `clone-nav-item ${isActive ? 'is-active' : ''}`
                      }
                    >
                      <span className="clone-nav-icon">
                        <Glyph type={item.icon} />
                      </span>
                      <span>{translateNavigationLabel(t, item.id, item.label)}</span>
                    </NavLink>
                  ))}
                </div>
              ) : null}
            </section>
          ))}

          {config.modules['partner-portal'] ? (
            <section className="clone-nav-group">
            <button
              type="button"
              className="clone-group-title clone-partner-title"
              aria-expanded={partnerOpen}
              onClick={() => setPartnerOpen((open) => !open)}
            >
              <span className="clone-partner-label">
                <span>{t('navigation.partnerPortal')}</span>
                <span className="clone-partner-badge">☆</span>
              </span>
              <span className={`clone-chevron ${partnerOpen ? 'is-open' : ''}`}>
                <Glyph type="arrow" />
              </span>
            </button>

            {partnerOpen ? (
              <div className="clone-group-items clone-partner-items">
                {partnerItems.map((item) => (
                  <NavLink
                    key={item.id}
                    to={itemPath(item.id)}
                    onClick={() => setSidebarOpen(false)}
                    className={({ isActive }) =>
                      `clone-nav-item clone-nav-item-partner ${
                        isActive ? 'is-active' : ''
                      }`
                    }
                  >
                    <span className="clone-nav-icon">
                      <Glyph type={item.icon} />
                    </span>
                    <span>{translateNavigationLabel(t, item.id, item.label)}</span>
                  </NavLink>
                ))}
              </div>
            ) : null}
            </section>
          ) : null}
        </div>

        <div className="clone-sidebar-footer">
          <div className="clone-account-row">
            <div className="clone-account-summary">
              <span className="clone-profile-avatar">
                {getUserInitials(currentAuthUser?.fullName || 'Workspace User')}
              </span>
              <span className="clone-profile-copy">
                <strong>{currentAuthUser?.fullName || 'Workspace User'}</strong>
                <small>{currentAuthUser?.role || 'Founder'}</small>
              </span>
            </div>
            <button
              type="button"
              className="clone-logout-button"
              aria-label={t('navigation.signOut')}
              title={t('navigation.signOut')}
              onClick={signOut}
            >
              <Glyph type="logout" />
            </button>
          </div>

          {footerItems.map((item) => (
            <NavLink
              key={item.id}
              to={itemPath(item.id)}
              onClick={() => setSidebarOpen(false)}
              className={({ isActive }) =>
                `clone-footer-link ${item.id === 'settings' ? 'is-strong' : ''} ${
                  isActive ? 'is-active' : ''
                }`
              }
            >
              <span className="clone-nav-icon">
                <Glyph type={item.icon} />
              </span>
              <span>{translateNavigationLabel(t, item.id, item.label)}</span>
            </NavLink>
          ))}
          <NavLink
            to="/admin"
            onClick={() => {
              grantAdminAccess()
              setSidebarOpen(false)
            }}
            className={({ isActive }) =>
              `clone-footer-link ${isActive ? 'is-active' : ''}`
          }
          >
            <span className="clone-nav-icon">
              <Glyph type="shield" />
            </span>
            <span>{t('navigation.items.admin')}</span>
          </NavLink>
          <OpenBconAttribution variant="sidebar" />
        </div>
      </aside>

      <main className="clone-main">
        {showNotificationBar ? (
          <div className="dashboard-notification-bar" role="region" aria-label="Notification">
            <span className="dashboard-notification-icon" aria-hidden="true">
              <Glyph type="spark" />
            </span>
            <div className="dashboard-notification-content">
              <p>{notificationBar.message}</p>
              {notificationUrl && notificationBar.actionLabel.trim() ? (
                notificationUrl.startsWith('/') || notificationUrl.startsWith('#') ? (
                  <Link to={notificationUrl}>{notificationBar.actionLabel}</Link>
                ) : (
                  <a href={notificationUrl} target="_blank" rel="noreferrer">
                    {notificationBar.actionLabel}
                  </a>
                )
              ) : null}
            </div>
            {notificationBar.dismissible ? (
              <button
                type="button"
                className="dashboard-notification-dismiss"
                aria-label="Dismiss notification"
                onClick={() => setNotificationDismissed(true)}
              >
                <Glyph type="close" />
              </button>
            ) : null}
          </div>
        ) : null}
        <div className={`clone-main-inner ${isQuickBuild ? 'is-quick-build' : ''}`}>
          {isOverview ? (
            <OverviewPage userName={currentAuthUser?.fullName} />
          ) : isDiscovery ? (
            <FundingReadinessPage />
          ) : isQuickBuild ? (
            <QuickBuildPage initialView="form" />
          ) : isStrategicReports ? (
            <StrategicReportsPage />
          ) : isMyCompanies ? (
            <MyCompanyPage />
          ) : isSavedPrograms ? (
            <SavedProgramsPage />
          ) : isMyApplications ? (
            <MyApplicationsPage />
          ) : isGrantsLoans ? (
            <GrantsLoansPage />
          ) : isTemplates ? (
            <TemplatesPage />
          ) : isSocialResources ? (
            <SocialResourcesPage />
          ) : isTools ? (
            <ToolsPage />
          ) : isSettings ? (
            <SettingsPage />
          ) : currentItem ? (
            <SectionListing item={currentItem} />
          ) : null}

          {!isQuickBuild && showsProgramPanels ? (
            <>
              {config.modules['funding-shortlist'] ? (
                <section className="clone-section">
                <div className="clone-section-header">
                  <span className="clone-section-icon">
                    <Glyph type="arrow" />
                  </span>
                  <h2>Funding Shortlist</h2>
                  <Link to="/funding-shortlist" className="clone-inline-upgrade">
                    View all
                  </Link>
                </div>
                <div className="clone-program-grid">
                  {allDashboardItems
                    .find((item) => item.id === 'funding-shortlist')
                    ?.entries.map((entry) => (
                      <article key={entry.title} className="clone-program-card">
                        <span className="clone-program-tag">{entry.status}</span>
                        <h3>{entry.title}</h3>
                        <p>{entry.subtitle}</p>
                      </article>
                    ))}
                </div>
                </section>
              ) : null}

              {config.modules['grants-loans'] ? (
                <section className="clone-section">
                <div className="clone-section-header">
                  <span className="clone-section-icon">
                    <Glyph type="spark" />
                  </span>
                  <h2>Recommended Programs</h2>
                  <Link to="/grants-loans" className="clone-inline-upgrade">
                    Explore
                  </Link>
                </div>
                <div className="clone-program-grid">
                  {allDashboardItems
                    .find((item) => item.id === 'grants-loans')
                    ?.entries.map((entry) => (
                      <article
                        key={entry.title}
                        className="clone-program-card clone-program-card-light"
                      >
                        <span className="clone-program-tag clone-program-tag-accent">
                          {entry.status}
                        </span>
                        <h3>{entry.title}</h3>
                        <p>{entry.subtitle}</p>
                      </article>
                    ))}
                </div>
                </section>
              ) : null}
            </>
          ) : null}
        </div>
      </main>
    </div>
  )
}
