import {
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent,
} from 'react'
import { Link } from 'react-router-dom'
import { usePlatformConfig } from '../config/usePlatformConfig'
import {
  type AdvisoryHubAgentConfig,
  type AdvisoryHubConfig,
  type AdvisoryHubDocumentTypeConfig,
  type AdvisoryHubSectionConfig,
  type AIModelConfig,
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
} from '../config/platform'
import {
  removeSyncedResourceRecords,
  removeSyncedFundingPrograms,
  saveSyncedResourceRecords,
  saveSyncedFundingPrograms,
  syncFundingDataSource,
  syncResourceDataSource,
  type DataSourceModule,
  type FundingDataSource,
  type FundingDataSourceFrequency,
  type FundingDataSourceProvider,
} from '../data/fundingSources'
import { getPlatformDisplayName, getPlatformInitial } from '../lib/platformBrand'
import {
  OPEN_BCON_REPO_URL,
  hasCommercialLicenseAccess,
} from '../licensing/openBconAttribution'

const moduleLabels: Array<{ id: PlatformModuleId; label: string; group: string }> = [
  { id: 'funding-readiness', label: 'Funding Readiness', group: 'Funding Centre' },
  { id: 'quick-build', label: 'Quick Build', group: 'Funding Centre' },
  { id: 'my-company', label: 'My Company', group: 'My Workspace' },
  { id: 'saved-programs', label: 'Saved Programs', group: 'My Workspace' },
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

type PaymentDescriptionEditorProps = {
  format: ContentFormat
  value: string
  onChange: (value: string) => void
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

function getDefaultAIModelURL(providerId: string, modelId: string) {
  if (providerId === 'anthropic') return 'https://api.anthropic.com/v1/messages'
  if (providerId === 'google') {
    return `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(modelId)}:generateContent`
  }
  if (providerId === 'custom') return '/api/ai'
  return 'https://api.openai.com/v1/chat/completions'
}

function getAIModelEndpoint(model: AIModelConfig) {
  return model.url.trim() || getDefaultAIModelURL(model.providerId, model.id)
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
  const { config, updateConfig, resetConfig } = usePlatformConfig()
  const [draft, setDraft] = useState<PlatformConfig>(config)
  const [saved, setSaved] = useState(false)
  const [paymentNotice, setPaymentNotice] = useState('')
  const [testingAIModels, setTestingAIModels] = useState<Record<string, boolean>>({})
  const [aiChatModel, setAIChatModel] = useState<AIModelConfig | null>(null)
  const [aiChatMessages, setAIChatMessages] = useState<AIChatMessage[]>([])
  const [aiChatInput, setAIChatInput] = useState('')
  const [aiChatSending, setAIChatSending] = useState(false)
  const [sourceQuery, setSourceQuery] = useState('')
  const [sourceModuleFilter, setSourceModuleFilter] = useState<
    'all' | DataSourceModule
  >('all')
  const [sourceEditor, setSourceEditor] = useState<FundingDataSource | null>(null)
  const [syncingSourceId, setSyncingSourceId] = useState('')
  const [deleteSourceId, setDeleteSourceId] = useState('')
  const [sourceNotice, setSourceNotice] = useState('')
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

  function updateField<Key extends keyof PlatformConfig>(
    field: Key,
    value: PlatformConfig[Key],
  ) {
    setDraft((current) => ({ ...current, [field]: value }))
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
    setDraft((current) => ({
      ...current,
      ai: {
        ...current.ai,
        defaultModel:
          field === 'id' && current.ai.defaultModel === modelId
            ? String(value)
            : current.ai.defaultModel,
        models: current.ai.models.map((model) =>
          model.id === modelId
            ? {
                ...model,
                [field]: value,
                ...(field === 'id' && model.name === model.id
                  ? { name: String(value) }
                  : {}),
                connectionStatus: 'untested',
                connectionError: '',
                lastTestedAt: '',
              }
            : model,
        ),
      },
    }))
    setSaved(false)
    setTestingAIModels({})
  }

  function addAIModel() {
    const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
    const model: AIModelConfig = {
      id: `model-${suffix}`,
      name: 'New model',
      providerId: draft.ai.provider || draft.ai.providers[0]?.id || 'custom',
      context: 'Context window',
      description: 'Configurable generation model',
      apiKey: '',
      url: getDefaultAIModelURL(
        draft.ai.provider || draft.ai.providers[0]?.id || 'custom',
        `model-${suffix}`,
      ),
      contentType: 'application/json',
      authorization: 'Bearer {{apiKey}}',
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
      { id: `custom-document-type-${Date.now()}`, name: 'New document type' },
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

  function toggleAIModel(modelId: string) {
    const model = draft.ai.models.find((candidate) => candidate.id === modelId)
    if (!model) return

    if (model.enabled && draft.ai.defaultModel === modelId) {
      const replacement = draft.ai.models.find(
        (candidate) => candidate.id !== modelId && candidate.enabled,
      )
      if (!replacement) return
      setDefaultAIModel(replacement.id)
    }

    updateAIModel(modelId, 'enabled', !model.enabled)
  }

  function updateDataSource(
    field: keyof FundingDataSource,
    value: FundingDataSource[keyof FundingDataSource],
  ) {
    setSourceEditor((current) => (current ? { ...current, [field]: value } : current))
    setSourceNotice('')
  }

  function saveDataSource() {
    if (!sourceEditor?.name.trim()) {
      setSourceNotice('Add a name before saving this data source.')
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

  function deleteDataSource(sourceId: string) {
    const source = draft.dataSources.find((item) => item.id === sourceId)
    setDraft((current) => ({
      ...current,
      dataSources: current.dataSources.filter((item) => item.id !== sourceId),
    }))
    removeSyncedFundingPrograms(sourceId)
    removeSyncedResourceRecords(sourceId)
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
        const programs = await syncFundingDataSource(source)
        saveSyncedFundingPrograms(source.id, programs)
        recordCount = programs.length
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
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            model_name: model.id,
            provider_id: model.providerId,
            api_key: model.apiKey,
            url: getAIModelEndpoint(model),
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

  function saveSettings(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    updateConfig(draft)
    setSaved(true)
  }

  function restoreDefaults() {
    resetConfig()
    setDraft(config)
    window.location.reload()
  }

  return (
    <div className="admin-shell">
      <aside className="admin-rail">
        <Link className="admin-brand" to="/">
          <strong>Admin Console</strong>
        </Link>
        <nav>
          <a href="#general">General</a>
          <a href="#branding">Branding</a>
          <a href="#landing-page">Landing Page</a>
          <a href="#modules">Modules</a>
          <a href="#data-sources">Data Sources</a>
          <a href="#payments">Payments</a>
          <a href="#pricing">Pricing</a>
          <a href="#revenue">Revenue</a>
          <a href="#advisory-hub">Advisory Hub</a>
          <a href="#advisory-hub-document-types">Advisory Hub - Document Types</a>
          <a href="#advisory-hub-agents">Advisory Hub - Agents</a>
          <a href="#ai-models">AI Models</a>
          <a href="#legal">Legal</a>
          <a href="#licensing">Licensing</a>
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
                      aria-hidden="true"
                    >
                      {source.provider === 'google-sheets' ? 'G' : 'A'}
                    </span>
                    <div className="admin-source-identity">
                      <span>
                        <strong>{source.name}</strong>
                        <em>{source.provider === 'google-sheets' ? 'Google Sheets' : 'Airtable'}</em>
                      </span>
                      <small>
                        {dataSourceModuleLabels[source.module]} · {source.frequency} sync
                        {source.lastSyncedAt ? ` · ${source.lastSyncedAt}` : ''}
                      </small>
                      {source.lastError ? <b>{source.lastError}</b> : null}
                    </div>
                    <div className="admin-source-records">
                      <strong>{source.recordCount}</strong>
                      <small>records</small>
                    </div>
                    <span className={`admin-source-status is-${source.status}`}>
                      <i />
                      {source.status}
                    </span>
                    <label className="admin-source-toggle">
                      <span className="sr-only">Enable {source.name}</span>
                      <input
                        type="checkbox"
                        checked={source.enabled}
                        onChange={() => toggleDataSource(source.id)}
                      />
                    </label>
                    <div className="admin-source-actions">
                      <button
                        type="button"
                        disabled={syncingSourceId === source.id}
                        onClick={() => syncDataSource(source)}
                      >
                        {syncingSourceId === source.id ? 'Syncing…' : 'Sync'}
                      </button>
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
                    </div>
                  </article>
                ))}
              </div>

              {visibleDataSources.length === 0 ? (
                <div className="admin-source-empty">
                  <strong>No matching data sources</strong>
                  <p>Clear the search or add a new Google Sheets or Airtable source.</p>
                </div>
              ) : null}

              <div className="admin-data-contract">
                <strong>Automatic field mapping</strong>
                <p>
                  Funding sources map program fields. Resource sources map Title,
                  Description, Category, Status, URL, and Updated. Common variations
                  are recognized automatically.
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
              <h2>Advisory Hub</h2>
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
                      Toggle, rename, assign, and reorder sections. At least one
                      section must stay enabled.
                    </p>
                  </div>
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
                          inside Advisory Hub.
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
                        </div>
                      </div>
                    </article>
                  ))}
                </div>
              </div>
            </div>
          </section>

          <section
            className="admin-card admin-management-card"
            id="advisory-hub-document-types"
          >
            <div className="admin-section-copy">
              <p className="admin-section-number">10</p>
              <h2>Advisory Hub - Document Types</h2>
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
              <p className="admin-section-number">11</p>
              <h2>Advisory Hub - Agents</h2>
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
              <p className="admin-section-number">12</p>
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
                            onChange={() => toggleAIModel(model.id)}
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
                    <button
                      type="button"
                      className="admin-button-secondary admin-ai-model-remove"
                      onClick={() => removeAIModel(model.id)}
                      disabled={draft.ai.models.length <= 1}
                    >
                      Remove model
                    </button>
                  </article>
                ))}
              </div>

            </div>
          </section>

          <section className="admin-card" id="legal">
            <div className="admin-section-copy">
              <p className="admin-section-number">13</p>
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

          <section className="admin-card" id="licensing">
            <div className="admin-section-copy">
              <p className="admin-section-number">14</p>
              <h2>Commercial licensing</h2>
              <p>
                Configure the paid alternative for organizations that cannot use
                the AGPL edition.
              </p>
            </div>
            <div className="admin-fields">
              <label>
                <span>License price label</span>
                <input
                  value={draft.commercialLicensePrice}
                  onChange={(event) =>
                    updateField('commercialLicensePrice', event.target.value)
                  }
                />
              </label>
              <label>
                <span>Purchase or contact URL</span>
                <input
                  value={draft.commercialLicenseUrl}
                  onChange={(event) =>
                    updateField('commercialLicenseUrl', event.target.value)
                  }
                />
              </label>
              {commercialLicenseUnlocked ? (
                <label className="admin-field-wide">
                  <span>OpenBcon footer attribution</span>
                  <select
                    value={draft.openBconAttributionVisible ? 'visible' : 'hidden'}
                    onChange={(event) =>
                      updateField(
                        'openBconAttributionVisible',
                        event.target.value === 'visible',
                      )
                    }
                  >
                    <option value="visible">Visible</option>
                    <option value="hidden">Hidden</option>
                  </select>
                </label>
              ) : (
                <div className="admin-license-lock admin-field-wide">
                  <strong>Community edition lock</strong>
                  <p>
                    OpenBcon attribution is required in the landing page and
                    dashboard footer. Purchase a commercial license and set
                    <code> VITE_COMMERCIAL_LICENSED=true </code>
                    to unlock visibility control.
                  </p>
                </div>
              )}
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
          </section>

          <div className="admin-actions">
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
                      updateDataSource(
                        'provider',
                        event.target.value as FundingDataSourceProvider,
                      )
                    }
                  >
                    <option value="google-sheets">Google Sheets</option>
                    <option value="airtable">Airtable</option>
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
                ) : (
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
                )}

                <label className="admin-switch-row admin-source-field-wide">
                  <span>
                    <strong>Enable this data source</strong>
                    <small>
                      Include synchronized records in{' '}
                      {dataSourceModuleLabels[sourceEditor.module]}.
                    </small>
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
                    : 'Server-side authentication'}
                </strong>
                <p>
                  {sourceEditor.provider === 'google-sheets'
                    ? 'Only public or link-readable sheets can be synchronized directly by the open-source frontend.'
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
