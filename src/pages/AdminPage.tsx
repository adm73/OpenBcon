import {
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type CSSProperties,
  type FormEvent,
} from 'react'
import { Link } from 'react-router-dom'
import { usePlatformConfig } from '../config/usePlatformConfig'
import {
  buildAIModelURL,
  type AdvisoryHubAgentConfig,
  type AdvisoryHubConfig,
  type AdvisoryHubDocumentTypeConfig,
  type AdvisoryHubLayoutConfig,
  type AdvisoryHubSectionConfig,
  type AIModelConfig,
  type AuthenticationConfig,
  type ContentFormat,
  type LandingContentConfig,
  type LandingFooterConfig,
  type LandingFooterLegalLinkConfig,
  type LandingFooterNavItemConfig,
  type LandingHeaderConfig,
  type LandingHeaderNavItemConfig,
  type LegalDocumentConfig,
  type PaymentCatalogItem,
  type PaymentConfig,
  type PlatformConfig,
  type PlatformModuleId,
  sanitizePlatformConfigForPersistence,
  secureConfigValuePlaceholder,
} from '../config/platform'
import {
  removeSyncedResourceRecords,
  removeSyncedFundingPrograms,
  saveSyncedResourceRecords,
  saveSyncedFundingPrograms,
  syncFundingDataSource,
  syncResourceDataSource,
  parseJsonFundingCatalog,
  defaultFundingProgramFieldMapping,
  defaultJsonFundingProgramFieldMapping,
  fundingProgramMappingFields,
  getFundingProgramFieldMapping,
  type DataSourceModule,
  type FundingDataSource,
  type FundingDataSourceFrequency,
  type FundingDataSourceProvider,
} from '../data/fundingSources'
import {
  archiveJsonFundingProgramsViaApi,
  importJsonFundingProgramsViaApi,
} from '../lib/fundingProgramsApi'
import { getPlatformDisplayName, getPlatformInitial } from '../lib/platformBrand'
import {
  getClientEnvironmentMode,
  getEnvironmentModeHeaders,
  platformConfigStorageKey,
} from '../lib/environmentMode'
import { languageOptions, normalizeLocale, useLocale } from '../i18n'
import { persistPersistentItem } from '../persistence/storage'
import {
  OPEN_BCON_REPO_URL,
  hasCommercialLicenseAccess,
} from '../licensing/openBconAttribution'
import { cssDeclarationsToStyle } from '../lib/layoutStyles'

const moduleLabels: Array<{ id: PlatformModuleId; label: string; group: string }> = [
  { id: 'discovery', label: 'Discovery', group: 'Funding Centre' },
  { id: 'quick-build', label: 'Quick Build', group: 'Funding Centre' },
  { id: 'my-companies', label: 'My Companies', group: 'My Workspace' },
  { id: 'funding-shortlist', label: 'Funding Shortlist', group: 'My Workspace' },
  { id: 'my-applications', label: 'My Applications', group: 'My Workspace' },
  { id: 'grants-loans', label: 'Grants & Loans', group: 'Programs' },
  { id: 'templates', label: 'Templates', group: 'Programs' },
  { id: 'social-resources', label: 'Social Resources', group: 'Programs' },
  { id: 'tools', label: 'Tools', group: 'Programs' },
  { id: 'partner-portal', label: 'Partner Portal', group: 'Commercial' },
]

const recentTransactions = [
  ['INV-1048', 'Northstar Advisory', '$79.00', 'Succeeded', 'Jul 28'],
  ['INV-1047', 'Greenline Partners', '$790.00', 'Succeeded', 'Jul 27'],
  ['INV-1046', 'Fieldnote Studio', '$79.00', 'Refunded', 'Jul 25'],
]

const paymentProviderOptions: Array<{
  id: 'stripe' | 'waffo-pancake'
  label: string
  icon: string
}> = [
  { id: 'stripe', label: 'Stripe', icon: 'S' },
  { id: 'waffo-pancake', label: 'Waffo Pancake', icon: 'W' },
]

const revenueHighlights = [
  ['Gross revenue', '$18,420', '+11.8% vs last month'],
  ['Operating expenses', '$6,940', '+4.1% vs last month'],
  ['Net operating income', '$11,480', '62.3% operating margin'],
  ['Active subscriptions', '164', '19 annual · 145 monthly'],
]

const revenueBreakdown = [
  ['Subscriptions', '$14,920', '81% of total revenue'],
  ['Setup & onboarding', '$2,500', 'One-time implementation fees'],
  ['Partner services', '$1,000', 'Advisory and support retainers'],
]

const expenseBreakdown = [
  ['AI & infrastructure', '$2,860', 'OpenAI, compute, storage'],
  ['Payment processing', '$1,120', 'Gateway fees and chargebacks'],
  ['Operations', '$1,760', 'Support, admin, tooling'],
  ['Sales & growth', '$1,200', 'Ads, outbound, partnerships'],
]

const subscriptionHealth = [
  ['Partner Pro monthly', '145', '$79 / month'],
  ['Partner Pro annual', '19', '$790 / year'],
  ['Past due', '3', 'Needs collection follow-up'],
  ['Churn this month', '2.4%', '4 cancelled subscriptions'],
]

const dataSourceModuleLabels: Record<DataSourceModule, string> = {
  'grants-loans': 'Grants & Loans',
  templates: 'Templates',
  'social-resources': 'Social Resources',
  tools: 'Tools',
}

const dataSourceProviderLabels: Record<FundingDataSourceProvider, string> = {
  'google-sheets': 'Google Sheets',
  airtable: 'Airtable',
  'json-file': 'JSON File',
}

function createFundingDataSource(): FundingDataSource {
  return {
    id: `source-${Date.now()}`,
    name: '',
    module: 'grants-loans',
    provider: 'google-sheets',
    enabled: true,
    frequency: 'manual',
    spreadsheetUrl: '',
    sheetName: 'Programs',
    airtableBaseId: '',
    airtableTableName: '',
    airtableView: '',
    proxyUrl: '/api/integrations/airtable/sync',
    credentialReference: 'AIRTABLE_ACCESS_TOKEN',
    status: 'draft',
    recordCount: 0,
    lastSyncedAt: '',
    lastError: '',
    jsonFileName: '',
    jsonSourceVersion: '',
    language: 'en-CA',
    fieldMapping: { ...defaultFundingProgramFieldMapping },
  }
}

function createLandingNavItem(): LandingHeaderNavItemConfig {
  return {
    id: `nav-${Date.now()}`,
    label: 'New item',
    href: '#',
  }
}

function createLandingFooterNavItem(
  prefix: 'sitemap' | 'platform',
): LandingFooterNavItemConfig {
  return {
    id: `${prefix}-${Date.now()}`,
    label: 'New item',
    href: '#',
  }
}

function createLandingProofItem() {
  return {
    value: 'New',
    label: 'proof point',
  }
}

