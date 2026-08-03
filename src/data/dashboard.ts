export type DashboardGlyph =
  | 'home'
  | 'grid'
  | 'search'
  | 'bolt'
  | 'currency'
  | 'file'
  | 'user'
  | 'settings'
  | 'logout'
  | 'arrow'
  | 'spark'
  | 'tools'
  | 'menu'
  | 'close'

export type DashboardListEntry = {
  title: string
  subtitle: string
  meta: string
  status: string
  sourceName?: string
  url?: string
}

export type DashboardItem = {
  id: string
  label: string
  icon: DashboardGlyph
  badgeIcon?: DashboardGlyph
  description: string
  intro: string
  entries: DashboardListEntry[]
}

export type DashboardGroup = {
  title: string
  items: DashboardItem[]
}

function makeEntries(section: string, noun: string): DashboardListEntry[] {
  return [
    {
      title: `${section} Overview`,
      subtitle: `Primary ${noun.toLowerCase()} record with the latest synced details and workspace context.`,
      meta: 'Updated 2 hours ago',
      status: 'Active',
    },
    {
      title: `${section} Pipeline`,
      subtitle: `Current ${noun.toLowerCase()} items waiting for review, completion, or action.`,
      meta: '12 items available',
      status: 'In Review',
    },
    {
      title: `${section} Archive`,
      subtitle: `Historical ${noun.toLowerCase()} records kept for auditing and reuse.`,
      meta: 'Last touched this week',
      status: 'Saved',
    },
  ]
}

export const dashboardGroups: DashboardGroup[] = [
  {
    title: 'Funding Centre',
    items: [
      {
        id: 'dashboard',
        label: 'Dashboard',
        icon: 'home',
        badgeIcon: 'spark',
        description: 'See the latest workspace summary, updates, quick actions, and upgrade prompts.',
        intro:
          'This page acts as the control centre for your funding workspace and highlights the most important actions.',
        entries: makeEntries('Dashboard', 'dashboard'),
      },
      {
        id: 'funding-readiness',
        label: 'Funding Readiness',
        icon: 'spark',
        badgeIcon: 'spark',
        description: 'Track funding readiness assessments, score changes, and follow-up recommendations.',
        intro:
          'This listing page shows every readiness-related record available in the workspace by default.',
        entries: makeEntries('Funding Readiness', 'readiness score'),
      },
      {
        id: 'quick-build',
        label: 'Quick Build',
        icon: 'bolt',
        badgeIcon: 'spark',
        description: 'Review generated plans, forecasts, and memo runs from the quick generation workflow.',
        intro:
          'This listing page gathers all generated output entries so users can reopen or rerun them.',
        entries: makeEntries('Quick Build', 'generated document'),
      },
      {
        id: 'advisory-hub',
        label: 'Advisory Hub',
        icon: 'grid',
        badgeIcon: 'spark',
        description: 'Open the live advisory workspace, section progress, and editable package output.',
        intro:
          'This page reopens the latest funding package workspace so users can review, edit, export, or continue the advisory output.',
        entries: makeEntries('Advisory Hub', 'workspace output'),
      },
    ],
  },
  {
    title: 'My Workspace',
    items: [
      {
        id: 'my-company',
        label: 'My Company',
        icon: 'grid',
        badgeIcon: 'user',
        description: 'Browse company profiles, legal information, contact data, and business details.',
        intro:
          'This listing page contains the default company-related records for the active workspace.',
        entries: makeEntries('My Company', 'company profile'),
      },
      {
        id: 'saved-programs',
        label: 'Saved Programs',
        icon: 'file',
        badgeIcon: 'user',
        description: 'Access every saved grant or loan program that has been bookmarked for follow-up.',
        intro:
          'This listing page shows all saved programs in one place so nothing gets lost between sessions.',
        entries: makeEntries('Saved Programs', 'saved program'),
      },
      {
        id: 'my-applications',
        label: 'My Applications',
        icon: 'file',
        badgeIcon: 'spark',
        description: 'List application drafts, submitted funding applications, and their current statuses.',
        intro:
          'This listing page helps users manage all application records from a single view.',
        entries: makeEntries('My Applications', 'application'),
      },
    ],
  },
  {
    title: 'Programs & Opportunities',
    items: [
      {
        id: 'grants-loans',
        label: 'Grants & Loans',
        icon: 'search',
        badgeIcon: 'user',
        description: 'Review all grant and loan opportunities currently available in the discovery workspace.',
        intro:
          'This listing page collects all grant and loan records matched to your business criteria.',
        entries: makeEntries('Grants & Loans', 'funding opportunity'),
      },
      {
        id: 'templates',
        label: 'Templates',
        icon: 'file',
        badgeIcon: 'spark',
        description: 'Open reusable templates for plans, outreach, applications, and custom workflows.',
        intro:
          'This listing page contains every template currently published to the workspace.',
        entries: makeEntries('Templates', 'template'),
      },
      {
        id: 'social-resources',
        label: 'Social Resources',
        icon: 'user',
        badgeIcon: 'spark',
        description: 'Discover investors, funds, advisors, accelerators, and companies in the network.',
        intro:
          'This directory groups people and organizations relevant to funding and business growth.',
        entries: makeEntries('Social Resources', 'network contact'),
      },
      {
        id: 'tools',
        label: 'Tools',
        icon: 'tools',
        badgeIcon: 'user',
        description: 'Explore software, cloud services, financial products, and business credit cards.',
        intro:
          'This directory brings together products and services commonly used by entrepreneurs.',
        entries: makeEntries('Tools', 'business product'),
      },
    ],
  },
]

export const partnerItems: DashboardItem[] = [
  {
    id: 'partner-dashboard',
    label: 'Partner Dashboard',
    icon: 'grid',
    badgeIcon: 'spark',
    description: 'View partner-level workspace data, active clients, and usage trends.',
    intro: 'This listing page surfaces all partner dashboard records and summaries.',
    entries: makeEntries('Partner Dashboard', 'partner record'),
  },
  {
    id: 'partner-analytics',
    label: 'Partner Analytics',
    icon: 'grid',
    badgeIcon: 'spark',
    description: 'Inspect analytics entries tied to partner performance and usage.',
    intro: 'This listing page groups all partner analytics datasets by default.',
    entries: makeEntries('Partner Analytics', 'analytics item'),
  },
  {
    id: 'client-management',
    label: 'Client Management',
    icon: 'grid',
    badgeIcon: 'spark',
    description: 'Review client records, onboarding status, and assignment details.',
    intro: 'This listing page shows every client management record in the workspace.',
    entries: makeEntries('Client Management', 'client record'),
  },
  {
    id: 'application-management',
    label: 'Application Management',
    icon: 'grid',
    badgeIcon: 'spark',
    description: 'Track applications across all managed clients and funding flows.',
    intro: 'This listing page centralizes every application management record.',
    entries: makeEntries('Application Management', 'managed application'),
  },
  {
    id: 'revenue-sharing',
    label: 'Revenue Sharing',
    icon: 'grid',
    badgeIcon: 'spark',
    description: 'Access revenue share records, payout statuses, and allocation rules.',
    intro: 'This listing page contains all revenue-sharing entries published to the partner portal.',
    entries: makeEntries('Revenue Sharing', 'revenue share item'),
  },
  {
    id: 'business-plan-pro',
    label: 'Business Plan PRO',
    icon: 'grid',
    badgeIcon: 'spark',
    description: 'List pro-level business plan outputs, templates, and workspace records.',
    intro: 'This listing page shows every Business Plan PRO record available to the user.',
    entries: makeEntries('Business Plan PRO', 'business plan'),
  },
  {
    id: 'financial-forecast-pro',
    label: 'Financial Forecast PRO',
    icon: 'grid',
    badgeIcon: 'spark',
    description: 'Browse pro forecast runs, datasets, and calculation records.',
    intro: 'This listing page shows all Financial Forecast PRO entries by default.',
    entries: makeEntries('Financial Forecast PRO', 'forecast record'),
  },
  {
    id: 'branding-domain',
    label: 'Branding & Domain',
    icon: 'grid',
    badgeIcon: 'spark',
    description: 'Manage branding kits, domains, and associated partner assets.',
    intro: 'This listing page collects all branding and domain records in one place.',
    entries: makeEntries('Branding & Domain', 'branding asset'),
  },
  {
    id: 'team-role-permissions',
    label: 'Team & Role Permissions',
    icon: 'grid',
    badgeIcon: 'spark',
    description: 'Inspect team members, roles, invitation states, and permission sets.',
    intro: 'This listing page displays every team and role permission record.',
    entries: makeEntries('Team & Role Permissions', 'team permission'),
  },
  {
    id: 'api-access',
    label: 'API Access',
    icon: 'grid',
    badgeIcon: 'spark',
    description: 'Review API keys, integrations, logs, and access policies.',
    intro: 'This listing page groups all API access records for the platform.',
    entries: makeEntries('API Access', 'api access item'),
  },
  {
    id: 'workflow-builder',
    label: 'Workflow Builder',
    icon: 'grid',
    badgeIcon: 'spark',
    description: 'Browse saved workflows, automations, and internal routing logic.',
    intro: 'This listing page contains every workflow builder record currently configured.',
    entries: makeEntries('Workflow Builder', 'workflow'),
  },
  {
    id: 'custom-report-export',
    label: 'Custom Report Export',
    icon: 'grid',
    badgeIcon: 'spark',
    description: 'Access export presets, report bundles, and generated reports.',
    intro: 'This listing page shows all custom report export records available in the portal.',
    entries: makeEntries('Custom Report Export', 'report export'),
  },
]

export const footerItems: DashboardItem[] = [
  {
    id: 'settings',
    label: 'Settings',
    icon: 'settings',
    badgeIcon: 'user',
    description: 'Manage profile, workspace, notifications, security, billing, and subscription settings.',
    intro: 'This account centre brings every personal and workspace preference into one place.',
    entries: makeEntries('Settings', 'setting'),
  },
]

export const quickActionRoutes = [
  { label: 'Grants & Loans', path: '/grants-loans', icon: 'search' as const, tone: 'primary' as const },
  { label: 'Quick Build', path: '/quick-build', icon: 'spark' as const, tone: 'secondary' as const },
  { label: 'Templates', path: '/templates', icon: 'file' as const, tone: 'ghost' as const },
  { label: 'Social Resources', path: '/social-resources', icon: 'user' as const, tone: 'ghost' as const },
  { label: 'Tools', path: '/tools', icon: 'grid' as const, tone: 'ghost' as const },
]

export const allDashboardItems = [
  ...dashboardGroups.flatMap((group) => group.items),
  ...partnerItems,
  ...footerItems,
]

export function findDashboardItem(id?: string) {
  if (!id) {
    return allDashboardItems.find((item) => item.id === 'dashboard') ?? null
  }

  return allDashboardItems.find((item) => item.id === id) ?? null
}