function createPaymentPriceItem(
  provider: PaymentCatalogItem['provider'] = 'stripe',
): PaymentCatalogItem {
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`

  return {
    id: `price-${suffix}`,
    name: 'New offering',
    description: '',
    descriptionFormat: 'html',
    offeringType: 'service',
    billingType: 'monthly',
    amount: '0',
    currency: 'CAD',
    provider,
    externalProductId: '',
    externalPriceId: '',
    active: true,
    isDefault: false,
  }
}

function layoutPreviewStyle(layout: AdvisoryHubLayoutConfig): CSSProperties {
  return cssDeclarationsToStyle(layout.css)
}

type PaymentDescriptionEditorProps = {
  format: ContentFormat
  value: string
  onChange: (value: string) => void
}

type UpdateCheckState = {
  status: 'idle' | 'checking' | 'current' | 'available' | 'unknown' | 'error'
  currentCommit: string
  latestShortCommit: string
  latestMessage: string
  latestUrl: string
  latestCommittedAt: string
  error: string
}

type AdminUser = {
  id: string
  email: string
  fullName: string
  role: 'owner' | 'admin' | 'member'
  status: 'active' | 'invited' | 'disabled'
  emailVerified: boolean
  hasGoogleAccount: boolean
  createdAt: string
  updatedAt: string | null
}

type AdminUserDraft = {
  id?: string
  fullName: string
  email: string
  role: AdminUser['role']
  status: AdminUser['status']
  password: string
  emailVerified: boolean
}

function createAdminUserDraft(): AdminUserDraft {
  return {
    fullName: '',
    email: '',
    role: 'member',
    status: 'active',
    password: '',
    emailVerified: false,
  }
}

const initialUpdateCheckState: UpdateCheckState = {
  status: 'idle',
  currentCommit: String(import.meta.env.VITE_APP_COMMIT ?? '').trim() || 'unknown',
  latestShortCommit: '',
  latestMessage: '',
  latestUrl: '',
  latestCommittedAt: '',
  error: '',
}

const descriptionEditorActions = [
  { id: 'bold', label: 'B', title: 'Bold', command: 'bold' },
  { id: 'italic', label: 'I', title: 'Italic', command: 'italic' },
  {
    id: 'unordered-list',
    label: '• List',
    title: 'Bulleted list',
    command: 'insertUnorderedList',
  },
  {
    id: 'ordered-list',
    label: '1. List',
    title: 'Numbered list',
    command: 'insertOrderedList',
  },
] as const

function PaymentDescriptionEditor({
  format,
  value,
  onChange,
}: PaymentDescriptionEditorProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const editorRef = useRef<HTMLDivElement>(null)
  const htmlEditingRef = useRef(false)

  useEffect(() => {
    if (format !== 'html' || htmlEditingRef.current || !editorRef.current) return

    if (editorRef.current.innerHTML !== value) {
      editorRef.current.innerHTML = value
    }
  }, [format, value])

  function insertMarkdown(before: string, after = before, placeholder = 'text') {
    const textarea = textareaRef.current
    if (!textarea) return

    const start = textarea.selectionStart
    const end = textarea.selectionEnd
    const selected = value.slice(start, end) || placeholder
    const nextValue = `${value.slice(0, start)}${before}${selected}${after}${value.slice(end)}`
    onChange(nextValue)

    requestAnimationFrame(() => {
      textarea.focus()
      const nextStart = start + before.length
      textarea.setSelectionRange(nextStart, nextStart + selected.length)
    })
  }

  function insertMarkdownList(ordered: boolean) {
    const textarea = textareaRef.current
    if (!textarea) return

    const start = textarea.selectionStart
    const end = textarea.selectionEnd
    const selected = value.slice(start, end) || 'List item'
    const marker = ordered ? '1. ' : '- '
    const nextValue = selected
      .split('\n')
      .map((line) => `${marker}${line}`)
      .join('\n')
    onChange(`${value.slice(0, start)}${nextValue}${value.slice(end)}`)

    requestAnimationFrame(() => {
      textarea.focus()
      textarea.setSelectionRange(start, start + nextValue.length)
    })
  }

  function insertMarkdownLink() {
    const url = window.prompt('Link URL', 'https://')
    if (!url) return
    insertMarkdown('[', `](${url})`, 'link text')
  }

  function runHtmlCommand(command: string) {
    editorRef.current?.focus()
    document.execCommand(command)
  }

  function runHtmlLinkCommand() {
    const url = window.prompt('Link URL', 'https://')
    if (!url) return
    editorRef.current?.focus()
    document.execCommand('createLink', false, url)
  }

  return (
    <div className="admin-rich-text-editor">
      <div
        className="admin-rich-text-toolbar"
        role="toolbar"
        aria-label="Description formatting"
      >
        {descriptionEditorActions.map((action) => (
          <button
            key={action.id}
            type="button"
            title={action.title}
            aria-label={action.title}
            onMouseDown={(event) => event.preventDefault()}
            onClick={() =>
              format === 'html'
                ? runHtmlCommand(action.command)
                : action.id === 'unordered-list'
                  ? insertMarkdownList(false)
                  : action.id === 'ordered-list'
                    ? insertMarkdownList(true)
                    : insertMarkdown(action.command === 'bold' ? '**' : '*')
            }
          >
            {action.label}
          </button>
        ))}
        <button
          type="button"
          title="Add link"
          aria-label="Add link"
          onMouseDown={(event) => event.preventDefault()}
          onClick={() =>
            format === 'html' ? runHtmlLinkCommand() : insertMarkdownLink()
          }
        >
          Link
        </button>
        <small>{format === 'html' ? 'Rich HTML' : 'Markdown shortcuts'}</small>
      </div>
      {format === 'html' ? (
        <div
          ref={editorRef}
          className="admin-rich-text-content"
          contentEditable
          role="textbox"
          aria-label="Description"
          aria-multiline="true"
          suppressContentEditableWarning
          onFocus={() => {
            htmlEditingRef.current = true
          }}
          onBlur={() => {
            htmlEditingRef.current = false
            onChange(editorRef.current?.innerHTML ?? '')
          }}
        />
      ) : (
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder="Use Markdown or the formatting buttons to build the description."
        />
      )}
    </div>
  )
}

function isEnvironmentReference(value: string) {
  return /^[A-Z][A-Z0-9_]*$/u.test(value.trim())
}

type AIChatMessage = {
  role: 'user' | 'assistant' | 'error'
  content: string
}

const aiProviderOptions = [
  { id: 'openai', name: 'OpenAI' },
  { id: 'anthropic', name: 'Anthropic' },
  { id: 'google', name: 'Google' },
  { id: 'openrouter', name: 'OpenRouter' },
  { id: 'ollama', name: 'Ollama' },
  { id: 'custom', name: 'Custom' },
] as const

function getDefaultAIModelURL(providerId: string, modelId: string) {
  if (providerId === 'anthropic') return 'https://api.anthropic.com/v1/messages'
  if (providerId === 'google') {
    return `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(modelId)}:generateContent`
  }
  if (providerId === 'openrouter') return 'https://openrouter.ai/api/v1/chat/completions'
  if (providerId === 'ollama') return 'http://ollama:11434/api/chat'
  if (providerId === 'custom') return '/api/ai'
  return 'https://api.openai.com/v1/chat/completions'
}

function getAIProviderDefaults(providerId: string, modelId: string) {
  const url = getDefaultAIModelURL(providerId, modelId)
  const lastSlash = url.lastIndexOf('/')
  const isAbsoluteURL = /^https?:\/\//iu.test(url)

  return {
    baseUrl: isAbsoluteURL && lastSlash > 0 ? url.slice(0, lastSlash) : '',
    endpoint: isAbsoluteURL && lastSlash > 0 ? url.slice(lastSlash) : url,
    url,
    authorization:
      providerId === 'anthropic'
        ? 'x-api-key {{apiKey}}'
        : providerId === 'ollama'
          ? ''
          : 'Bearer {{apiKey}}',
  }
}

function getAIModelEndpoint(model: AIModelConfig) {
  return (
    model.url.trim() ||
    buildAIModelURL(model.baseUrl, model.endpoint) ||
    getDefaultAIModelURL(model.providerId, model.id)
  )
}

function formatAIConnectionTime(value: string) {
  if (!value) return ''
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '' : `Last tested ${date.toLocaleString()}`
}

function formatAIChatResponse(value: string) {
  if (!value.trim()) return '(The model returned an empty response.)'

  try {
    const parsed = JSON.parse(value) as unknown
    const extractText = (candidate: unknown): string | null => {
      if (typeof candidate === 'string' && candidate.trim()) return candidate
      if (Array.isArray(candidate)) {
        for (const item of candidate) {
          const extracted = extractText(item)
          if (extracted) return extracted
        }
        return null
      }
      if (!candidate || typeof candidate !== 'object') return null

      const record = candidate as Record<string, unknown>
      for (const key of ['output_text', 'text', 'content', 'message', 'output', 'choices', 'candidates', 'parts']) {
        const extracted = extractText(record[key])
        if (extracted) return extracted
      }
      return null
    }

    return extractText(parsed) ?? JSON.stringify(parsed, null, 2)
  } catch {
    return value
  }
}

export function AdminPage() {
  const {
    config,
    updateConfig,
    updateConfigLocally,
    resetConfig,
  } = usePlatformConfig()
  const { setLocale } = useLocale()
  const [draft, setDraft] = useState<PlatformConfig>(config)
  const [saved, setSaved] = useState(false)
  const [settingsNotice, setSettingsNotice] = useState('')
  const [savingAIModels, setSavingAIModels] = useState<Record<string, boolean>>({})
  const [aiModelSaveNotice, setAIModelSaveNotice] = useState('')
  const [paymentNotice, setPaymentNotice] = useState('')
  const [testingAIModels, setTestingAIModels] = useState<Record<string, boolean>>({})
  const [expandedAIModelSettings, setExpandedAIModelSettings] = useState<Record<string, boolean>>({})
  const [aiChatModel, setAIChatModel] = useState<AIModelConfig | null>(null)
  const [aiChatMessages, setAIChatMessages] = useState<AIChatMessage[]>([])
  const [aiChatInput, setAIChatInput] = useState('')
  const [aiChatSending, setAIChatSending] = useState(false)
  const [sourceQuery, setSourceQuery] = useState('')
  const [sourceModuleFilter, setSourceModuleFilter] = useState<
    'all' | DataSourceModule
  >('all')
  const [sourceEditor, setSourceEditor] = useState<FundingDataSource | null>(null)
  const [jsonFiles, setJsonFiles] = useState<Record<string, File>>({})
  const [syncingSourceId, setSyncingSourceId] = useState('')
  const [deleteSourceId, setDeleteSourceId] = useState('')
  const [sourceNotice, setSourceNotice] = useState('')
  const [updateCheck, setUpdateCheck] = useState<UpdateCheckState>(
    initialUpdateCheckState,
  )
  const [adminUsers, setAdminUsers] = useState<AdminUser[]>([])
  const [adminUsersLoading, setAdminUsersLoading] = useState(false)
  const [adminUsersQuery, setAdminUsersQuery] = useState('')
  const [adminUserEditor, setAdminUserEditor] = useState<AdminUserDraft | null>(null)
  const [adminUsersNotice, setAdminUsersNotice] = useState('')
  const [adminUsersError, setAdminUsersError] = useState('')
  const [adminUsersSaving, setAdminUsersSaving] = useState(false)
  const [adminUserDeleting, setAdminUserDeleting] = useState('')
  const commercialLicenseUnlocked = hasCommercialLicenseAccess()
  const platformName = getPlatformDisplayName(draft)
  const platformInitial = getPlatformInitial(draft)
  const activePaymentProvider =
    draft.payments.provider === 'waffo-pancake' ? 'waffo-pancake' : 'stripe'
  const visibleDataSources = draft.dataSources.filter((source) => {
    const matchesQuery = `${source.name} ${source.provider} ${source.module}`
      .toLowerCase()
      .includes(sourceQuery.trim().toLowerCase())
    return (
      matchesQuery &&
      (sourceModuleFilter === 'all' || source.module === sourceModuleFilter)
    )
  })

  useEffect(() => {
    document.title = `Admin Console | ${getPlatformDisplayName(config)}`
  }, [config])

  async function loadAdminUsers(query = adminUsersQuery) {
    setAdminUsersLoading(true)
    setAdminUsersError('')
    try {
      const response = await fetch(`/api/admin/users?query=${encodeURIComponent(query)}`, {
        credentials: 'include',
        headers: getEnvironmentModeHeaders(),
      })
      const payload = (await response.json().catch(() => null)) as
        | { users?: AdminUser[]; message?: string }
        | null
      if (!response.ok) {
        throw new Error(payload?.message ?? 'Unable to load users.')
      }
      setAdminUsers(payload?.users ?? [])
    } catch (error) {
      setAdminUsersError(error instanceof Error ? error.message : 'Unable to load users.')
    } finally {
      setAdminUsersLoading(false)
    }
  }

  useEffect(() => {
    void loadAdminUsers('')
  }, [])

  function updateAdminUserDraft<Key extends keyof AdminUserDraft>(
    field: Key,
    value: AdminUserDraft[Key],
  ) {
    setAdminUserEditor((current) => (current ? { ...current, [field]: value } : current))
  }

  async function saveAdminUser() {
    if (!adminUserEditor) return
    if (!adminUserEditor.id && adminUserEditor.password.length < 8) {
      setAdminUsersError('A new user needs a password with at least 8 characters.')
      return
    }

    setAdminUsersSaving(true)
    setAdminUsersError('')
    setAdminUsersNotice('')
    const isEditing = Boolean(adminUserEditor.id)
    try {
      const response = await fetch(
        isEditing ? `/api/admin/users/${adminUserEditor.id}` : '/api/admin/users',
        {
          method: isEditing ? 'PATCH' : 'POST',
          credentials: 'include',
          headers: {
            'content-type': 'application/json',
            ...getEnvironmentModeHeaders(),
          },
          body: JSON.stringify({
            fullName: adminUserEditor.fullName,
            email: adminUserEditor.email,
            role: adminUserEditor.role,
            status: adminUserEditor.status,
            password: adminUserEditor.password || undefined,
            emailVerified: adminUserEditor.emailVerified,
          }),
        },
      )
      const payload = (await response.json().catch(() => null)) as
        | { user?: AdminUser; message?: string }
        | null
      if (!response.ok) {
        throw new Error(payload?.message ?? 'Unable to save user.')
      }
      setAdminUsers((current) => {
        const savedUser = payload?.user
        if (!savedUser) return current
        return isEditing
          ? current.map((user) => (user.id === savedUser.id ? savedUser : user))
          : [savedUser, ...current]
      })
      setAdminUserEditor(null)
      setAdminUsersNotice(isEditing ? 'User updated.' : 'User created.')
    } catch (error) {
      setAdminUsersError(error instanceof Error ? error.message : 'Unable to save user.')
    } finally {
      setAdminUsersSaving(false)
    }
  }

  async function deleteAdminUser(user: AdminUser) {
    if (!window.confirm(`Delete ${user.fullName}? This cannot be undone.`)) return

    setAdminUserDeleting(user.id)
    setAdminUsersError('')
    setAdminUsersNotice('')
    try {
      const response = await fetch(`/api/admin/users/${user.id}`, {
        method: 'DELETE',
        credentials: 'include',
        headers: getEnvironmentModeHeaders(),
      })
      const payload = (await response.json().catch(() => null)) as { message?: string } | null
      if (!response.ok) {
        throw new Error(payload?.message ?? 'Unable to delete user.')
      }
      setAdminUsers((current) => current.filter((item) => item.id !== user.id))
      setAdminUsersNotice('User deleted.')
    } catch (error) {
      setAdminUsersError(error instanceof Error ? error.message : 'Unable to delete user.')
    } finally {
      setAdminUserDeleting('')
    }
  }

  function updateField<Key extends keyof PlatformConfig>(
    field: Key,
    value: PlatformConfig[Key],
  ) {
    setDraft((current) => ({ ...current, [field]: value }))
    setSaved(false)
  }

  function updateAuthenticationField<Key extends keyof AuthenticationConfig>(
    field: Key,
    value: AuthenticationConfig[Key],
  ) {
    setDraft((current) => ({
      ...current,
      authentication: { ...current.authentication, [field]: value },
    }))
    setSaved(false)
  }

  function updatePlatformLogo(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        updateField('platformLogo', reader.result)
      }
    }
    reader.readAsDataURL(file)
    event.target.value = ''
  }

  function toggleModule(moduleId: PlatformModuleId) {
    setDraft((current) => ({
      ...current,
      modules: {
        ...current.modules,
        [moduleId]: !current.modules[moduleId],
      },
    }))
    setSaved(false)
  }

  function updatePaymentField<Key extends keyof PaymentConfig>(
    field: Key,
    value: PaymentConfig[Key],
  ) {
    setDraft((current) => ({
      ...current,
      payments: { ...current.payments, [field]: value },
    }))
    setSaved(false)
    setPaymentNotice('')
  }

  function updatePaymentsEnabled(enabled: boolean) {
    setDraft((current) => ({
      ...current,
      payments: {
        ...current.payments,
        enabled,
        provider:
          enabled && current.payments.provider === 'manual'
            ? 'stripe'
            : current.payments.provider,
      },
    }))
    setSaved(false)
    setPaymentNotice('')
  }

  function updatePaymentCatalogItem<Key extends keyof PaymentCatalogItem>(
    itemId: string,
    field: Key,
    value: PaymentCatalogItem[Key],
  ) {
    setDraft((current) => ({
      ...current,
      payments: {
        ...current.payments,
        priceCatalog: current.payments.priceCatalog.map((item) => {
          if (field === 'isDefault' && value === true) {
            return { ...item, isDefault: item.id === itemId }
          }

          return item.id === itemId ? { ...item, [field]: value } : item
        }),
      },
    }))
    setSaved(false)
  }

  function addPaymentCatalogItem() {
    setDraft((current) => ({
      ...current,
      payments: {
        ...current.payments,
        priceCatalog: [
          ...current.payments.priceCatalog,
          createPaymentPriceItem(activePaymentProvider),
        ],
      },
    }))
    setSaved(false)
  }

  function removePaymentCatalogItem(itemId: string) {
    setDraft((current) => ({
      ...current,
      payments: {
        ...current.payments,
        priceCatalog: current.payments.priceCatalog.filter(
          (item) => item.id !== itemId,
        ),
      },
    }))
    setSaved(false)
  }

  function updateAIModel<Key extends keyof AIModelConfig>(
    modelId: string,
    field: Key,
    value: AIModelConfig[Key],
  ) {
    setDraft((current) => {
      const models = current.ai.models.map((model) => {
        if (model.id !== modelId) return model

        const nextModel = {
          ...model,
          [field]: value,
          ...(field === 'id' && model.name === model.id
            ? { name: String(value) }
            : {}),
          connectionStatus: 'untested' as const,
          connectionError: '',
          lastTestedAt: '',
        }

        if (field === 'baseUrl' || field === 'endpoint') {
          nextModel.url = buildAIModelURL(
            field === 'baseUrl' ? String(value) : nextModel.baseUrl,
            field === 'endpoint' ? String(value) : nextModel.endpoint,
          )
        }

        return nextModel
      })

      return {
        ...current,
        ai: {
          ...current.ai,
          defaultModel:
            field === 'id' && current.ai.defaultModel === modelId
              ? String(value)
              : current.ai.defaultModel,
          models,
        },
      }
    })
    setSaved(false)
    setTestingAIModels({})
  }

  function updateAIModelProvider(modelId: string, providerId: string) {
    setDraft((current) => {
      const providerDefaults = getAIProviderDefaults(
        providerId,
        current.ai.models.find((model) => model.id === modelId)?.id || modelId,
      )

      return {
        ...current,
        ai: {
          ...current.ai,
          models: current.ai.models.map((model) =>
            model.id === modelId
              ? {
                  ...model,
                  providerId,
                  ...providerDefaults,
                  connectionStatus: 'untested' as const,
                  connectionError: '',
                  lastTestedAt: '',
                }
              : model,
          ),
        },
      }
    })
    setSaved(false)
    setTestingAIModels({})
  }

  function addAIModel() {
    const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
    const providerId = draft.ai.provider || draft.ai.providers[0]?.id || 'custom'
    const providerDefaults = getAIProviderDefaults(providerId, `model-${suffix}`)
    const model: AIModelConfig = {
      id: `model-${suffix}`,
      name: 'New model',
      providerId,
      context: 'Context window',
      description: 'Configurable generation model',
      apiKey: '',
      ...providerDefaults,
      temperature: '0.2',
      maxTokens: '1024',
      reasoningEnabled: providerId === 'openrouter',
      contentType: 'application/json',
      authorization: providerId === 'ollama' ? '' : 'Bearer {{apiKey}}',
      bodyType: 'JSON',
      bodyParameters: '{}',
      connectionStatus: 'untested',
      connectionError: '',
      lastTestedAt: '',
      enabled: true,
    }
    setDraft((current) => ({
      ...current,
      ai: { ...current.ai, models: [...current.ai.models, model] },
    }))
    setSaved(false)
    setTestingAIModels({})
  }

  function removeAIModel(modelId: string) {
    if (draft.ai.models.length <= 1) return

    const nextModels = draft.ai.models.filter((model) => model.id !== modelId)
    const nextDefault =
      draft.ai.defaultModel === modelId
        ? nextModels.find((model) => model.enabled)?.id ?? nextModels[0]?.id ?? ''
        : draft.ai.defaultModel
    setDraft((current) => ({
      ...current,
      ai: { ...current.ai, defaultModel: nextDefault, models: nextModels },
    }))
    setSaved(false)
    setTestingAIModels({})
  }

  async function saveAIModel(modelId: string) {
    const model = draft.ai.models.find((candidate) => candidate.id === modelId)
    if (!model) return

    setSavingAIModels((current) => ({ ...current, [model.id]: true }))
    setAIModelSaveNotice('')

    try {
      const persistedConfig = sanitizePlatformConfigForPersistence(draft)
      updateConfig(draft)
      const persistenceMode = await persistPersistentItem(
        platformConfigStorageKey,
        JSON.stringify(persistedConfig),
      )
      setSaved(true)
      setTestingAIModels((current) => ({ ...current, [model.id]: false }))
      setAIModelSaveNotice(
        `${model.name || model.id} saved to ${persistenceMode === 'database' ? 'the database' : 'local cache'}.`,
      )
    } catch (error) {
      setAIModelSaveNotice(
        error instanceof Error ? error.message : 'The model could not be saved.',
      )
    } finally {
      setSavingAIModels((current) => ({ ...current, [model.id]: false }))
    }
  }

  function setDefaultAIModel(modelId: string) {
    const model = draft.ai.models.find((candidate) => candidate.id === modelId)
    if (!model) return

    setDraft((current) => ({
      ...current,
      ai: {
        ...current.ai,
        defaultModel: modelId,
        models: current.ai.models.map((candidate) =>
          candidate.id === modelId ? { ...candidate, enabled: true } : candidate,
        ),
      },
    }))
    setSaved(false)
  }

  function updateAdvisoryHubField<Key extends keyof AdvisoryHubConfig>(
    field: Key,
    value: AdvisoryHubConfig[Key],
  ) {
    setDraft((current) => ({
      ...current,
      advisoryHub: { ...current.advisoryHub, [field]: value },
    }))
    setSaved(false)
  }

  function updateAdvisoryHubLayout<Key extends keyof AdvisoryHubLayoutConfig>(
    layoutId: AdvisoryHubLayoutConfig['id'],
    field: Key,
    value: AdvisoryHubLayoutConfig[Key],
  ) {
    updateAdvisoryHubField(
      'layouts',
      draft.advisoryHub.layouts.map((layout) =>
        layout.id === layoutId ? { ...layout, [field]: value } : layout,
      ),
    )
  }

  function updateAdvisoryHubSection<Key extends keyof AdvisoryHubSectionConfig>(
    sectionId: AdvisoryHubSectionConfig['id'],
    field: Key,
    value: AdvisoryHubSectionConfig[Key],
  ) {
    const nextSections = draft.advisoryHub.sections.map((section) =>
      section.id === sectionId ? { ...section, [field]: value } : section,
    )
    if (
      field === 'enabled' &&
      value === false &&
      !nextSections.some((section) => section.enabled)
    ) {
      return
    }
    updateAdvisoryHubField('sections', nextSections)
  }

  function moveAdvisoryHubSection(
    sectionId: AdvisoryHubSectionConfig['id'],
    direction: 'up' | 'down',
  ) {
    const currentIndex = draft.advisoryHub.sections.findIndex(
      (section) => section.id === sectionId,
    )
    const targetIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1
    if (
      currentIndex < 0 ||
      targetIndex < 0 ||
      targetIndex >= draft.advisoryHub.sections.length
    ) {
      return
    }
    const nextSections = [...draft.advisoryHub.sections]
    const [section] = nextSections.splice(currentIndex, 1)
    nextSections.splice(targetIndex, 0, section)
    updateAdvisoryHubField('sections', nextSections)
  }

  function addAdvisoryHubSection() {
    const documentType = draft.advisoryHub.documentTypes[0]
    const agent = draft.advisoryHub.agents[0]
    if (!documentType || !agent) return

    updateAdvisoryHubField('sections', [
      ...draft.advisoryHub.sections,
      {
        id: `custom-section-${Date.now()}`,
        title: 'New section',
        documentTypeId: documentType.id,
        prompt: 'Describe the evidence, analysis, and reviewer outcome this section should cover.',
        agentId: agent.id,
        layout: 'main-content',
        priority: 'default',
        enabled: true,
      },
    ])
  }

  function removeAdvisoryHubSection(sectionId: AdvisoryHubSectionConfig['id']) {
    if (draft.advisoryHub.sections.length <= 1) return
    updateAdvisoryHubField(
      'sections',
      draft.advisoryHub.sections.filter((section) => section.id !== sectionId),
    )
  }

  function updateAdvisoryHubAgent<Key extends keyof AdvisoryHubAgentConfig>(
    agentId: string,
    field: Key,
    value: AdvisoryHubAgentConfig[Key],
  ) {
    updateAdvisoryHubField(
      'agents',
      draft.advisoryHub.agents.map((agent) =>
        agent.id === agentId ? { ...agent, [field]: value } : agent,
      ),
    )
  }

  function addAdvisoryHubAgent() {
    updateAdvisoryHubField('agents', [
      ...draft.advisoryHub.agents,
      {
        id: `custom-agent-${Date.now()}`,
        name: 'New agent',
        role: 'Funding workflow agent',
        prompt: 'Describe how this agent should support the funding workflow.',
      },
    ])
  }

  function removeAdvisoryHubAgent(agentId: string) {
    if (draft.advisoryHub.agents.length <= 1) return
    const remainingAgents = draft.advisoryHub.agents.filter(
      (agent) => agent.id !== agentId,
    )
    const replacementAgent = remainingAgents[0]
    if (!replacementAgent) return
    updateAdvisoryHubField('agents', remainingAgents)
    updateAdvisoryHubField(
      'sections',
      draft.advisoryHub.sections.map((section) =>
        section.agentId === agentId
          ? { ...section, agentId: replacementAgent.id }
          : section,
      ),
    )
  }

  function updateAdvisoryHubDocumentType<Key extends keyof AdvisoryHubDocumentTypeConfig>(
    documentTypeId: string,
    field: Key,
    value: AdvisoryHubDocumentTypeConfig[Key],
  ) {
    updateAdvisoryHubField(
      'documentTypes',
      draft.advisoryHub.documentTypes.map((documentType) =>
        documentType.id === documentTypeId
          ? { ...documentType, [field]: value }
          : documentType,
      ),
    )
  }

  function addAdvisoryHubDocumentType() {
    updateAdvisoryHubField('documentTypes', [
      ...draft.advisoryHub.documentTypes,
      {
        id: `custom-document-type-${Date.now()}`,
        name: 'New document type',
        prompt: 'Describe how this document type should support the funding workflow.',
      },
    ])
  }

  function removeAdvisoryHubDocumentType(documentTypeId: string) {
    if (draft.advisoryHub.documentTypes.length <= 1) return
    const remainingDocumentTypes = draft.advisoryHub.documentTypes.filter(
      (documentType) => documentType.id !== documentTypeId,
    )
    const replacementDocumentType = remainingDocumentTypes[0]
    if (!replacementDocumentType) return
    updateAdvisoryHubField('documentTypes', remainingDocumentTypes)
    updateAdvisoryHubField(
      'sections',
      draft.advisoryHub.sections.map((section) =>
        section.documentTypeId === documentTypeId
          ? { ...section, documentTypeId: replacementDocumentType.id }
          : section,
      ),
    )
  }

  function updateLegalField<Key extends keyof LegalDocumentConfig>(
    documentKey: 'privacyPolicy' | 'termsOfService',
    field: Key,
    value: LegalDocumentConfig[Key],
  ) {
    setDraft((current) => ({
      ...current,
      [documentKey]: {
        ...current[documentKey],
        [field]: value,
      },
    }))
    setSaved(false)
  }

  function updateLandingHeaderField<Key extends keyof LandingHeaderConfig>(
    field: Key,
    value: LandingHeaderConfig[Key],
  ) {
    setDraft((current) => ({
      ...current,
      landingPage: {
        ...current.landingPage,
        header: {
          ...current.landingPage.header,
          [field]: value,
        },
      },
    }))
    setSaved(false)
  }

  function updateLandingNavItem(
    index: number,
    field: 'label' | 'href',
    value: string,
  ) {
    setDraft((current) => ({
      ...current,
      landingPage: {
        ...current.landingPage,
        header: {
          ...current.landingPage.header,
          navItems: current.landingPage.header.navItems.map((item, itemIndex) =>
            itemIndex === index ? { ...item, [field]: value } : item,
          ),
        },
      },
    }))
    setSaved(false)
  }

  function addLandingNavItem() {
    setDraft((current) => ({
      ...current,
      landingPage: {
        ...current.landingPage,
        header: {
          ...current.landingPage.header,
          navItems: [...current.landingPage.header.navItems, createLandingNavItem()],
        },
      },
    }))
    setSaved(false)
  }

  function removeLandingNavItem(index: number) {
    setDraft((current) => ({
      ...current,
      landingPage: {
        ...current.landingPage,
        header: {
          ...current.landingPage.header,
          navItems: current.landingPage.header.navItems.filter(
            (_, itemIndex) => itemIndex !== index,
          ),
        },
      },
    }))
    setSaved(false)
  }

  function updateLandingContentField<Key extends keyof LandingContentConfig>(
    field: Key,
    value: LandingContentConfig[Key],
  ) {
    setDraft((current) => ({
      ...current,
      landingPage: {
        ...current.landingPage,
        content: {
          ...current.landingPage.content,
          [field]: value,
        },
      },
    }))
    setSaved(false)
  }

  function updateLandingFooterField<Key extends keyof LandingFooterConfig>(
    field: Key,
    value: LandingFooterConfig[Key],
  ) {
    setDraft((current) => ({
      ...current,
      landingPage: {
        ...current.landingPage,
        footer: {
          ...current.landingPage.footer,
          [field]: value,
        },
      },
    }))
    setSaved(false)
  }

  function updateLandingFooterNavItem(
    section: 'sitemapItems' | 'platformItems',
    index: number,
    field: 'label' | 'href',
    value: string,
  ) {
    setDraft((current) => ({
      ...current,
      landingPage: {
        ...current.landingPage,
        footer: {
          ...current.landingPage.footer,
          [section]: current.landingPage.footer[section].map((item, itemIndex) =>
            itemIndex === index ? { ...item, [field]: value } : item,
          ),
        },
      },
    }))
    setSaved(false)
  }

  function addLandingFooterNavItem(section: 'sitemapItems' | 'platformItems') {
    setDraft((current) => ({
      ...current,
      landingPage: {
        ...current.landingPage,
        footer: {
          ...current.landingPage.footer,
          [section]: [
            ...current.landingPage.footer[section],
            createLandingFooterNavItem(
              section === 'sitemapItems' ? 'sitemap' : 'platform',
            ),
          ],
        },
      },
    }))
    setSaved(false)
  }

  function removeLandingFooterNavItem(
    section: 'sitemapItems' | 'platformItems',
    index: number,
  ) {
    setDraft((current) => ({
      ...current,
      landingPage: {
        ...current.landingPage,
        footer: {
          ...current.landingPage.footer,
          [section]: current.landingPage.footer[section].filter(
            (_, itemIndex) => itemIndex !== index,
          ),
        },
      },
    }))
    setSaved(false)
  }

  function updateLandingFooterLegalLink(
    field: 'privacyPolicy' | 'termsOfService',
    linkField: keyof LandingFooterLegalLinkConfig,
    value: string,
  ) {
    setDraft((current) => ({
      ...current,
      landingPage: {
        ...current.landingPage,
        footer: {
          ...current.landingPage.footer,
          [field]: {
            ...current.landingPage.footer[field],
            [linkField]: value,
          },
        },
      },
    }))
    setSaved(false)
  }

  function updateLandingProofItem(
    index: number,
    field: 'value' | 'label',
    value: string,
  ) {
    setDraft((current) => ({
      ...current,
      landingPage: {
        ...current.landingPage,
        content: {
          ...current.landingPage.content,
          proofItems: current.landingPage.content.proofItems.map((item, itemIndex) =>
            itemIndex === index ? { ...item, [field]: value } : item,
          ),
        },
      },
    }))
    setSaved(false)
  }

  function addLandingProofItem() {
    setDraft((current) => ({
      ...current,
      landingPage: {
        ...current.landingPage,
        content: {
          ...current.landingPage.content,
          proofItems: [
            ...current.landingPage.content.proofItems,
            createLandingProofItem(),
          ],
        },
      },
    }))
    setSaved(false)
  }

  function removeLandingProofItem(index: number) {
    setDraft((current) => ({
      ...current,
      landingPage: {
        ...current.landingPage,
        content: {
          ...current.landingPage.content,
          proofItems: current.landingPage.content.proofItems.filter(
            (_, itemIndex) => itemIndex !== index,
          ),
        },
      },
    }))
    setSaved(false)
  }

  function toggleAIModel(modelId: string, enabled: boolean) {
    setDraft((current) => {
      const model = current.ai.models.find((candidate) => candidate.id === modelId)
      if (!model || model.enabled === enabled) return current

      const nextModels = current.ai.models.map((candidate) =>
        candidate.id === modelId
          ? {
              ...candidate,
              enabled,
              connectionStatus: 'untested' as const,
              connectionError: '',
              lastTestedAt: '',
            }
          : candidate,
      )
      const nextEnabledModel = nextModels.find((candidate) => candidate.enabled)
      const currentDefault = nextModels.find(
        (candidate) => candidate.id === current.ai.defaultModel,
      )
      const nextDefault =
        currentDefault?.enabled
          ? current.ai.defaultModel
          : nextEnabledModel?.id ?? ''

      return {
        ...current,
        ai: {
          ...current.ai,
          defaultModel: nextDefault,
          models: nextModels,
        },
      }
    })
    setSaved(false)
    setTestingAIModels({})
  }

  function updateDataSource(
    field: keyof FundingDataSource,
    value: FundingDataSource[keyof FundingDataSource],
  ) {
    setSourceEditor((current) => (current ? { ...current, [field]: value } : current))
    setSourceNotice('')
  }

  function updateDataSourceProvider(provider: FundingDataSourceProvider) {
    setSourceEditor((current) =>
      current
        ? {
            ...current,
            provider,
            fieldMapping:
              provider === 'json-file'
                ? { ...defaultJsonFundingProgramFieldMapping }
                : { ...defaultFundingProgramFieldMapping },
          }
        : current,
    )
    setSourceNotice('')
  }

  function updateFundingFieldMapping(field: string, value: string) {
    setSourceEditor((current) =>
      current
        ? {
            ...current,
            fieldMapping: {
              ...getFundingProgramFieldMapping(current),
              [field]: value,
            },
          }
        : current,
    )
    setSourceNotice('')
  }

  async function selectJsonDataSourceFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file || !sourceEditor) return

    try {
      const content = await file.text()
      const catalog = parseJsonFundingCatalog(JSON.parse(content))
      setJsonFiles((current) => ({ ...current, [sourceEditor.id]: file }))
      setSourceEditor((current) =>
        current
          ? {
              ...current,
              jsonFileName: file.name,
              jsonSourceVersion: '',
              language: catalog.language ?? 'en-CA',
            }
          : current,
      )
      setSourceNotice(
        `${file.name} is valid and contains ${catalog.records.length} ${catalog.category.toLowerCase()} records.`,
      )
    } catch (error) {
      event.target.value = ''
      setSourceNotice(
        error instanceof Error ? error.message : 'The JSON file could not be read.',
      )
    }
  }

  function saveDataSource() {
    if (!sourceEditor?.name.trim()) {
      setSourceNotice('Add a name before saving this data source.')
      return
    }
    if (sourceEditor.provider === 'json-file' && sourceEditor.module !== 'grants-loans') {
      setSourceNotice('JSON File sources can only target Grants & Loans.')
      return
    }

    const sourceExists = draft.dataSources.some(
      (source) => source.id === sourceEditor.id,
    )
    const nextSources = sourceExists
      ? draft.dataSources.map((source) =>
          source.id === sourceEditor.id ? sourceEditor : source,
        )
      : [...draft.dataSources, sourceEditor]

    setDraft((current) => ({ ...current, dataSources: nextSources }))
    setSourceEditor(null)
    setSaved(false)
    setSourceNotice(`${sourceEditor.name} saved. Publish configuration to keep it.`)
  }

  function toggleDataSource(sourceId: string) {
    setDraft((current) => ({
      ...current,
      dataSources: current.dataSources.map((source) =>
        source.id === sourceId ? { ...source, enabled: !source.enabled } : source,
      ),
    }))
    setSaved(false)
  }

  async function deleteDataSource(sourceId: string) {
    const source = draft.dataSources.find((item) => item.id === sourceId)
    if (source?.provider === 'json-file') {
      try {
        await archiveJsonFundingProgramsViaApi(sourceId)
      } catch (error) {
        setSourceNotice(
          error instanceof Error
            ? error.message
            : 'The JSON funding records could not be archived.',
        )
        return
      }
    }
    setDraft((current) => ({
      ...current,
      dataSources: current.dataSources.filter((item) => item.id !== sourceId),
    }))
    removeSyncedFundingPrograms(sourceId)
    removeSyncedResourceRecords(sourceId)
    setJsonFiles((current) => {
      const next = { ...current }
      delete next[sourceId]
      return next
    })
    setDeleteSourceId('')
    setSaved(false)
    setSourceNotice(`${source?.name ?? 'Data source'} removed.`)
  }

  async function syncDataSource(source: FundingDataSource) {
    setSyncingSourceId(source.id)
    setSourceNotice('')

    try {
      let recordCount = 0
      if (source.module === 'grants-loans') {
        if (source.provider === 'json-file') {
          const file = jsonFiles[source.id]
          let content = ''
          if (file) {
            content = await file.text()
          } else if (source.jsonFileName) {
            const response = await fetch(`/${encodeURIComponent(source.jsonFileName)}`)
            if (!response.ok) {
              throw new Error(`The bundled JSON file could not be loaded (${response.status}).`)
            }
            content = await response.text()
          } else {
            throw new Error('Select the JSON file again before syncing this source.')
          }
          const catalog = parseJsonFundingCatalog(JSON.parse(content))
          const result = await importJsonFundingProgramsViaApi({
            sourceId: source.id,
            sourceName: source.name,
            sourceVersion: source.jsonSourceVersion,
            sourceUrl: catalog.sourceUrl,
            category: catalog.category,
            language: source.language ?? catalog.language ?? 'en-CA',
            records: catalog.records,
            fieldMapping: getFundingProgramFieldMapping(source),
          })
          saveSyncedFundingPrograms(source.id, result.programs)
          recordCount = result.programs.length
          setDraft((current) => ({
            ...current,
            dataSources: current.dataSources.map((item) =>
              item.id === source.id
                ? { ...item, jsonSourceVersion: result.sourceVersion }
                : item,
            ),
          }))
          setSourceNotice(
            `${result.imported} new, ${result.updated} updated, and ${result.archived} archived records imported from ${source.name}.`,
          )
        } else {
          const programs = await syncFundingDataSource(source)
          saveSyncedFundingPrograms(source.id, programs)
          recordCount = programs.length
        }
      } else {
        const resources = await syncResourceDataSource(source)
        saveSyncedResourceRecords(source.id, resources)
        recordCount = resources.length
      }
      const syncedAt = new Intl.DateTimeFormat('en-CA', {
        dateStyle: 'medium',
        timeStyle: 'short',
      }).format(new Date())

      setDraft((current) => ({
        ...current,
        dataSources: current.dataSources.map((item) =>
          item.id === source.id
            ? {
                ...item,
                status: 'connected',
                recordCount,
                lastSyncedAt: syncedAt,
                lastError: '',
              }
            : item,
        ),
      }))
      setSaved(false)
      setSourceNotice(
        `${recordCount} records synced to ${dataSourceModuleLabels[source.module]} from ${source.name}.`,
      )
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Sync failed.'
      setDraft((current) => ({
        ...current,
        dataSources: current.dataSources.map((item) =>
          item.id === source.id
            ? { ...item, status: 'error', lastError: message }
            : item,
        ),
      }))
      setSourceNotice(message)
    } finally {
      setSyncingSourceId('')
    }
  }

  function openAIModelChat(model: AIModelConfig) {
    setAIChatModel(model)
    setAIChatInput('')
    setAIChatMessages([
      {
        role: 'assistant',
        content: `Connection chat ready for ${model.name || model.id}. Send a message to make a real request.`,
      },
    ])
  }

  function persistAIModelConnectionResult(
    modelId: string,
    status: AIModelConfig['connectionStatus'],
    connectionError: string,
  ) {
    const lastTestedAt = new Date().toISOString()
    const nextDraft = {
      ...draft,
      ai: {
        ...draft.ai,
        models: draft.ai.models.map((candidate) =>
          candidate.id === modelId
            ? {
                ...candidate,
                connectionStatus: status,
                connectionError,
                lastTestedAt,
              }
            : candidate,
        ),
      },
    }
    setDraft(nextDraft)
    updateConfig(nextDraft)
    setSaved(true)
    setAIChatModel((current) =>
      current?.id === modelId
        ? { ...current, connectionStatus: status, connectionError, lastTestedAt }
        : current,
    )
  }

  async function sendAIChatMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const model = aiChatModel
    const message = aiChatInput.trim()
    if (!model || !message || aiChatSending) return

    setAIChatMessages((current) => [...current, { role: 'user', content: message }])
    setAIChatInput('')
    setAIChatSending(true)
    setTestingAIModels((current) => ({ ...current, [model.id]: true }))
    let nextStatus: AIModelConfig['connectionStatus'] = 'connected'
    let connectionError = ''

    try {
      const pythonBackendBaseUrl =
        (import.meta.env.VITE_BUSINESS_PLAN_API_URL as string | undefined)?.replace(/\/$/u, '') ||
        '/ai-api'
      const controller = new AbortController()
      const timeout = window.setTimeout(() => controller.abort(), 15000)

      try {
        const response = await fetch(`${pythonBackendBaseUrl}/api/ai/test-connection`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...getEnvironmentModeHeaders(),
          },
          credentials: 'include',
          body: JSON.stringify({
            model_name: model.id,
            provider_id: model.providerId,
            url: getAIModelEndpoint(model),
            temperature: Number.isFinite(Number.parseFloat(model.temperature))
              ? Number.parseFloat(model.temperature)
              : 0.2,
            max_tokens: Number.isFinite(Number.parseInt(model.maxTokens, 10))
              ? Number.parseInt(model.maxTokens, 10)
              : 1024,
            reasoning_enabled: model.reasoningEnabled,
            message,
          }),
          signal: controller.signal,
        })
        const responseText = await response.text()

        if (!response.ok) {
          let detail = responseText.replace(/\s+/gu, ' ').trim().slice(0, 180)
          try {
            const errorBody = JSON.parse(responseText) as { detail?: string }
            detail = errorBody.detail || detail
          } catch {
            // Keep the raw response when the backend does not return JSON.
          }
          throw new Error(
            `HTTP ${response.status}${detail ? `: ${detail}` : ''}`,
          )
        }

        const result = JSON.parse(responseText) as { response?: string }
        setAIChatMessages((current) => [
          ...current,
          { role: 'assistant', content: formatAIChatResponse(result.response || responseText) },
        ])
      } finally {
        window.clearTimeout(timeout)
      }
    } catch (error) {
      nextStatus = 'failed'
      connectionError =
        error instanceof DOMException && error.name === 'AbortError'
          ? 'Request timed out after 15 seconds.'
          : error instanceof TypeError && error.message === 'Failed to fetch'
            ? 'Python backend is unavailable at http://localhost:8010. Start it with npm run dev:python.'
          : error instanceof Error
            ? error.message
            : 'Connection request failed.'
      setAIChatMessages((current) => [
        ...current,
        { role: 'error', content: connectionError },
      ])
    }

    persistAIModelConnectionResult(model.id, nextStatus, connectionError)
    setTestingAIModels((current) => {
      const next = { ...current }
      delete next[model.id]
      return next
    })
    setAIChatSending(false)
  }

  function validatePaymentGatewayConfig() {
    if (!draft.payments.enabled) {
      setPaymentNotice('Enable payments before validating the gateway configuration.')
      return
    }

    if (draft.payments.provider === 'manual') {
      setPaymentNotice(
        'Manual invoicing is active. No gateway secrets are required.',
      )
      return
    }

    const activeSecretReference = draft.payments.testMode
      ? draft.payments.testSecretKeyReference
      : draft.payments.liveSecretKeyReference
    const activePublishableKey = draft.payments.testMode
      ? draft.payments.testPublishableKeyReference
      : draft.payments.livePublishableKeyReference
    const activeModeLabel = draft.payments.testMode ? 'Dev' : 'Live'

    if (!activeSecretReference.trim()) {
      setPaymentNotice(
        `${activeModeLabel} secret key is required for ${draft.payments.provider}.`,
      )
      return
    }

    if (!activePublishableKey.trim()) {
      setPaymentNotice(
        `${activeModeLabel} publishable key is required for ${draft.payments.provider}.`,
      )
      return
    }

    setPaymentNotice(
      `${draft.payments.provider} is configured in ${
        draft.payments.testMode ? 'test' : 'live'
      } mode. ${
        isEnvironmentReference(activeSecretReference)
          ? `Secret key source: ${activeSecretReference}. `
          : 'Secret key is present. '
      }${
        isEnvironmentReference(activePublishableKey)
          ? `Publishable key source: ${activePublishableKey}.`
          : 'Publishable key is present.'
      }`,
    )
  }

  async function saveSettings(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSaved(false)
    setSettingsNotice('')
    try {
      let activeEnvironmentMode = getClientEnvironmentMode()
      try {
        const runtimeResponse = await fetch('/api/runtime/environment', {
          credentials: 'include',
        })
        if (runtimeResponse.ok) {
          const runtime = (await runtimeResponse.json()) as {
            activeEnvironmentMode?: unknown
            environmentMode?: unknown
          }
          const serverMode = runtime.activeEnvironmentMode ?? runtime.environmentMode
          activeEnvironmentMode = serverMode === 'live' ? 'live' : 'test'
        }
      } catch {
        // Keep the cached mode if runtime status is temporarily unavailable.
      }

      const requestedEnvironmentMode = draft.environmentMode
      const activeConfig =
        requestedEnvironmentMode === activeEnvironmentMode
          ? draft
          : { ...draft, environmentMode: activeEnvironmentMode }
      const persistenceMode = await persistPersistentItem(
        platformConfigStorageKey,
        JSON.stringify(sanitizePlatformConfigForPersistence(draft)),
      )
      // Keep the browser cache aligned with the mode actually enforced by the
      // server. The requested mode remains in shared config until restart.
      updateConfigLocally(activeConfig)
      setDraft(activeConfig)

      const authSecrets: Record<string, string> = {}
      const googleClientSecret = draft.authentication.googleOAuth.clientSecret.trim()
      const smtpPassword = draft.authentication.smtp.password.trim()
      if (googleClientSecret && googleClientSecret !== secureConfigValuePlaceholder) {
        authSecrets.googleClientSecret = googleClientSecret
      }
      if (smtpPassword && smtpPassword !== secureConfigValuePlaceholder) {
        authSecrets.smtpPassword = smtpPassword
      }
      if (Object.keys(authSecrets).length > 0) {
        const response = await fetch('/api/platform/auth-secrets', {
          method: 'POST',
          credentials: 'include',
          headers: {
            'content-type': 'application/json',
            ...getEnvironmentModeHeaders(),
          },
          body: JSON.stringify(authSecrets),
        })
        const payload = (await response.json().catch(() => null)) as {
          message?: string
        } | null
        if (!response.ok) {
          throw new Error(payload?.message ?? 'Authentication secrets could not be saved.')
        }
      }

      setLocale(draft.language)
      setSaved(true)
      setSettingsNotice(
        requestedEnvironmentMode !== activeEnvironmentMode
          ? `Settings saved to ${persistenceMode === 'database' ? 'the database' : 'local cache'}. Restart the server after updating OPENBCON_ENVIRONMENT_MODE to apply the requested ${requestedEnvironmentMode === 'live' ? 'Live' : 'Test'} Mode.`
          : `Settings saved to ${persistenceMode === 'database' ? 'the database' : 'local cache'}.`,
      )
    } catch (error) {
      setSettingsNotice(
        error instanceof Error ? error.message : 'Settings could not be saved.',
      )
    }
  }

  function restoreDefaults() {
    resetConfig()
    setDraft(config)
    window.location.reload()
  }

  async function checkForUpdates() {
    setUpdateCheck((current) => ({
      ...current,
      status: 'checking',
      error: '',
    }))

    try {
      const response = await fetch(
        `/api/updates?currentCommit=${encodeURIComponent(updateCheck.currentCommit)}`,
        { credentials: 'include', headers: getEnvironmentModeHeaders() },
      )
      const payload = (await response.json()) as Partial<UpdateCheckState> & {
        message?: string
        updateAvailable?: boolean | null
      }
      if (!response.ok) {
        throw new Error(payload.message || 'The update check failed.')
      }

      setUpdateCheck({
        status:
          payload.updateAvailable === true
            ? 'available'
            : payload.updateAvailable === false
              ? 'current'
              : 'unknown',
        currentCommit: payload.currentCommit || updateCheck.currentCommit,
        latestShortCommit: payload.latestShortCommit || '',
        latestMessage: payload.latestMessage || '',
        latestUrl: payload.latestUrl || '',
        latestCommittedAt: payload.latestCommittedAt || '',
        error: '',
      })
    } catch (error) {
      setUpdateCheck((current) => ({
        ...current,
        status: 'error',
        error: error instanceof Error ? error.message : 'The update check failed.',
      }))
    }
  }

  return (
    <div className="admin-shell">
      <aside className="admin-rail">
        <Link className="admin-brand" to="/">
          <strong>Admin Console</strong>
        </Link>
        <nav>
          <a href="#general">General</a>
          <a href="#google-oauth">Google OAuth</a>
          <a href="#smtp">SMTP Email</a>
          <a href="#users">Users</a>
          <a href="#notification-bar">Notification bar</a>
          <a href="#branding">Branding</a>
          <a href="#landing-page">Landing Page</a>
          <a href="#modules">Modules</a>
          <a href="#data-sources">Data Sources</a>
          <a href="#payments">Payments</a>
          <a href="#pricing">Pricing</a>
          <a href="#revenue">Revenue</a>
          <a href="#advisory-hub">Strategic Report - Sections</a>
          <a href="#layouts">Layouts</a>
          <a href="#advisory-hub-document-types">Strategic Report - Document Types</a>
          <a href="#advisory-hub-agents">Strategic Report - Agents</a>
          <a href="#ai-models">AI Models</a>
          <a href="#legal">Legal</a>
          {!commercialLicenseUnlocked && <a href="#licensing">Licensing</a>}
          <a href="#updates">Updates</a>
        </nav>
        <Link className="admin-back-link" to="/dashboard">
          Back to workspace
        </Link>
      </aside>

      <main className="admin-main">
        <form className="admin-form" onSubmit={saveSettings}>
          <section className="admin-card" id="general">
            <div className="admin-section-copy">
              <p className="admin-section-number">01</p>
              <h2>General</h2>
              <p>Identity and support details shown across the application.</p>
            </div>
            <div className="admin-fields">
              <label>
                <span>Platform name</span>
                <input
                  value={draft.platformName}
                  onChange={(event) => updateField('platformName', event.target.value)}
                />
              </label>
              <label className="admin-field-wide">
                <span>Support email</span>
                <input
                  type="email"
                  value={draft.supportEmail}
                  onChange={(event) => updateField('supportEmail', event.target.value)}
                />
              </label>
              <label>
                <span>Language</span>
                <select
                  value={draft.language}
                  onChange={(event) => updateField('language', normalizeLocale(event.target.value))}
                >
                  {languageOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
                <small>Default language for the platform. Users can choose their own language in Settings.</small>
              </label>
              <div className="admin-brand-upload admin-field-wide">
                <span>Platform logo</span>
                <div className="admin-brand-upload-row">
                  <div className="admin-brand-upload-preview" aria-hidden="true">
                    {draft.platformLogo ? (
                      <img src={draft.platformLogo} alt="" />
                    ) : (
                      platformInitial
                    )}
                  </div>
                  <div className="admin-brand-upload-actions">
                    <label className="admin-brand-upload-button">
                      <input
                        type="file"
                        accept="image/png,image/jpeg,image/webp,image/svg+xml"
                        onChange={updatePlatformLogo}
                      />
                      <span>Upload logo</span>
                    </label>
                    {draft.platformLogo ? (
                      <button
                        type="button"
                        className="admin-button-secondary"
                        onClick={() => updateField('platformLogo', '')}
                      >
                        Remove logo
                      </button>
                    ) : null}
                    <small>
                      PNG, JPG, SVG, or WebP. This demo stores the logo in local
                      browser configuration and updates the full workspace branding.
                    </small>
                    <strong>{platformName}</strong>
                  </div>
                </div>
              </div>
              <div className="admin-environment-mode admin-field-wide">
                <div className="admin-environment-mode-header">
                  <div>
                    <span>Mode Switch</span>
                    <small>Choose whether this workspace is configured for testing or production use.</small>
                  </div>
                  <div
                    className={`admin-environment-mode-switch ${draft.environmentMode === 'live' ? 'is-live' : 'is-test'}`}
                    role="radiogroup"
                    aria-label="Mode Switch"
                  >
                    <button
                      type="button"
                      className={draft.environmentMode === 'test' ? 'is-active' : ''}
                      aria-checked={draft.environmentMode === 'test'}
                      role="radio"
                      onClick={() => updateField('environmentMode', 'test')}
                    >
                      Test Mode
                    </button>
                    <button
                      type="button"
                      className={draft.environmentMode === 'live' ? 'is-active' : ''}
                      aria-checked={draft.environmentMode === 'live'}
                      role="radio"
                      onClick={() => updateField('environmentMode', 'live')}
                    >
                      Live Mode
                    </button>
                  </div>
                </div>
                <div className="admin-environment-mode-notice" role="note">
                  <strong>
                    {draft.environmentMode === 'test' ? 'Test Mode is selected' : 'Live Mode is selected'}
                  </strong>
                  <p>
                    Test mode uses mock data, does not call an LLM, writes to the test database,
                    and uses test payment credentials. Live mode uses the real data path, calls
                    the configured LLM, writes to the live database, and uses live payment credentials.
                  </p>
                </div>
              </div>
            </div>
          </section>

          <section className="admin-card admin-management-card" id="google-oauth">
            <div className="admin-section-copy">
              <p className="admin-section-number">02</p>
              <h2>Google OAuth</h2>
              <p>Configure Google sign-in without exposing the client secret to the browser.</p>
            </div>
            <div className="admin-management-content">
              <div className="admin-fields">
                <label className="admin-checkbox-row admin-field-wide">
                  <input
                    type="checkbox"
                    checked={draft.authentication.googleOAuth.enabled}
                    onChange={(event) =>
                      updateAuthenticationField('googleOAuth', {
                        ...draft.authentication.googleOAuth,
                        enabled: event.target.checked,
                      })
                    }
                  />
                  <span>Enable Google OAuth sign-in</span>
                </label>
                <label>
                  <span>Client ID</span>
                  <input
                    value={draft.authentication.googleOAuth.clientId}
                    onChange={(event) =>
                      updateAuthenticationField('googleOAuth', {
                        ...draft.authentication.googleOAuth,
                        clientId: event.target.value,
                      })
                    }
                    placeholder="1234567890.apps.googleusercontent.com"
                  />
                </label>
                <label>
                  <span>Client secret</span>
                  <input
                    type="password"
                    value={
                      draft.authentication.googleOAuth.clientSecret === secureConfigValuePlaceholder
                        ? ''
                        : draft.authentication.googleOAuth.clientSecret
                    }
                    onChange={(event) =>
                      updateAuthenticationField('googleOAuth', {
                        ...draft.authentication.googleOAuth,
                        clientSecret: event.target.value,
                      })
                    }
                    placeholder={
                      draft.authentication.googleOAuth.clientSecret === secureConfigValuePlaceholder
                        ? 'Stored securely; enter to replace'
                        : 'Google client secret'
                    }
                  />
                </label>
                <label className="admin-field-wide">
                  <span>Redirect URI</span>
                  <input
                    type="url"
                    value={draft.authentication.googleOAuth.redirectUri}
                    onChange={(event) =>
                      updateAuthenticationField('googleOAuth', {
                        ...draft.authentication.googleOAuth,
                        redirectUri: event.target.value,
                      })
                    }
                    placeholder="https://open.example.com/api/auth/google/callback"
                  />
                  <small>
                    Add this exact URI to the authorized redirect URIs in Google Cloud Console.
                  </small>
                </label>
              </div>
            </div>
          </section>

          <section className="admin-card admin-management-card" id="smtp">
            <div className="admin-section-copy">
              <p className="admin-section-number">03</p>
              <h2>SMTP Email</h2>
              <p>Configure delivery for verification and password-reset emails.</p>
            </div>
            <div className="admin-management-content">
              <div className="admin-fields">
                <label className="admin-checkbox-row admin-field-wide">
                  <input
                    type="checkbox"
                    checked={draft.authentication.smtp.enabled}
                    onChange={(event) =>
                      updateAuthenticationField('smtp', {
                        ...draft.authentication.smtp,
                        enabled: event.target.checked,
                      })
                    }
                  />
                  <span>Enable SMTP email delivery</span>
                </label>
                <label>
                  <span>SMTP host</span>
                  <input
                    value={draft.authentication.smtp.host}
                    onChange={(event) =>
                      updateAuthenticationField('smtp', {
                        ...draft.authentication.smtp,
                        host: event.target.value,
                      })
                    }
                    placeholder="smtp.example.com"
                  />
                </label>
                <label>
                  <span>SMTP port</span>
                  <input
                    type="number"
                    min="1"
                    max="65535"
                    value={draft.authentication.smtp.port}
                    onChange={(event) =>
                      updateAuthenticationField('smtp', {
                        ...draft.authentication.smtp,
                        port: event.target.value,
                      })
                    }
                  />
                </label>
                <label>
                  <span>SMTP username</span>
                  <input
                    value={draft.authentication.smtp.username}
                    onChange={(event) =>
                      updateAuthenticationField('smtp', {
                        ...draft.authentication.smtp,
                        username: event.target.value,
                      })
                    }
                    placeholder="mailer@example.com"
                  />
                </label>
                <label>
                  <span>SMTP password</span>
                  <input
                    type="password"
                    value={
                      draft.authentication.smtp.password === secureConfigValuePlaceholder
                        ? ''
                        : draft.authentication.smtp.password
                    }
                    onChange={(event) =>
                      updateAuthenticationField('smtp', {
                        ...draft.authentication.smtp,
                        password: event.target.value,
                      })
                    }
                    placeholder={
                      draft.authentication.smtp.password === secureConfigValuePlaceholder
                        ? 'Stored securely; enter to replace'
                        : 'SMTP password or app password'
                    }
                  />
                </label>
                <label>
                  <span>From address</span>
                  <input
                    type="email"
                    value={draft.authentication.smtp.from}
                    onChange={(event) =>
                      updateAuthenticationField('smtp', {
                        ...draft.authentication.smtp,
                        from: event.target.value,
                      })
                    }
                    placeholder="OpenBcon <no-reply@example.com>"
                  />
                </label>
                <label className="admin-checkbox-row">
                  <input
                    type="checkbox"
                    checked={draft.authentication.smtp.secure}
                    onChange={(event) =>
                      updateAuthenticationField('smtp', {
                        ...draft.authentication.smtp,
                        secure: event.target.checked,
                      })
                    }
                  />
                  <span>Use TLS/SSL</span>
                </label>
              </div>
              <p className="admin-management-notice">
                Leave SMTP disabled to use the console email provider in development and test mode.
              </p>
            </div>
          </section>

          <section className="admin-card" id="branding">
            <div className="admin-section-copy">
              <p className="admin-section-number">02</p>
              <h2>Branding</h2>
              <p>Customize public messaging and the core application palette.</p>
            </div>
            <div className="admin-fields">
              <label>
                <span>Primary color</span>
                <input
                  type="color"
                  value={draft.primaryColor}
                  onChange={(event) => updateField('primaryColor', event.target.value)}
                />
              </label>
              <label>
                <span>Sidebar color</span>
                <input
                  type="color"
                  value={draft.sidebarColor}
                  onChange={(event) => updateField('sidebarColor', event.target.value)}
                />
              </label>
            </div>
          </section>

          <section className="admin-card" id="landing-page">
            <div className="admin-section-copy">
              <p className="admin-section-number">03</p>
              <h2>Landing page</h2>
              <p>
                Configure the public homepage in three layers: header, content,
                and footer.
              </p>
            </div>
            <div className="admin-landing-grid">
              <article className="admin-landing-panel">
                <div className="admin-landing-panel-copy">
                  <strong>Header</strong>
                  <p>Control navigation items and the top-right access action.</p>
                </div>
                <div className="admin-fields">
                  <div className="admin-field-wide">
                    <strong className="admin-landing-section-title">Navigation</strong>
                    <div className="admin-landing-nav-list">
                      {draft.landingPage.header.navItems.map((item, index) => (
                        <div className="admin-landing-nav-card" key={item.id}>
                          <strong>Item {index + 1}</strong>
                          <div className="admin-fields">
                            <label>
                              <span>Name</span>
                              <input
                                value={item.label}
                                onChange={(event) =>
                                  updateLandingNavItem(
                                    index,
                                    'label',
                                    event.target.value,
                                  )
                                }
                              />
                            </label>
                            <label>
                              <span>Link</span>
                              <input
                                value={item.href}
                                onChange={(event) =>
                                  updateLandingNavItem(
                                    index,
                                    'href',
                                    event.target.value,
                                  )
                                }
                              />
                            </label>
                          </div>
                          <button
                            className="admin-button-secondary"
                            type="button"
                            onClick={() => removeLandingNavItem(index)}
                          >
                            Delete item
                          </button>
                        </div>
                      ))}
                    </div>
                    <button
                      className="admin-button-secondary"
                      type="button"
                      onClick={addLandingNavItem}
                    >
                      Add navigation item
                    </button>
                  </div>
                  <label>
                    <span>Signed-out CTA</span>
                    <input
                      value={draft.landingPage.header.signInLabel}
                      onChange={(event) =>
                        updateLandingHeaderField('signInLabel', event.target.value)
                      }
                    />
                  </label>
                  <label>
                    <span>Signed-in CTA</span>
                    <input
                      value={draft.landingPage.header.dashboardLabel}
                      onChange={(event) =>
                        updateLandingHeaderField('dashboardLabel', event.target.value)
                      }
                    />
                  </label>
                </div>
              </article>

              <article className="admin-landing-panel">
                <div className="admin-landing-panel-copy">
                  <strong>Content</strong>
                  <p>
                    Manage hero messaging, section copy, and proof points shown
                    on the homepage.
                  </p>
                </div>
                <div className="admin-landing-nav-list">
                  <div className="admin-landing-nav-card">
                    <strong className="admin-landing-section-title">Hero</strong>
                    <div className="admin-fields">
                      <label className="admin-field-wide">
                        <span>Eyebrow</span>
                        <input
                          value={draft.landingPage.content.heroEyebrow}
                          onChange={(event) =>
                            updateLandingContentField('heroEyebrow', event.target.value)
                          }
                        />
                      </label>
                      <label className="admin-field-wide">
                        <span>Headline</span>
                        <input
                          value={draft.landingPage.content.headline}
                          onChange={(event) =>
                            updateLandingContentField('headline', event.target.value)
                          }
                        />
                      </label>
                      <label className="admin-field-wide">
                        <span>Subheadline</span>
                        <textarea
                          value={draft.landingPage.content.subheadline}
                          onChange={(event) =>
                            updateLandingContentField(
                              'subheadline',
                              event.target.value,
                            )
                          }
                        />
                      </label>
                    </div>
                  </div>

                  <div className="admin-landing-nav-card">
                    <strong className="admin-landing-section-title">Call to actions</strong>
                    <div className="admin-fields">
                      <label>
                        <span>Primary CTA label</span>
                        <input
                          value={draft.landingPage.content.primaryCtaLabel}
                          onChange={(event) =>
                            updateLandingContentField(
                              'primaryCtaLabel',
                              event.target.value,
                            )
                          }
                        />
                      </label>
                      <label>
                        <span>Secondary CTA label</span>
                        <input
                          value={draft.landingPage.content.secondaryCtaLabel}
                          onChange={(event) =>
                            updateLandingContentField(
                              'secondaryCtaLabel',
                              event.target.value,
                            )
                          }
                        />
                      </label>
                      <label>
                        <span>Admin CTA label</span>
                        <input
                          value={draft.landingPage.content.adminCtaLabel}
                          onChange={(event) =>
                            updateLandingContentField(
                              'adminCtaLabel',
                              event.target.value,
                            )
                          }
                        />
                      </label>
                    </div>
                  </div>

                  <div className="admin-landing-nav-card">
                    <strong className="admin-landing-section-title">Features section</strong>
                    <div className="admin-fields">
                      <label>
                        <span>Eyebrow</span>
                        <input
                          value={draft.landingPage.content.featuresEyebrow}
                          onChange={(event) =>
                            updateLandingContentField(
                              'featuresEyebrow',
                              event.target.value,
                            )
                          }
                        />
                      </label>
                      <label className="admin-field-wide">
                        <span>Heading</span>
                        <input
                          value={draft.landingPage.content.featuresHeading}
                          onChange={(event) =>
                            updateLandingContentField(
                              'featuresHeading',
                              event.target.value,
                            )
                          }
                        />
                      </label>
                      <label className="admin-field-wide">
                        <span>Body</span>
                        <textarea
                          value={draft.landingPage.content.featuresBody}
                          onChange={(event) =>
                            updateLandingContentField(
                              'featuresBody',
                              event.target.value,
                            )
                          }
                        />
                      </label>
                    </div>
                  </div>

                  <div className="admin-landing-nav-card">
                    <strong className="admin-landing-section-title">Workflow section</strong>
                    <div className="admin-fields">
                      <label>
                        <span>Eyebrow</span>
                        <input
                          value={draft.landingPage.content.workflowEyebrow}
                          onChange={(event) =>
                            updateLandingContentField(
                              'workflowEyebrow',
                              event.target.value,
                            )
                          }
                        />
                      </label>
                      <label className="admin-field-wide">
                        <span>Heading</span>
                        <input
                          value={draft.landingPage.content.workflowHeading}
                          onChange={(event) =>
                            updateLandingContentField(
                              'workflowHeading',
                              event.target.value,
                            )
                          }
                        />
                      </label>
                    </div>
                  </div>

                  <div className="admin-landing-nav-card">
                    <strong className="admin-landing-section-title">Open source section</strong>
                    <div className="admin-fields">
                      <label>
                        <span>Eyebrow</span>
                        <input
                          value={draft.landingPage.content.openSourceEyebrow}
                          onChange={(event) =>
                            updateLandingContentField(
                              'openSourceEyebrow',
                              event.target.value,
                            )
                          }
                        />
                      </label>
                      <label className="admin-field-wide">
                        <span>Heading</span>
                        <input
                          value={draft.landingPage.content.openSourceHeading}
                          onChange={(event) =>
                            updateLandingContentField(
                              'openSourceHeading',
                              event.target.value,
                            )
                          }
                        />
                      </label>
                      <label className="admin-field-wide">
                        <span>Body</span>
                        <textarea
                          value={draft.landingPage.content.openSourceBody}
                          onChange={(event) =>
                            updateLandingContentField(
                              'openSourceBody',
                              event.target.value,
                            )
                          }
                        />
                      </label>
                    </div>
                  </div>

                  <div className="admin-landing-nav-card">
                    <strong className="admin-landing-section-title">Proof points</strong>
                    <div className="admin-landing-nav-list">
                      {draft.landingPage.content.proofItems.map((item, index) => (
                        <div
                          key={`${item.value}-${index}`}
                          className="admin-landing-nav-card"
                        >
                          <strong>Item {index + 1}</strong>
                          <div className="admin-fields">
                            <label>
                              <span>Value</span>
                              <input
                                value={item.value}
                                onChange={(event) =>
                                  updateLandingProofItem(
                                    index,
                                    'value',
                                    event.target.value,
                                  )
                                }
                              />
                            </label>
                            <label className="admin-field-wide">
                              <span>Label</span>
                              <input
                                value={item.label}
                                onChange={(event) =>
                                  updateLandingProofItem(
                                    index,
                                    'label',
                                    event.target.value,
                                  )
                                }
                              />
                            </label>
                          </div>
                          <button
                            className="admin-button-secondary"
                            type="button"
                            onClick={() => removeLandingProofItem(index)}
                          >
                            Delete item
                          </button>
                        </div>
                      ))}
                    </div>
                    <button
                      className="admin-button-secondary"
                      type="button"
                      onClick={addLandingProofItem}
                    >
                      Add proof item
                    </button>
                  </div>
                </div>
              </article>

              <article className="admin-landing-panel">
                <div className="admin-landing-panel-copy">
                  <strong>Footer</strong>
                  <p>
                    Edit the footer description, footer navigation, and legal
                    links.
                  </p>
                </div>
                <div className="admin-fields">
                  <label className="admin-field-wide">
                    <span>Footer description</span>
                    <textarea
                      value={draft.landingPage.footer.description}
                      onChange={(event) =>
                        updateLandingFooterField('description', event.target.value)
                      }
                    />
                  </label>
                  <div className="admin-field-wide">
                    <label>
                      <span>Sitemap title</span>
                      <input
                        value={draft.landingPage.footer.sitemapLabel}
                        onChange={(event) =>
                          updateLandingFooterField('sitemapLabel', event.target.value)
                        }
                      />
                    </label>
                    <strong className="admin-landing-section-title">Sitemap</strong>
                    <div className="admin-landing-nav-list">
                      {draft.landingPage.footer.sitemapItems.map((item, index) => (
                        <div className="admin-landing-nav-card" key={item.id}>
                          <strong>Item {index + 1}</strong>
                          <div className="admin-fields">
                            <label>
                              <span>Name</span>
                              <input
                                value={item.label}
                                onChange={(event) =>
                                  updateLandingFooterNavItem(
                                    'sitemapItems',
                                    index,
                                    'label',
                                    event.target.value,
                                  )
                                }
                              />
                            </label>
                            <label>
                              <span>Link</span>
                              <input
                                value={item.href}
                                onChange={(event) =>
                                  updateLandingFooterNavItem(
                                    'sitemapItems',
                                    index,
                                    'href',
                                    event.target.value,
                                  )
                                }
                              />
                            </label>
                          </div>
                          <button
                            className="admin-button-secondary"
                            type="button"
                            onClick={() =>
                              removeLandingFooterNavItem('sitemapItems', index)
                            }
                          >
                            Delete item
                          </button>
                        </div>
                      ))}
                    </div>
                    <button
                      className="admin-button-secondary"
                      type="button"
                      onClick={() => addLandingFooterNavItem('sitemapItems')}
                    >
                      Add sitemap item
                    </button>
                  </div>
                  <div className="admin-field-wide">
                    <label>
                      <span>Platform title</span>
                      <input
                        value={draft.landingPage.footer.platformLabel}
                        onChange={(event) =>
                          updateLandingFooterField('platformLabel', event.target.value)
                        }
                      />
                    </label>
                    <strong className="admin-landing-section-title">Platform</strong>
                    <div className="admin-landing-nav-list">
                      {draft.landingPage.footer.platformItems.map((item, index) => (
                        <div className="admin-landing-nav-card" key={item.id}>
                          <strong>Item {index + 1}</strong>
                          <div className="admin-fields">
                            <label>
                              <span>Name</span>
                              <input
                                value={item.label}
                                onChange={(event) =>
                                  updateLandingFooterNavItem(
                                    'platformItems',
                                    index,
                                    'label',
                                    event.target.value,
                                  )
                                }
                              />
                            </label>
                            <label>
                              <span>Link</span>
                              <input
                                value={item.href}
                                onChange={(event) =>
                                  updateLandingFooterNavItem(
                                    'platformItems',
                                    index,
                                    'href',
                                    event.target.value,
                                  )
                                }
                              />
                            </label>
                          </div>
                          <button
                            className="admin-button-secondary"
                            type="button"
                            onClick={() =>
                              removeLandingFooterNavItem('platformItems', index)
                            }
                          >
                            Delete item
                          </button>
                        </div>
                      ))}
                    </div>
                    <button
                      className="admin-button-secondary"
                      type="button"
                      onClick={() => addLandingFooterNavItem('platformItems')}
                    >
                      Add platform item
                    </button>
                  </div>
                  <div className="admin-field-wide">
                    <strong className="admin-landing-section-title">Legal links</strong>
                    <div className="admin-fields">
                      <label>
                        <span>Privacy policy label</span>
                        <input
                          value={draft.landingPage.footer.privacyPolicy.label}
                          onChange={(event) =>
                            updateLandingFooterLegalLink(
                              'privacyPolicy',
                              'label',
                              event.target.value,
                            )
                          }
                        />
                      </label>
                      <label>
                        <span>Privacy policy link</span>
                        <input
                          value={draft.landingPage.footer.privacyPolicy.href}
                          onChange={(event) =>
                            updateLandingFooterLegalLink(
                              'privacyPolicy',
                              'href',
                              event.target.value,
                            )
                          }
                        />
                      </label>
                      <label>
                        <span>Terms of service label</span>
                        <input
                          value={draft.landingPage.footer.termsOfService.label}
                          onChange={(event) =>
                            updateLandingFooterLegalLink(
                              'termsOfService',
                              'label',
                              event.target.value,
                            )
                          }
                        />
                      </label>
                      <label>
                        <span>Terms of service link</span>
                        <input
                          value={draft.landingPage.footer.termsOfService.href}
                          onChange={(event) =>
                            updateLandingFooterLegalLink(
                              'termsOfService',
                              'href',
                              event.target.value,
                            )
                          }
                        />
                      </label>
                    </div>
                  </div>
                </div>
                <div className="admin-landing-note">
                  OpenBcon attribution remains license-governed and cannot be
                  edited from this section.
                </div>
              </article>
            </div>
          </section>

          <section className="admin-card" id="modules">
            <div className="admin-section-copy">
              <p className="admin-section-number">04</p>
              <h2>Module access</h2>
              <p>Choose which product areas appear in the user workspace.</p>
            </div>
            <div className="admin-module-list">
              {moduleLabels.map((module) => (
                <label key={module.id} className="admin-module-row">
                  <span>
                    <small>{module.group}</small>
                    <strong>{module.label}</strong>
                  </span>
                  <input
                    type="checkbox"
                    checked={draft.modules[module.id]}
                    onChange={() => toggleModule(module.id)}
                  />
                </label>
              ))}
            </div>
          </section>

          <section className="admin-card admin-data-source-card" id="data-sources">
            <div className="admin-section-copy">
              <p className="admin-section-number">05</p>
              <h2>Data source management</h2>
              <p>
                Control the external catalogs behind funding programs, templates,
                social resources, and tools.
              </p>
            </div>
            <div className="admin-data-source-content">
              <div className="admin-data-source-toolbar">
                <div className="admin-data-source-filters">
                  <label>
                    <span className="sr-only">Search data sources</span>
                    <input
                      type="search"
                      value={sourceQuery}
                      onChange={(event) => setSourceQuery(event.target.value)}
                      placeholder="Search data sources"
                    />
                  </label>
                  <label>
                    <span className="sr-only">Filter data sources by module</span>
                    <select
                      value={sourceModuleFilter}
                      onChange={(event) =>
                        setSourceModuleFilter(
                          event.target.value as 'all' | DataSourceModule,
                        )
                      }
                    >
                      <option value="all">All modules</option>
                      {Object.entries(dataSourceModuleLabels).map(([id, label]) => (
                        <option key={id} value={id}>{label}</option>
                      ))}
                    </select>
                  </label>
                </div>
                <div>
                  <span>
                    {draft.dataSources.filter((source) => source.enabled).length} active
                    {' · '}
                    {draft.dataSources.length} total
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setSourceEditor(createFundingDataSource())
                      setSourceNotice('')
                    }}
                  >
                    Add data source
                  </button>
                </div>
              </div>

              {sourceNotice ? (
                <div className="admin-management-notice" role="status">
                  {sourceNotice}
                </div>
              ) : null}

              <div className="admin-data-source-list">
                {visibleDataSources.map((source) => (
                  <article key={source.id} className="admin-data-source-row">
                    <span
                      className={`admin-source-provider is-${source.provider}`}
                      role="img"
                      aria-label={source.isBuiltIn ? 'Built-in catalog' : dataSourceProviderLabels[source.provider]}
                      title={source.isBuiltIn ? 'Built-in catalog' : dataSourceProviderLabels[source.provider]}
                    >
                      {source.isBuiltIn
                        ? 'B'
                        : source.provider === 'google-sheets'
                        ? 'G'
                        : source.provider === 'airtable'
                          ? 'A'
                          : 'J'}
                    </span>
                    <div className="admin-source-identity">
                      <span>
                        <strong>{source.name}</strong>
                      </span>
                      <small>
                        {dataSourceModuleLabels[source.module]} · {source.frequency} sync
                      </small>
                      {source.lastError ? <b>{source.lastError}</b> : null}
                    </div>
                    <div className="admin-source-records">
                      <strong>{source.recordCount}</strong>
                      <small>records</small>
                    </div>
                    <div className="admin-source-status-bar">
                      <span className={`admin-source-activity is-${source.enabled ? 'active' : 'inactive'}`}>
                        <i />
                        {source.enabled ? 'Active' : 'Inactive'}
                      </span>
                    </div>
                    <label className="admin-source-toggle">
                      <span className="sr-only">Enable {source.name}</span>
                      <input
                        type="checkbox"
                        checked={source.enabled}
                        onChange={() => toggleDataSource(source.id)}
                      />
                    </label>
                    <div className="admin-source-actions">
                      <div className="admin-source-action-buttons">
                        <button
                          type="button"
                          disabled={source.isBuiltIn || syncingSourceId === source.id}
                          onClick={() => syncDataSource(source)}
                        >
                          {syncingSourceId === source.id ? 'Syncing…' : 'Sync'}
                        </button>
                        {source.isBuiltIn ? (
                          <span className="admin-source-built-in-note">Built-in catalog</span>
                        ) : (
                          <>
                            <button
                              type="button"
                              onClick={() => {
                                setSourceEditor({ ...source })
                                setSourceNotice('')
                              }}
                            >
                              Edit
                            </button>
                            {deleteSourceId === source.id ? (
                              <button
                                type="button"
                                className="is-danger"
                                onClick={() => deleteDataSource(source.id)}
                              >
                                Confirm
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={() => setDeleteSourceId(source.id)}
                              >
                                Delete
                              </button>
                            )}
                          </>
                        )}
                      </div>
                      <span className="admin-source-last-sync">
                        <small>Last sync</small>
                        {source.lastSyncedAt || 'Never'}
                      </span>
                    </div>
                  </article>
                ))}
              </div>

              {visibleDataSources.length === 0 ? (
                <div className="admin-source-empty">
                  <strong>No matching data sources</strong>
                  <p>Clear the search or add a new Google Sheets, Airtable, or JSON File source.</p>
                </div>
              ) : null}

              <div className="admin-data-contract">
                <strong>Automatic field mapping</strong>
                <p>
                  Funding sources support an explicit source-to-destination mapping in the
                  editor and still recognize common field-name variations automatically.
                  Resource sources map Title, Description, Category, Status, URL, and Updated.
                </p>
              </div>
            </div>
          </section>

          <section className="admin-card admin-management-card" id="payments">
            <div className="admin-section-copy">
              <p className="admin-section-number">06</p>
              <h2>Payment management</h2>
              <p>
                Configure payment gateways, runtime mode, and secret references.
              </p>
            </div>
            <div className="admin-management-content">
              <label className="admin-switch-row">
                <span>
                  <strong>Payments enabled</strong>
                  <small>Turn this on to configure a payment provider and validate the setup.</small>
                </span>
                  <input
                    type="checkbox"
                    checked={draft.payments.enabled}
                    onChange={(event) => updatePaymentsEnabled(event.target.checked)}
                  />
                </label>

              {draft.payments.enabled ? (
                <>
                  <div className="admin-management-status">
                    <span className="is-online">
                      <i />
                      Payment provider configuration is active
                    </span>
                    <button
                      type="button"
                      onClick={validatePaymentGatewayConfig}
                    >
                      Validate config
                    </button>
                  </div>

                  {paymentNotice ? (
                    <div className="admin-management-notice" role="status">
                      {paymentNotice}
                    </div>
                  ) : null}

                  <div className="admin-fields">
                    <div className="admin-field-wide admin-payment-provider-group">
                      <span>Payment provider</span>
                      <div
                        className="admin-payment-provider-tabs"
                        role="tablist"
                        aria-label="Payment provider"
                      >
                        {paymentProviderOptions.map((provider) => (
                          <button
                            key={provider.id}
                            type="button"
                            role="tab"
                            aria-selected={activePaymentProvider === provider.id}
                            className={
                              activePaymentProvider === provider.id
                                ? 'is-active'
                                : ''
                            }
                            onClick={() => updatePaymentField('provider', provider.id)}
                          >
                            <span
                              className={`admin-payment-provider-icon is-${provider.id}`}
                              aria-hidden="true"
                            >
                              {provider.icon}
                            </span>
                            <span>{provider.label}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                    <label>
                      <span>Secret Key - Dev</span>
                      <input
                        value={draft.payments.testSecretKeyReference}
                        onChange={(event) =>
                          updatePaymentField(
                            'testSecretKeyReference',
                            event.target.value,
                          )
                        }
                        placeholder={
                          activePaymentProvider === 'waffo-pancake'
                            ? 'WAFFO_PANCAKE_TEST_SECRET_KEY'
                            : 'STRIPE_TEST_SECRET_KEY'
                        }
                      />
                    </label>
                    <label>
                      <span>Secret Key - Live</span>
                      <input
                        value={draft.payments.liveSecretKeyReference}
                        onChange={(event) =>
                          updatePaymentField(
                            'liveSecretKeyReference',
                            event.target.value,
                          )
                        }
                        placeholder={
                          activePaymentProvider === 'waffo-pancake'
                            ? 'WAFFO_PANCAKE_LIVE_SECRET_KEY'
                            : 'STRIPE_LIVE_SECRET_KEY'
                        }
                      />
                    </label>
                    <label>
                      <span>Publishable Key - Dev</span>
                      <input
                        value={draft.payments.testPublishableKeyReference}
                        onChange={(event) =>
                          updatePaymentField(
                            'testPublishableKeyReference',
                            event.target.value,
                          )
                        }
                        placeholder={
                          activePaymentProvider === 'waffo-pancake'
                            ? 'WAFFO_PANCAKE_DEV_PUBLISHABLE_KEY'
                            : 'STRIPE_DEV_PUBLISHABLE_KEY'
                        }
                      />
                    </label>
                    <label>
                      <span>Publishable Key - Live</span>
                      <input
                        value={draft.payments.livePublishableKeyReference}
                        onChange={(event) =>
                          updatePaymentField(
                            'livePublishableKeyReference',
                            event.target.value,
                          )
                        }
                        placeholder={
                          activePaymentProvider === 'waffo-pancake'
                            ? 'WAFFO_PANCAKE_LIVE_PUBLISHABLE_KEY'
                            : 'STRIPE_LIVE_PUBLISHABLE_KEY'
                        }
                      />
                    </label>
                    <label className="admin-field-wide">
                      <span>Webhook endpoint</span>
                      <input
                        value={draft.payments.webhookUrl}
                        onChange={(event) =>
                          updatePaymentField('webhookUrl', event.target.value)
                        }
                        placeholder="/api/webhooks/stripe"
                      />
                    </label>
                    <label className="admin-field-wide">
                      <span>Webhook signing secret reference</span>
                      <input
                        value={draft.payments.webhookSecretReference}
                        onChange={(event) =>
                          updatePaymentField(
                            'webhookSecretReference',
                            event.target.value,
                          )
                        }
                        placeholder="STRIPE_WEBHOOK_SECRET"
                      />
                    </label>
                    <label className="admin-field-wide">
                      <span>Checkout success URL</span>
                      <input
                        value={draft.payments.checkoutSuccessUrl}
                        onChange={(event) =>
                          updatePaymentField('checkoutSuccessUrl', event.target.value)
                        }
                        placeholder="/settings?checkout=success&session_id={CHECKOUT_SESSION_ID}#billing"
                      />
                    </label>
                    <label className="admin-field-wide">
                      <span>Checkout cancel URL</span>
                      <input
                        value={draft.payments.checkoutCancelUrl}
                        onChange={(event) =>
                          updatePaymentField('checkoutCancelUrl', event.target.value)
                        }
                        placeholder="/settings?checkout=cancel#billing"
                      />
                    </label>
                    <label className="admin-field-wide">
                      <span>Billing portal return URL</span>
                      <input
                        value={draft.payments.billingPortalReturnUrl}
                        onChange={(event) =>
                          updatePaymentField(
                            'billingPortalReturnUrl',
                            event.target.value,
                          )
                        }
                        placeholder="/settings#billing"
                      />
                    </label>
                  </div>
                </>
              ) : (
                <div className="admin-secret-note">
                  <strong>Payments are currently off</strong>
                  <p>
                    Turn on payments to choose a provider, enter gateway credentials,
                    and validate the configuration.
                  </p>
                </div>
              )}
            </div>
          </section>

          <section className="admin-card admin-management-card" id="pricing">
            <div className="admin-section-copy">
              <p className="admin-section-number">07</p>
              <h2>Pricing</h2>
              <p>
                Create products or services, set one-time or recurring billing,
                and map each offering to Stripe or Waffo Pancake.
              </p>
            </div>
            <div className="admin-management-content">
              <div className="admin-price-management">
                <div className="admin-price-management-header">
                  <div>
                    <strong>Price management</strong>
                    <p>
                      Add products or services, choose one-time or recurring
                      billing, and link each item to Stripe or Waffo Pancake.
                    </p>
                  </div>
                  <button
                    className="admin-button-secondary"
                    type="button"
                    onClick={addPaymentCatalogItem}
                  >
                    Add product or service
                  </button>
                </div>

                <div className="admin-price-management-list">
                  {draft.payments.priceCatalog.map((item, index) => (
                    <article className="admin-price-card" key={item.id}>
                      <div className="admin-price-card-header">
                        <div>
                          <span>Offering {index + 1}</span>
                          <strong>{item.name.trim() || 'Untitled offering'}</strong>
                        </div>
                        <div className="admin-price-card-toggles">
                          <label className="admin-price-card-toggle">
                            <input
                              type="checkbox"
                              checked={item.isDefault}
                              onChange={(event) =>
                                updatePaymentCatalogItem(
                                  item.id,
                                  'isDefault',
                                  event.target.checked,
                                )
                              }
                            />
                            <span>Default</span>
                          </label>
                          <label className="admin-price-card-toggle">
                            <input
                              type="checkbox"
                              checked={item.active}
                              onChange={(event) =>
                                updatePaymentCatalogItem(
                                  item.id,
                                  'active',
                                  event.target.checked,
                                )
                              }
                            />
                            <span>Active</span>
                          </label>
                        </div>
                      </div>

                      <div className="admin-fields">
                        <label>
                          <span>Name</span>
                          <input
                            value={item.name}
                            onChange={(event) =>
                              updatePaymentCatalogItem(
                                item.id,
                                'name',
                                event.target.value,
                              )
                            }
                          />
                        </label>
                        <label>
                          <span>Offering type</span>
                          <select
                            value={item.offeringType}
                            onChange={(event) =>
                              updatePaymentCatalogItem(
                                item.id,
                                'offeringType',
                                event.target.value as PaymentCatalogItem['offeringType'],
                              )
                            }
                          >
                            <option value="product">Product</option>
                            <option value="service">Service</option>
                          </select>
                        </label>
                        <label>
                          <span>Billing type</span>
                          <select
                            value={item.billingType}
                            onChange={(event) =>
                              updatePaymentCatalogItem(
                                item.id,
                                'billingType',
                                event.target.value as PaymentCatalogItem['billingType'],
                              )
                            }
                          >
                            <option value="one-time">One-time</option>
                            <option value="monthly">Monthly</option>
                            <option value="annual">Annual</option>
                          </select>
                        </label>
                        <label>
                          <span>Amount</span>
                          <input
                            inputMode="decimal"
                            value={item.amount}
                            onChange={(event) =>
                              updatePaymentCatalogItem(
                                item.id,
                                'amount',
                                event.target.value,
                              )
                            }
                            placeholder="0.00"
                          />
                        </label>
                        <label>
                          <span>Currency</span>
                          <select
                            value={item.currency}
                            onChange={(event) =>
                              updatePaymentCatalogItem(
                                item.id,
                                'currency',
                                event.target.value as PaymentCatalogItem['currency'],
                              )
                            }
                          >
                            <option value="CAD">CAD</option>
                            <option value="USD">USD</option>
                          </select>
                        </label>
                        <label className="admin-field-wide">
                          <span>Description</span>
                          <PaymentDescriptionEditor
                            format={item.descriptionFormat}
                            value={item.description}
                            onChange={(value) =>
                              updatePaymentCatalogItem(item.id, 'description', value)
                            }
                          />
                        </label>
                        <label>
                          <span>Description format</span>
                          <select
                            value={item.descriptionFormat}
                            onChange={(event) =>
                              updatePaymentCatalogItem(
                                item.id,
                                'descriptionFormat',
                                event.target.value as PaymentCatalogItem['descriptionFormat'],
                              )
                            }
                          >
                            <option value="markdown">Markdown</option>
                            <option value="html">HTML</option>
                          </select>
                        </label>
                        <div className="admin-field-wide admin-payment-provider-group">
                          <span>Linked gateway product</span>
                          <div
                            className="admin-payment-provider-tabs"
                            role="tablist"
                            aria-label={`Linked gateway for ${item.name || 'offering'}`}
                          >
                            {paymentProviderOptions.map((provider) => (
                              <button
                                key={provider.id}
                                type="button"
                                role="tab"
                                aria-selected={item.provider === provider.id}
                                className={
                                  item.provider === provider.id ? 'is-active' : ''
                                }
                                onClick={() =>
                                  updatePaymentCatalogItem(
                                    item.id,
                                    'provider',
                                    provider.id,
                                  )
                                }
                              >
                                <span
                                  className={`admin-payment-provider-icon is-${provider.id}`}
                                  aria-hidden="true"
                                >
                                  {provider.icon}
                                </span>
                                <span>{provider.label}</span>
                              </button>
                            ))}
                          </div>
                        </div>
                        <label>
                          <span>
                            {item.provider === 'waffo-pancake'
                              ? 'Waffo product ID'
                              : 'Stripe product ID'}
                          </span>
                          <input
                            value={item.externalProductId}
                            onChange={(event) =>
                              updatePaymentCatalogItem(
                                item.id,
                                'externalProductId',
                                event.target.value,
                              )
                            }
                            placeholder={
                              item.provider === 'waffo-pancake'
                                ? 'waffo_product_id'
                                : 'prod_...'
                            }
                          />
                        </label>
                        <label>
                          <span>
                            {item.billingType === 'one-time'
                              ? 'Linked price ID'
                              : 'Linked recurring price ID'}
                          </span>
                          <input
                            value={item.externalPriceId}
                            onChange={(event) =>
                              updatePaymentCatalogItem(
                                item.id,
                                'externalPriceId',
                                event.target.value,
                              )
                            }
                            placeholder={
                              item.provider === 'waffo-pancake'
                                ? 'waffo_price_id'
                                : 'price_...'
                            }
                          />
                        </label>
                      </div>

                      <div className="admin-price-card-footer">
                        <small>
                          Keep the billing type here aligned with the linked
                          product or price in your payment gateway.
                        </small>
                        <button
                          className="admin-button-secondary"
                          type="button"
                          onClick={() => removePaymentCatalogItem(item.id)}
                        >
                          Remove offering
                        </button>
                      </div>
                    </article>
                  ))}
                </div>
              </div>
            </div>
          </section>

          <section className="admin-card admin-management-card" id="revenue">
            <div className="admin-section-copy">
              <p className="admin-section-number">08</p>
              <h2>Revenue</h2>
              <p>
                Review income, expenses, subscription performance, and recent
                transaction activity.
              </p>
            </div>
            <div className="admin-management-content">
              <div className="admin-revenue-grid">
                {revenueHighlights.map(([label, value, detail]) => (
                  <article key={label}>
                    <span>{label}</span>
                    <strong>{value}</strong>
                    <small>{detail}</small>
                  </article>
                ))}
              </div>

              <div className="admin-revenue-panels">
                <div className="admin-revenue-breakdown">
                  <div>
                    <strong>Income</strong>
                    <span>Current month revenue mix</span>
                  </div>
                  {revenueBreakdown.map(([label, value, detail]) => (
                    <article key={label}>
                      <div>
                        <strong>{label}</strong>
                        <small>{detail}</small>
                      </div>
                      <b>{value}</b>
                    </article>
                  ))}
                </div>

                <div className="admin-revenue-breakdown">
                  <div>
                    <strong>Expenses</strong>
                    <span>Current month operating spend</span>
                  </div>
                  {expenseBreakdown.map(([label, value, detail]) => (
                    <article key={label}>
                      <div>
                        <strong>{label}</strong>
                        <small>{detail}</small>
                      </div>
                      <b>{value}</b>
                    </article>
                  ))}
                </div>
              </div>

              <div className="admin-revenue-panels">
                <div className="admin-revenue-subscriptions">
                  <div>
                    <strong>Subscriptions</strong>
                    <span>Plan mix and retention signals</span>
                  </div>
                  {subscriptionHealth.map(([label, value, detail]) => (
                    <article key={label}>
                      <span>{label}</span>
                      <strong>{value}</strong>
                      <small>{detail}</small>
                    </article>
                  ))}
                </div>

                <div className="admin-transaction-panel admin-revenue-ledger">
                  <div>
                    <strong>Transactions</strong>
                    <span>Latest payment activity</span>
                  </div>
                  {recentTransactions.map(
                    ([invoice, customer, amount, status, date]) => (
                      <article key={`revenue-${invoice}`}>
                        <b>{invoice}</b>
                        <span>{customer}</span>
                        <strong>{amount}</strong>
                        <em className={`status-${status.toLowerCase()}`}>
                          {status}
                        </em>
                        <small>{date}</small>
                      </article>
                    ),
                  )}
                </div>
              </div>
            </div>
          </section>

          <section className="admin-card admin-management-card" id="advisory-hub">
            <div className="admin-section-copy">
              <p className="admin-section-number">09</p>
              <h2>Strategic Report - Sections</h2>
              <p>
                Configure the sections shown in the planning view and live
                section generation stream.
              </p>
            </div>
            <div className="admin-management-content">
              <div className="admin-price-management">
                <div className="admin-price-management-header">
                  <div>
                    <strong>Section generation</strong>
                    <p>
                      Add, remove, rename, assign, and reorder sections. At least
                      one section must remain available and enabled.
                    </p>
                  </div>
                  <button
                    className="admin-button-secondary"
                    type="button"
                    onClick={addAdvisoryHubSection}
                  >
                    Add section
                  </button>
                </div>
                <div className="admin-price-management-list">
                  {draft.advisoryHub.sections.map((section, index) => (
                    <article className="admin-price-card" key={section.id}>
                      <div className="admin-price-card-header">
                        <div>
                          <span>Section {index + 1}</span>
                          <strong>{section.title.trim() || 'Untitled section'}</strong>
                        </div>
                        <label className="admin-price-card-toggle">
                          <input
                            type="checkbox"
                            checked={section.enabled}
                            onChange={(event) =>
                              updateAdvisoryHubSection(
                                section.id,
                                'enabled',
                                event.target.checked,
                              )
                            }
                          />
                          <span>Enabled</span>
                        </label>
                      </div>
                      <div className="admin-fields">
                        <label>
                          <span>Section title</span>
                          <input
                            value={section.title}
                            onChange={(event) =>
                              updateAdvisoryHubSection(
                                section.id,
                                'title',
                                event.target.value,
                              )
                            }
                          />
                        </label>
                        <label>
                          <span>Document Type</span>
                          <select
                            value={section.documentTypeId}
                            onChange={(event) =>
                              updateAdvisoryHubSection(
                                section.id,
                                'documentTypeId',
                                event.target.value,
                              )
                            }
                          >
                            {draft.advisoryHub.documentTypes.map((documentType) => (
                              <option key={documentType.id} value={documentType.id}>
                                {documentType.name}
                              </option>
                            ))}
                          </select>
                        </label>
                        <label>
                          <span>Assigned agent</span>
                          <select
                            value={section.agentId}
                            onChange={(event) =>
                              updateAdvisoryHubSection(
                                section.id,
                                'agentId',
                                event.target.value,
                              )
                            }
                          >
                            {draft.advisoryHub.agents.map((agent) => (
                              <option key={agent.id} value={agent.id}>
                                {agent.name}
                              </option>
                            ))}
                          </select>
                        </label>
                        <label>
                          <span>Layout</span>
                          <select
                            value={section.layout}
                            onChange={(event) =>
                              updateAdvisoryHubSection(
                                section.id,
                                'layout',
                                event.target.value as AdvisoryHubSectionConfig['layout'],
                              )
                            }
                          >
                            <option value="cover-page">Cover page</option>
                            <option value="main-content">Main content</option>
                          </select>
                        </label>
                        <label>
                          <span>Priority</span>
                          <select
                            value={section.priority}
                            onChange={(event) =>
                              updateAdvisoryHubSection(
                                section.id,
                                'priority',
                                event.target.value as AdvisoryHubSectionConfig['priority'],
                              )
                            }
                          >
                            <option value="high">High</option>
                            <option value="default">Default</option>
                            <option value="low">Low</option>
                          </select>
                        </label>
                        <label className="admin-field-wide">
                          <span>Section prompt</span>
                          <textarea
                            value={section.prompt}
                            onChange={(event) =>
                              updateAdvisoryHubSection(
                                section.id,
                                'prompt',
                                event.target.value,
                              )
                            }
                          />
                        </label>
                      </div>
                      <div className="admin-price-card-footer">
                        <small>
                          This controls the planning checklist and section cards
                          inside Strategic Report.
                        </small>
                        <div className="admin-inline-actions">
                          <button
                            className="admin-button-secondary"
                            type="button"
                            onClick={() => moveAdvisoryHubSection(section.id, 'up')}
                            disabled={index === 0}
                          >
                            Move up
                          </button>
                          <button
                            className="admin-button-secondary"
                            type="button"
                            onClick={() => moveAdvisoryHubSection(section.id, 'down')}
                            disabled={index === draft.advisoryHub.sections.length - 1}
                          >
                            Move down
                          </button>
                          <button
                            className="admin-button-secondary"
                            type="button"
                            onClick={() => removeAdvisoryHubSection(section.id)}
                            disabled={draft.advisoryHub.sections.length <= 1}
                          >
                            Remove section
                          </button>
                        </div>
                      </div>
                    </article>
                  ))}
                </div>
              </div>
            </div>
          </section>

          <section className="admin-card admin-management-card" id="layouts">
            <div className="admin-section-copy">
              <p className="admin-section-number">10</p>
              <h2>Layouts</h2>
              <p>Configure the reusable layout definitions used by Strategic Report sections.</p>
            </div>
            <div className="admin-management-content">
              <div className="admin-price-management">
                <div className="admin-price-management-header">
                  <div>
                    <strong>Layout definitions</strong>
                    <p>
                      Edit the CSS declarations and preview the result before
                      saving. Sections reference these layouts by ID.
                    </p>
                  </div>
                </div>
                <div className="admin-layout-list">
                  {draft.advisoryHub.layouts.map((layout) => {
                    return (
                      <article className="admin-layout-definition" key={layout.id}>
                        <header className="admin-layout-definition-header">
                          <div>
                            <span>{layout.id}</span>
                            <strong>{layout.name.trim() || 'Untitled layout'}</strong>
                          </div>
                          <span className="admin-layout-definition-badge">Preview</span>
                        </header>
                        <div className="admin-fields">
                          <label>
                            <span>Layout name</span>
                            <input
                              value={layout.name}
                              onChange={(event) =>
                                updateAdvisoryHubLayout(layout.id, 'name', event.target.value)
                              }
                            />
                          </label>
                          <label>
                            <span>Description</span>
                            <input
                              value={layout.description}
                              onChange={(event) =>
                                updateAdvisoryHubLayout(layout.id, 'description', event.target.value)
                              }
                            />
                          </label>
                          <label className="admin-field-wide">
                            <span>CSS declarations</span>
                            <textarea
                              value={layout.css}
                              onChange={(event) =>
                                updateAdvisoryHubLayout(layout.id, 'css', event.target.value)
                              }
                              placeholder="padding: 36px; background: #ffffff;"
                            />
                            <small>
                              Enter declarations only, without a selector. Example:{' '}
                              <code>padding: 36px; background: #ffffff;</code>
                            </small>
                          </label>
                        </div>
                        <div className="admin-layout-preview">
                          <div className="admin-layout-preview-heading">
                            <strong>Live preview</strong>
                            <small>{layout.description}</small>
                          </div>
                          <div className="admin-layout-preview-frame">
                            <div
                              className={`admin-layout-preview-surface is-${layout.id}`}
                              style={layoutPreviewStyle(layout)}
                            >
                              {layout.id === 'cover-page' ? (
                                <>
                                  <span>Strategic Report</span>
                                  <strong>Northstar Foods</strong>
                                  <small>Business analysis</small>
                                </>
                              ) : (
                                <>
                                  <span>Section 01</span>
                                  <strong>Executive Summary</strong>
                                  <small>Standard analysis content preview</small>
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                      </article>
                    )
                  })}
                </div>
              </div>
            </div>
          </section>

          <section
            className="admin-card admin-management-card"
            id="advisory-hub-document-types"
          >
            <div className="admin-section-copy">
              <p className="admin-section-number">11</p>
              <h2>Strategic Report - Document Types</h2>
              <p>Configure the document types available to sections.</p>
            </div>
            <div className="admin-management-content">
              <div className="admin-price-management">
                <div className="admin-price-management-header">
                  <div>
                    <strong>Document Types</strong>
                    <p>At least one document type must remain available.</p>
                  </div>
                  <button
                    className="admin-button-secondary"
                    type="button"
                    onClick={addAdvisoryHubDocumentType}
                  >
                    Add Document Type
                  </button>
                </div>
                <div className="admin-price-management-list">
                  {draft.advisoryHub.documentTypes.map((documentType, index) => (
                    <article className="admin-price-card" key={documentType.id}>
                      <div className="admin-price-card-header">
                        <div>
                          <span>Document Type {index + 1}</span>
                          <strong>{documentType.name.trim() || 'Untitled document type'}</strong>
                        </div>
                      </div>
                      <div className="admin-fields">
                        <label className="admin-field-wide">
                          <span>Name</span>
                          <input
                            value={documentType.name}
                            onChange={(event) =>
                              updateAdvisoryHubDocumentType(
                                documentType.id,
                                'name',
                                event.target.value,
                              )
                            }
                          />
                        </label>
                        <label className="admin-field-wide">
                          <span>Prompt</span>
                          <textarea
                            value={documentType.prompt}
                            onChange={(event) =>
                              updateAdvisoryHubDocumentType(
                                documentType.id,
                                'prompt',
                                event.target.value,
                              )
                            }
                            rows={5}
                          />
                        </label>
                      </div>
                      <div className="admin-price-card-footer">
                        <small>
                          Sections assigned to this type use its current name.
                        </small>
                        <button
                          className="admin-button-secondary"
                          type="button"
                          onClick={() => removeAdvisoryHubDocumentType(documentType.id)}
                          disabled={draft.advisoryHub.documentTypes.length <= 1}
                        >
                          Remove Document Type
                        </button>
                      </div>
                    </article>
                  ))}
                </div>
              </div>
            </div>
          </section>

          <section className="admin-card admin-management-card" id="advisory-hub-agents">
            <div className="admin-section-copy">
              <p className="admin-section-number">12</p>
              <h2>Strategic Report - Agents</h2>
              <p>Configure the agents available to section generation.</p>
            </div>
            <div className="admin-management-content">
              <div className="admin-price-management">
                <div className="admin-price-management-header">
                  <div>
                    <strong>Agents</strong>
                    <p>Configure each agent&apos;s name, role, and prompt.</p>
                  </div>
                  <button
                    className="admin-button-secondary"
                    type="button"
                    onClick={addAdvisoryHubAgent}
                  >
                    Add agent
                  </button>
                </div>
                <div className="admin-price-management-list">
                  {draft.advisoryHub.agents.map((agent, index) => (
                    <article className="admin-price-card" key={agent.id}>
                      <div className="admin-price-card-header">
                        <div>
                          <span>Agent {index + 1}</span>
                          <strong>{agent.name.trim() || 'Untitled agent'}</strong>
                        </div>
                      </div>
                      <div className="admin-fields">
                        <label>
                          <span>Name</span>
                          <input
                            value={agent.name}
                            onChange={(event) =>
                              updateAdvisoryHubAgent(agent.id, 'name', event.target.value)
                            }
                          />
                        </label>
                        <label>
                          <span>Role</span>
                          <input
                            value={agent.role}
                            onChange={(event) =>
                              updateAdvisoryHubAgent(agent.id, 'role', event.target.value)
                            }
                          />
                        </label>
                        <label className="admin-field-wide">
                          <span>Prompt</span>
                          <textarea
                            value={agent.prompt}
                            onChange={(event) =>
                              updateAdvisoryHubAgent(agent.id, 'prompt', event.target.value)
                            }
                          />
                        </label>
                      </div>
                      <div className="admin-price-card-footer">
                        <small>Sections assigned to this agent use its current name and role.</small>
                        <button
                          className="admin-button-secondary"
                          type="button"
                          onClick={() => removeAdvisoryHubAgent(agent.id)}
                          disabled={draft.advisoryHub.agents.length <= 1}
                        >
                          Remove agent
                        </button>
                      </div>
                    </article>
                  ))}
                </div>
              </div>
            </div>
          </section>

          <section className="admin-card admin-management-card" id="ai-models">
            <div className="admin-section-copy">
              <p className="admin-section-number">13</p>
              <h2>AI model management</h2>
              <p>
                Configure the model endpoint and request payload used by document generation workflows.
              </p>
            </div>
            <div className="admin-management-content">
              <div className="admin-model-catalog">
                <div className="admin-ai-models-header">
                  <div>
                    <strong>Available models</strong>
                    <span>{draft.ai.models.filter((model) => model.enabled).length} enabled</span>
                  </div>
                  <button
                    type="button"
                    className="admin-button-secondary"
                    onClick={addAIModel}
                  >
                    Add model
                  </button>
                </div>
                {draft.ai.models.map((model, modelIndex) => (
                  <article
                    className="admin-ai-model-editor"
                    key={`ai-model-editor-${modelIndex}`}
                  >
                    <div className="admin-ai-model-editor-header">
                      <div>
                        <span className="admin-model-provider">
                          {model.name.trim().charAt(0).toUpperCase() || 'M'}
                        </span>
                        <span>
                          <strong>{model.name.trim() || 'Untitled model'}</strong>
                          <small>{model.providerId} · {model.context} context</small>
                        </span>
                      </div>
                      <div className="admin-ai-model-actions">
                        <label className="admin-ai-model-enabled">
                          <input
                            type="checkbox"
                            checked={model.enabled}
                            onChange={(event) =>
                              toggleAIModel(model.id, event.currentTarget.checked)
                            }
                          />
                          <span>Enabled</span>
                        </label>
                        <button
                          type="button"
                          className={draft.ai.defaultModel === model.id ? 'is-model-default' : ''}
                          onClick={() => setDefaultAIModel(model.id)}
                        >
                          {draft.ai.defaultModel === model.id ? 'Default model' : 'Set default'}
                        </button>
                        <button
                          type="button"
                          className={expandedAIModelSettings[model.id] ? 'is-model-default' : ''}
                          aria-expanded={Boolean(expandedAIModelSettings[model.id])}
                          onClick={() =>
                            setExpandedAIModelSettings((current) => ({
                              ...current,
                              [model.id]: !current[model.id],
                            }))
                          }
                        >
                          Advanced settings
                        </button>
                      </div>
                    </div>
                    <div className="admin-ai-model-connection-status">
                      <div className="admin-ai-model-connection-copy">
                        <span
                          className={
                            testingAIModels[model.id]
                              ? ''
                              : model.connectionStatus === 'connected'
                                ? 'is-online'
                                : model.connectionStatus === 'failed'
                                  ? 'is-failed'
                                  : ''
                          }
                        >
                          <i />
                          {testingAIModels[model.id]
                            ? 'Testing connection'
                            : model.connectionStatus === 'connected'
                              ? 'Connection healthy'
                              : model.connectionStatus === 'failed'
                                ? 'Connection failed'
                                : 'Connection not tested'}
                        </span>
                        {testingAIModels[model.id] ? null : model.connectionStatus === 'failed' && model.connectionError ? (
                          <small title={model.connectionError}>{model.connectionError}</small>
                        ) : model.lastTestedAt ? (
                          <small>{formatAIConnectionTime(model.lastTestedAt)}</small>
                        ) : null}
                      </div>
                      <button
                        type="button"
                        disabled={testingAIModels[model.id]}
                        onClick={() => openAIModelChat(model)}
                      >
                        {testingAIModels[model.id]
                          ? 'Testing…'
                          : 'Test connection'}
                      </button>
                    </div>
                    <div className="admin-ai-model-fields">
                      <label>
                        <span>Provider</span>
                        <select
                          value={model.providerId}
                          onChange={(event) => updateAIModelProvider(model.id, event.target.value)}
                        >
                          {aiProviderOptions.map((provider) => (
                            <option key={provider.id} value={provider.id}>
                              {provider.name}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label>
                        <span>Model name</span>
                        <input
                          value={model.id}
                          onChange={(event) => updateAIModel(model.id, 'id', event.target.value)}
                          placeholder="gpt-5-mini"
                        />
                      </label>
                      <label>
                        <span>API key</span>
                        <input
                          type="password"
                          value={model.apiKey}
                          onChange={(event) => updateAIModel(model.id, 'apiKey', event.target.value)}
                          placeholder="Paste provider API key"
                        />
                      </label>
                    </div>
                    {expandedAIModelSettings[model.id] ? (
                      <div className="admin-ai-model-advanced">
                        <div className="admin-ai-model-advanced-heading">
                          <div>
                            <strong>Advanced settings</strong>
                            <span>Configure the provider request for this model.</span>
                          </div>
                        </div>
                        <div className="admin-ai-model-fields">
                          <label>
                            <span>URL</span>
                            <input
                              type="text"
                              value={model.url}
                              onChange={(event) => updateAIModel(model.id, 'url', event.target.value)}
                              placeholder="https://openrouter.ai/api/v1/chat/completions"
                            />
                          </label>
                          <label>
                            <span>Temperature</span>
                            <input
                              type="number"
                              min="0"
                              max="2"
                              step="0.1"
                              value={model.temperature}
                              onChange={(event) => updateAIModel(model.id, 'temperature', event.target.value)}
                              placeholder="0.2"
                            />
                          </label>
                          <label>
                            <span>Max tokens</span>
                            <input
                              type="number"
                              min="1"
                              max="100000"
                              step="1"
                              value={model.maxTokens}
                              onChange={(event) => updateAIModel(model.id, 'maxTokens', event.target.value)}
                              placeholder="1024"
                            />
                          </label>
                          <label className="admin-ai-model-reasoning">
                            <input
                              type="checkbox"
                              checked={model.reasoningEnabled}
                              onChange={(event) =>
                                updateAIModel(
                                  model.id,
                                  'reasoningEnabled',
                                  event.currentTarget.checked,
                                )
                              }
                            />
                            <span>Enable reasoning</span>
                            <small>
                              Sends <code>reasoning.enabled</code> when this provider supports it.
                            </small>
                          </label>
                        </div>
                        <div className="admin-ai-model-save-actions">
                          <button
                            type="button"
                            className="admin-button-primary"
                            disabled={savingAIModels[model.id]}
                            onClick={() => saveAIModel(model.id)}
                          >
                            {savingAIModels[model.id] ? 'Saving...' : 'Save model'}
                          </button>
                          <button
                            type="button"
                            className="admin-button-secondary"
                            onClick={() => removeAIModel(model.id)}
                            disabled={draft.ai.models.length <= 1}
                          >
                            Remove model
                          </button>
                        </div>
                        {aiModelSaveNotice ? (
                          <p className="admin-management-notice" role="status">
                            {aiModelSaveNotice}
                          </p>
                        ) : null}
                      </div>
                    ) : null}
                  </article>
                ))}
              </div>

            </div>
          </section>

          <section className="admin-card" id="legal">
            <div className="admin-section-copy">
              <p className="admin-section-number">14</p>
              <h2>Legal pages</h2>
              <p>
                Edit the public Privacy Policy and Terms of Service shown in the
                landing page footer. Both pages support Markdown and raw HTML.
              </p>
            </div>
            <div className="admin-fields">
              <div className="admin-legal-grid admin-field-wide">
                <article className="admin-legal-editor">
                  <header>
                    <div>
                      <strong>Privacy Policy</strong>
                      <span>Public page: /privacy-policy</span>
                    </div>
                    <Link to="/privacy-policy" target="_blank" rel="noreferrer">
                      Open page
                    </Link>
                  </header>
                  <label>
                    <span>Format</span>
                    <select
                      value={draft.privacyPolicy.format}
                      onChange={(event) =>
                        updateLegalField(
                          'privacyPolicy',
                          'format',
                          event.target.value as LegalDocumentConfig['format'],
                        )
                      }
                    >
                      <option value="markdown">Markdown</option>
                      <option value="html">HTML</option>
                    </select>
                  </label>
                  <label>
                    <span>Content</span>
                    <textarea
                      value={draft.privacyPolicy.content}
                      onChange={(event) =>
                        updateLegalField('privacyPolicy', 'content', event.target.value)
                      }
                    />
                  </label>
                </article>

                <article className="admin-legal-editor">
                  <header>
                    <div>
                      <strong>Terms of Service</strong>
                      <span>Public page: /terms-of-service</span>
                    </div>
                    <Link to="/terms-of-service" target="_blank" rel="noreferrer">
                      Open page
                    </Link>
                  </header>
                  <label>
                    <span>Format</span>
                    <select
                      value={draft.termsOfService.format}
                      onChange={(event) =>
                        updateLegalField(
                          'termsOfService',
                          'format',
                          event.target.value as LegalDocumentConfig['format'],
                        )
                      }
                    >
                      <option value="markdown">Markdown</option>
                      <option value="html">HTML</option>
                    </select>
                  </label>
                  <label>
                    <span>Content</span>
                    <textarea
                      value={draft.termsOfService.content}
                      onChange={(event) =>
                        updateLegalField('termsOfService', 'content', event.target.value)
                      }
                    />
                  </label>
                </article>
              </div>
              <div className="admin-license-preview admin-field-wide">
                <span>Supported formats</span>
                <strong>Markdown and HTML</strong>
                <p>
                  Use Markdown for easy editing, or switch to HTML when you need
                  exact structure and custom markup.
                </p>
              </div>
            </div>
          </section>

          {!commercialLicenseUnlocked && <section className="admin-card" id="licensing">
            <div className="admin-section-copy">
              <p className="admin-section-number">15</p>
              <h2>Commercial licensing</h2>
              <p>
                Commercial licensing terms are fixed for the community edition
                and cannot be changed from Admin Console.
              </p>
            </div>
            <div className="admin-fields">
              <label>
                <span>License price label</span>
                <input
                  className="admin-license-readonly"
                  value={draft.commercialLicensePrice}
                  readOnly
                />
              </label>
              <label>
                <span>Purchase or contact URL</span>
                <input
                  className="admin-license-readonly"
                  value={draft.commercialLicenseUrl}
                  readOnly
                />
              </label>
              <div className="admin-license-lock admin-field-wide">
                <strong>Community edition lock</strong>
                <p>
                  OpenBcon attribution is required in the landing page and
                  dashboard footer. A paid commercial license can hide this
                  section and unlock attribution controls in a licensed build
                  with <code> VITE_COMMERCIAL_LICENSED=true </code>.
                </p>
              </div>
              <div className="admin-license-preview admin-field-wide">
                <span>Community edition</span>
                <strong>AGPL-3.0</strong>
                <p>Source-available network deployments must preserve copyleft.</p>
              </div>
              <div className="admin-license-preview admin-field-wide is-commercial">
                <span>Commercial edition</span>
                <strong>{draft.commercialLicensePrice}</strong>
                <p>For proprietary use, private modifications, and OEM distribution.</p>
              </div>
              <div className="admin-license-preview admin-field-wide">
                <span>OpenBcon attribution</span>
                <strong>
                  {commercialLicenseUnlocked
                    ? draft.openBconAttributionVisible
                      ? 'Visible'
                      : 'Hidden'
                    : 'Always visible in community edition'}
                </strong>
                <p>
                  Footer credit points back to the{' '}
                  <a href={OPEN_BCON_REPO_URL} target="_blank" rel="noreferrer">
                    OpenBcon GitHub repository
                  </a>
                  .
                </p>
              </div>
            </div>
          </section>}

          <section className="admin-card admin-management-card" id="users">
            <div className="admin-section-copy">
              <p className="admin-section-number">18</p>
              <h2>Users</h2>
              <p>Manage platform accounts, roles, access status, and email verification.</p>
            </div>
            <div className="admin-management-content">
              <div className="admin-users-toolbar">
                <input
                  value={adminUsersQuery}
                  onChange={(event) => setAdminUsersQuery(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') void loadAdminUsers()
                  }}
                  placeholder="Search by name or email"
                  aria-label="Search users"
                />
                <div className="admin-inline-actions">
                  <button
                    type="button"
                    className="admin-button-secondary"
                    onClick={() => void loadAdminUsers()}
                    disabled={adminUsersLoading}
                  >
                    {adminUsersLoading ? 'Loading…' : 'Refresh'}
                  </button>
                  <button
                    type="button"
                    className="admin-button-primary"
                    onClick={() => {
                      setAdminUserEditor(createAdminUserDraft())
                      setAdminUsersError('')
                    }}
                  >
                    Add user
                  </button>
                </div>
              </div>
              {adminUsersNotice ? (
                <div className="admin-management-notice" role="status">{adminUsersNotice}</div>
              ) : null}
              {adminUsersError ? (
                <div className="admin-management-notice is-error" role="alert">{adminUsersError}</div>
              ) : null}
              {adminUserEditor ? (
                <div className="admin-user-editor">
                  <div className="admin-user-editor-header">
                    <strong>{adminUserEditor.id ? 'Edit user' : 'Add user'}</strong>
                    <button
                      type="button"
                      className="admin-button-secondary"
                      onClick={() => setAdminUserEditor(null)}
                    >
                      Cancel
                    </button>
                  </div>
                  <div className="admin-fields">
                    <label>
                      <span>Full name</span>
                      <input
                        value={adminUserEditor.fullName}
                        onChange={(event) => updateAdminUserDraft('fullName', event.target.value)}
                        autoComplete="off"
                      />
                    </label>
                    <label>
                      <span>Email</span>
                      <input
                        type="email"
                        value={adminUserEditor.email}
                        onChange={(event) => updateAdminUserDraft('email', event.target.value)}
                        autoComplete="off"
                      />
                    </label>
                    <label>
                      <span>Role</span>
                      <select
                        value={adminUserEditor.role}
                        onChange={(event) => updateAdminUserDraft('role', event.target.value as AdminUser['role'])}
                      >
                        <option value="owner">Owner</option>
                        <option value="admin">Admin</option>
                        <option value="member">Member</option>
                      </select>
                    </label>
                    <label>
                      <span>Status</span>
                      <select
                        value={adminUserEditor.status}
                        onChange={(event) => updateAdminUserDraft('status', event.target.value as AdminUser['status'])}
                      >
                        <option value="active">Active</option>
                        <option value="invited">Invited</option>
                        <option value="disabled">Disabled</option>
                      </select>
                    </label>
                    <label className="admin-field-wide">
                      <span>{adminUserEditor.id ? 'New password (optional)' : 'Password'}</span>
                      <input
                        type="password"
                        value={adminUserEditor.password}
                        onChange={(event) => updateAdminUserDraft('password', event.target.value)}
                        placeholder={adminUserEditor.id ? 'Leave blank to keep the current password' : 'At least 8 characters'}
                        autoComplete="new-password"
                      />
                    </label>
                    <label className="admin-switch-row admin-field-wide">
                      <span>
                        <strong>Email verified</strong>
                        <small>Admins can mark an account as verified when appropriate.</small>
                      </span>
                      <input
                        type="checkbox"
                        checked={adminUserEditor.emailVerified}
                        onChange={(event) => updateAdminUserDraft('emailVerified', event.target.checked)}
                      />
                    </label>
                  </div>
                  <div className="admin-inline-actions admin-user-editor-actions">
                    <button
                      type="button"
                      className="admin-button-primary"
                      onClick={() => void saveAdminUser()}
                      disabled={adminUsersSaving}
                    >
                      {adminUsersSaving ? 'Saving…' : 'Save user'}
                    </button>
                  </div>
                </div>
              ) : null}
              <div className="admin-user-list">
                {adminUsersLoading && adminUsers.length === 0 ? (
                  <p className="admin-source-empty">Loading users…</p>
                ) : adminUsers.length === 0 ? (
                  <p className="admin-source-empty">No users found.</p>
                ) : adminUsers.map((user) => (
                  <article className="admin-user-row" key={user.id}>
                    <div className="admin-user-identity">
                      <span className="admin-user-avatar">{user.fullName.trim().charAt(0).toUpperCase() || '?'}</span>
                      <div>
                        <strong>{user.fullName}</strong>
                        <span>{user.email}</span>
                        <small>ID {user.id} · Created {new Date(user.createdAt).toLocaleDateString()}</small>
                      </div>
                    </div>
                    <div className="admin-user-meta">
                      <span className={`admin-user-status is-${user.status}`}>{user.status}</span>
                      <span className="admin-user-role">{user.role}</span>
                      <span className={`admin-user-verification ${user.emailVerified ? 'is-verified' : ''}`}>
                        {user.emailVerified ? 'Email verified' : 'Email not verified'}
                      </span>
                      {user.hasGoogleAccount ? <span className="admin-user-google">Google linked</span> : null}
                    </div>
                    <div className="admin-inline-actions admin-user-actions">
                      <button
                        type="button"
                        className="admin-button-secondary"
                        onClick={() => {
                          setAdminUserEditor({
                            id: user.id,
                            fullName: user.fullName,
                            email: user.email,
                            role: user.role,
                            status: user.status,
                            password: '',
                            emailVerified: user.emailVerified,
                          })
                          setAdminUsersError('')
                        }}
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        className="admin-button-secondary is-danger"
                        onClick={() => void deleteAdminUser(user)}
                        disabled={adminUserDeleting === user.id}
                      >
                        {adminUserDeleting === user.id ? 'Deleting…' : 'Delete'}
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            </div>
          </section>

          <section className="admin-card" id="notification-bar">
            <div className="admin-section-copy">
              <p className="admin-section-number">16</p>
              <h2>Notification bar</h2>
              <p>
                Show a configurable message at the top of every authenticated
                workspace page.
              </p>
            </div>
            <div className="admin-fields">
              <label className="admin-switch-row admin-field-wide">
                <span>
                  <strong>Show notification bar</strong>
                  <small>Changes appear across the dashboard after saving.</small>
                </span>
                <input
                  type="checkbox"
                  checked={draft.notificationBar.enabled}
                  onChange={(event) =>
                    updateField('notificationBar', {
                      ...draft.notificationBar,
                      enabled: event.target.checked,
                    })
                  }
                />
              </label>
              <label className="admin-field-wide">
                <span>Message</span>
                <textarea
                  value={draft.notificationBar.message}
                  onChange={(event) =>
                    updateField('notificationBar', {
                      ...draft.notificationBar,
                      message: event.target.value,
                    })
                  }
                  placeholder="Share an important workspace update"
                />
              </label>
              <label>
                <span>Who can see this message</span>
                <select
                  value={draft.notificationBar.audience}
                  onChange={(event) =>
                    updateField('notificationBar', {
                      ...draft.notificationBar,
                      audience: event.target.value === 'admin' ? 'admin' : 'all',
                    })
                  }
                >
                  <option value="all">Everyone</option>
                  <option value="admin">Admins only</option>
                </select>
              </label>
              <label>
                <span>Action label</span>
                <input
                  value={draft.notificationBar.actionLabel}
                  onChange={(event) =>
                    updateField('notificationBar', {
                      ...draft.notificationBar,
                      actionLabel: event.target.value,
                    })
                  }
                  placeholder="Learn more"
                />
              </label>
              <label>
                <span>Action URL</span>
                <input
                  value={draft.notificationBar.actionUrl}
                  onChange={(event) =>
                    updateField('notificationBar', {
                      ...draft.notificationBar,
                      actionUrl: event.target.value,
                    })
                  }
                  placeholder="/strategic-reports or https://example.com"
                />
              </label>
              <label className="admin-switch-row admin-field-wide">
                <span>
                  <strong>Allow users to dismiss</strong>
                  <small>Users can hide the bar for the current page session.</small>
                </span>
                <input
                  type="checkbox"
                  checked={draft.notificationBar.dismissible}
                  onChange={(event) =>
                    updateField('notificationBar', {
                      ...draft.notificationBar,
                      dismissible: event.target.checked,
                    })
                  }
                />
              </label>
            </div>
          </section>

          <section className="admin-card" id="updates">
            <div className="admin-section-copy">
              <p className="admin-section-number">17</p>
              <h2>Updates</h2>
              <p>
                Check the OpenBcon repository for a newer application build.
                This check does not install updates automatically.
              </p>
            </div>
            <div className="admin-update-panel">
              <div className="admin-update-summary">
                <span>Current build</span>
                <strong>{updateCheck.currentCommit}</strong>
                <p>
                  {updateCheck.status === 'idle'
                    ? 'Check GitHub when you are ready.'
                    : updateCheck.status === 'checking'
                      ? 'Checking the latest OpenBcon commit...'
                      : updateCheck.status === 'current'
                        ? 'This build is up to date.'
                        : updateCheck.status === 'available'
                          ? 'A newer build is available.'
                          : updateCheck.status === 'unknown'
                            ? 'This build was not stamped with a Git commit.'
                            : updateCheck.error}
                </p>
              </div>
              <div className="admin-update-result">
                {updateCheck.latestShortCommit && (
                  <div>
                    <span>Latest on main</span>
                    <strong>{updateCheck.latestShortCommit}</strong>
                    <p>{updateCheck.latestMessage}</p>
                  </div>
                )}
                {updateCheck.latestUrl && (
                  <a href={updateCheck.latestUrl} target="_blank" rel="noreferrer">
                    View commit on GitHub
                  </a>
                )}
                {updateCheck.latestCommittedAt && (
                  <time dateTime={updateCheck.latestCommittedAt}>
                    Checked commit: {new Date(updateCheck.latestCommittedAt).toLocaleString()}
                  </time>
                )}
              </div>
              <button
                type="button"
                className="admin-button-secondary"
                onClick={checkForUpdates}
                disabled={updateCheck.status === 'checking'}
              >
                {updateCheck.status === 'checking' ? 'Checking...' : 'Check updates'}
              </button>
            </div>
          </section>

          <div className="admin-actions">
            {settingsNotice ? (
              <p className="admin-management-notice" role="status">
                {settingsNotice}
              </p>
            ) : null}
            <button type="button" className="admin-button-secondary" onClick={restoreDefaults}>
              Restore defaults
            </button>
            <button type="submit" className="admin-button-primary">
              {saved ? 'Settings saved' : 'Save configuration'}
            </button>
          </div>
        </form>

        {sourceEditor ? (
          <div
            className="admin-source-editor-backdrop"
            role="presentation"
            onMouseDown={() => setSourceEditor(null)}
          >
            <section
              className="admin-source-editor"
              role="dialog"
              aria-modal="true"
              aria-labelledby="source-editor-title"
              onMouseDown={(event) => event.stopPropagation()}
            >
              <header>
                <div>
                  <p>External integration</p>
                  <h2 id="source-editor-title">
                    {draft.dataSources.some((source) => source.id === sourceEditor.id)
                      ? 'Edit data source'
                      : 'Add data source'}
                  </h2>
                </div>
                <button
                  type="button"
                  aria-label="Close data source editor"
                  onClick={() => setSourceEditor(null)}
                >
                  ×
                </button>
              </header>

              <div className="admin-source-editor-grid">
                <label>
                  <span>Source name</span>
                  <input
                    autoFocus
                    value={sourceEditor.name}
                    onChange={(event) => updateDataSource('name', event.target.value)}
                    placeholder="Workspace resource catalog"
                  />
                </label>
                <label>
                  <span>Provider</span>
                  <select
                    value={sourceEditor.provider}
                    onChange={(event) =>
                      updateDataSourceProvider(
                        event.target.value as FundingDataSourceProvider,
                      )
                    }
                  >
                    <option value="google-sheets">Google Sheets</option>
                    <option value="airtable">Airtable</option>
                    <option value="json-file">JSON File</option>
                  </select>
                </label>
                <label>
                  <span>Destination module</span>
                  <select
                    value={sourceEditor.module}
                    onChange={(event) =>
                      updateDataSource(
                        'module',
                        event.target.value as DataSourceModule,
                      )
                    }
                  >
                    {Object.entries(dataSourceModuleLabels).map(([id, label]) => (
                      <option key={id} value={id}>{label}</option>
                    ))}
                  </select>
                </label>
                <label>
                  <span>Sync frequency</span>
                  <select
                    value={sourceEditor.frequency}
                    onChange={(event) =>
                      updateDataSource(
                        'frequency',
                        event.target.value as FundingDataSourceFrequency,
                      )
                    }
                  >
                    <option value="manual">Manual</option>
                    <option value="hourly">Hourly</option>
                    <option value="daily">Daily</option>
                  </select>
                </label>

                {sourceEditor.provider === 'google-sheets' ? (
                  <>
                    <label className="admin-source-field-wide">
                      <span>Google Sheets URL</span>
                      <input
                        value={sourceEditor.spreadsheetUrl}
                        onChange={(event) =>
                          updateDataSource('spreadsheetUrl', event.target.value)
                        }
                        placeholder="https://docs.google.com/spreadsheets/d/..."
                      />
                      <small>The sheet must be shared for anyone with the link to view.</small>
                    </label>
                    <label className="admin-source-field-wide">
                      <span>Sheet tab name</span>
                      <input
                        value={sourceEditor.sheetName}
                        onChange={(event) =>
                          updateDataSource('sheetName', event.target.value)
                        }
                        placeholder="Programs"
                      />
                    </label>
                  </>
                ) : sourceEditor.provider === 'airtable' ? (
                  <>
                    <label>
                      <span>Airtable base ID</span>
                      <input
                        value={sourceEditor.airtableBaseId}
                        onChange={(event) =>
                          updateDataSource('airtableBaseId', event.target.value)
                        }
                        placeholder="appXXXXXXXXXXXXXX"
                      />
                    </label>
                    <label>
                      <span>Table name</span>
                      <input
                        value={sourceEditor.airtableTableName}
                        onChange={(event) =>
                          updateDataSource('airtableTableName', event.target.value)
                        }
                        placeholder="Funding Programs"
                      />
                    </label>
                    <label>
                      <span>View name</span>
                      <input
                        value={sourceEditor.airtableView}
                        onChange={(event) =>
                          updateDataSource('airtableView', event.target.value)
                        }
                        placeholder="Published"
                      />
                    </label>
                    <label>
                      <span>Secret reference</span>
                      <input
                        value={sourceEditor.credentialReference}
                        onChange={(event) =>
                          updateDataSource('credentialReference', event.target.value)
                        }
                        placeholder="AIRTABLE_ACCESS_TOKEN"
                      />
                    </label>
                    <label className="admin-source-field-wide">
                      <span>Secure proxy endpoint</span>
                      <input
                        value={sourceEditor.proxyUrl}
                        onChange={(event) =>
                          updateDataSource('proxyUrl', event.target.value)
                        }
                        placeholder="/api/integrations/airtable/sync"
                      />
                      <small>
                        The proxy reads the secret server-side and returns Airtable records.
                      </small>
                    </label>
                  </>
                ) : (
                  <>
                    <label>
                      <span>Catalog language</span>
                      <select
                        value={sourceEditor.language ?? 'en-CA'}
                        onChange={(event) =>
                          updateDataSource(
                            'language',
                            normalizeLocale(event.target.value),
                          )
                        }
                      >
                        {languageOptions.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="admin-source-field-wide">
                      <span>JSON catalog file</span>
                      <input
                        type="file"
                        accept=".json,application/json"
                        onChange={selectJsonDataSourceFile}
                      />
                      <small>
                        Select a catalog with a top-level <code>records</code> array. Bundled
                        files can be synced without selecting them again.
                      </small>
                      {sourceEditor.jsonFileName ? (
                        <small>Selected: {sourceEditor.jsonFileName}</small>
                      ) : null}
                    </label>
                  </>
                )}

                {sourceEditor.module === 'grants-loans' ? (
                  <div className="admin-source-field-wide admin-source-mapping">
                    <div className="admin-source-mapping-heading">
                      <strong>Field mapping</strong>
                      <small>
                        Match each destination field to the column or JSON key in this source.
                        Program name is required; blank optional fields use automatic aliases.
                      </small>
                    </div>
                    <div className="admin-source-mapping-grid">
                      {fundingProgramMappingFields.map((field) => {
                        const mapping = getFundingProgramFieldMapping(sourceEditor)
                        return (
                          <label key={field.key}>
                            <span>
                              {field.label}
                              {field.required ? ' *' : ''}
                            </span>
                            <input
                              value={mapping[field.key] ?? ''}
                              onChange={(event) =>
                                updateFundingFieldMapping(field.key, event.target.value)
                              }
                              placeholder={`Source ${field.label.toLowerCase()} key`}
                            />
                          </label>
                        )
                      })}
                    </div>
                  </div>
                ) : null}

                <label className="admin-switch-row admin-source-field-wide">
                  <span>
                    <strong>Enable this data source</strong>
                    <small>Include synchronized records in the selected destination module.</small>
                  </span>
                  <input
                    type="checkbox"
                    checked={sourceEditor.enabled}
                    onChange={(event) =>
                      updateDataSource('enabled', event.target.checked)
                    }
                  />
                </label>
              </div>

              <div className="admin-source-security-note">
                <strong>
                  {sourceEditor.provider === 'google-sheets'
                    ? 'Public read access'
                    : sourceEditor.provider === 'json-file'
                      ? 'Server-side database import'
                      : 'Server-side authentication'}
                </strong>
                <p>
                  {sourceEditor.provider === 'google-sheets'
                    ? 'Only public or link-readable sheets can be synchronized directly by the open-source frontend.'
                    : sourceEditor.provider === 'json-file'
                      ? 'The catalog is validated and written to the current Test or Live database. The browser keeps a cache for fast display.'
                      : 'Airtable access tokens are never stored in the browser. Configure the secret on your integration proxy.'}
                </p>
              </div>

              {sourceNotice ? (
                <div className="admin-source-editor-notice" role="alert">
                  {sourceNotice}
                </div>
              ) : null}

              <footer>
                <button type="button" onClick={() => setSourceEditor(null)}>
                  Cancel
                </button>
                <button type="button" onClick={saveDataSource}>
                  Save data source
                </button>
              </footer>
            </section>
          </div>
        ) : null}

        {aiChatModel ? (
          <div
            className="admin-ai-chat-backdrop"
            role="presentation"
            onMouseDown={() => {
              if (!aiChatSending) setAIChatModel(null)
            }}
          >
            <section
              className="admin-ai-chat-dialog"
              role="dialog"
              aria-modal="true"
              aria-labelledby="ai-chat-title"
              onMouseDown={(event) => event.stopPropagation()}
            >
              <header className="admin-ai-chat-header">
                <div>
                  <p>Model connection test</p>
                  <h2 id="ai-chat-title">{aiChatModel.name || aiChatModel.id}</h2>
                  <small>Provider endpoint configured internally</small>
                </div>
                <button
                  type="button"
                  aria-label="Close model chat"
                  onClick={() => setAIChatModel(null)}
                  disabled={aiChatSending}
                >
                  ×
                </button>
              </header>

              <div className="admin-ai-chat-meta">
                <span
                  className={
                    aiChatSending
                      ? 'is-testing'
                      : aiChatModel.connectionStatus === 'connected'
                        ? 'is-online'
                        : aiChatModel.connectionStatus === 'failed'
                          ? 'is-failed'
                          : ''
                  }
                >
                  <i />
                  {aiChatSending
                    ? 'Request in progress'
                    : aiChatModel.connectionStatus === 'connected'
                      ? 'Connection healthy'
                      : aiChatModel.connectionStatus === 'failed'
                        ? 'Connection failed'
                        : 'Not tested yet'}
                </span>
                <span>Live request</span>
              </div>

              <div className="admin-ai-chat-messages" aria-live="polite">
                {aiChatMessages.map((message, index) => (
                  <div className={`admin-ai-chat-message is-${message.role}`} key={`${message.role}-${index}`}>
                    <span>{message.role === 'user' ? 'You' : message.role === 'error' ? 'Error' : 'Model'}</span>
                    <p>{message.content}</p>
                  </div>
                ))}
                {aiChatSending ? (
                  <div className="admin-ai-chat-message is-assistant is-pending">
                    <span>Model</span>
                    <p>Waiting for response…</p>
                  </div>
                ) : null}
              </div>

              <form className="admin-ai-chat-form" onSubmit={sendAIChatMessage}>
                <textarea
                  autoFocus
                  value={aiChatInput}
                  onChange={(event) => setAIChatInput(event.target.value)}
                  placeholder="Send a message to test this model..."
                  disabled={aiChatSending}
                  rows={3}
                />
                <div>
                  <small>Messages are sent through the Python backend.</small>
                  <button
                    type="submit"
                    className="admin-button-primary"
                    disabled={aiChatSending || !aiChatInput.trim()}
                  >
                    {aiChatSending ? 'Sending…' : 'Send message'}
                  </button>
                </div>
              </form>
            </section>
          </div>
        ) : null}
      </main>
    </div>
  )
}
