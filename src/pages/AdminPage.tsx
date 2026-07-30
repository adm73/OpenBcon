import { useEffect, useState, type ChangeEvent, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { usePlatformConfig } from '../config/usePlatformConfig'
import {
  type AIConfig,
  type LandingContentConfig,
  type LandingFooterConfig,
  type LandingFooterLegalLinkConfig,
  type LandingFooterNavItemConfig,
  type LandingHeaderConfig,
  type LandingHeaderNavItemConfig,
  type LegalDocumentConfig,
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
  { id: 'quick-generate', label: 'Quick Generate', group: 'Funding Centre' },
  { id: 'my-company', label: 'My Company', group: 'My Workspace' },
  { id: 'saved-programs', label: 'Saved Programs', group: 'My Workspace' },
  { id: 'my-applications', label: 'My Applications', group: 'My Workspace' },
  { id: 'grants-loans', label: 'Grants & Loans', group: 'Programs' },
  { id: 'templates', label: 'Templates', group: 'Programs' },
  { id: 'social-resources', label: 'Social Resources', group: 'Programs' },
  { id: 'tools', label: 'Tools', group: 'Programs' },
  { id: 'partner-portal', label: 'Partner Portal', group: 'Commercial' },
]

const modelCatalog = [
  {
    id: 'gpt-5-mini',
    provider: 'OpenAI',
    context: '400K',
    use: 'Fast document drafting',
  },
  {
    id: 'gpt-5.2',
    provider: 'OpenAI',
    context: '400K',
    use: 'Complex financial reasoning',
  },
  {
    id: 'claude-sonnet-4-5',
    provider: 'Anthropic',
    context: '200K',
    use: 'Long-form narrative',
  },
  {
    id: 'gemini-3-flash',
    provider: 'Google',
    context: '1M',
    use: 'Large source packages',
  },
]

const recentTransactions = [
  ['INV-1048', 'Northstar Advisory', '$79.00', 'Succeeded', 'Jul 28'],
  ['INV-1047', 'Greenline Partners', '$790.00', 'Succeeded', 'Jul 27'],
  ['INV-1046', 'Fieldnote Studio', '$79.00', 'Refunded', 'Jul 25'],
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

export function AdminPage() {
  const { config, updateConfig, resetConfig } = usePlatformConfig()
  const [draft, setDraft] = useState<PlatformConfig>(config)
  const [saved, setSaved] = useState(false)
  const [paymentNotice, setPaymentNotice] = useState('')
  const [aiTestStatus, setAiTestStatus] = useState<
    'idle' | 'testing' | 'connected'
  >('idle')
  const [sourceQuery, setSourceQuery] = useState('')
  const [sourceModuleFilter, setSourceModuleFilter] = useState<
    'all' | DataSourceModule
  >('all')
  const [sourceEditor, setSourceEditor] = useState<FundingDataSource | null>(null)
  const [syncingSourceId, setSyncingSourceId] = useState('')
  const [deleteSourceId, setDeleteSourceId] = useState('')
  const [sourceNotice, setSourceNotice] = useState('')
  const enabledModuleCount = Object.values(draft.modules).filter(Boolean).length
  const generationModeLabel = draft.ai.mockModeEnabled ? 'Mock mode' : 'Live backend'
  const commercialLicenseUnlocked = hasCommercialLicenseAccess()
  const platformName = getPlatformDisplayName(draft)
  const platformInitial = getPlatformInitial(draft)
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

  function updateAIField<Key extends keyof AIConfig>(
    field: Key,
    value: AIConfig[Key],
  ) {
    setDraft((current) => ({
      ...current,
      ai: { ...current.ai, [field]: value },
    }))
    setSaved(false)
    setAiTestStatus('idle')
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

  function toggleModel(modelId: string) {
    const isEnabled = draft.ai.enabledModels.includes(modelId)
    const nextModels = isEnabled
      ? draft.ai.enabledModels.filter((id) => id !== modelId)
      : [...draft.ai.enabledModels, modelId]

    updateAIField('enabledModels', nextModels)
    if (isEnabled && draft.ai.defaultModel === modelId) {
      updateAIField('defaultModel', nextModels[0] ?? '')
    }
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

  async function testAIConnection() {
    setAiTestStatus('testing')
    await new Promise((resolve) => window.setTimeout(resolve, 750))
    setAiTestStatus('connected')
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
        <p className="admin-environment"><i /> Community workspace</p>
        <nav>
          <a href="#general">General</a>
          <a href="#branding">Branding</a>
          <a href="#landing-page">Landing Page</a>
          <a href="#modules">Modules</a>
          <a href="#data-sources">Data Sources</a>
          <a href="#payments">Payments</a>
          <a href="#ai-models">AI Models</a>
          <a href="#legal">Legal</a>
          <a href="#licensing">Licensing</a>
        </nav>
        <Link className="admin-back-link" to="/dashboard">
          Back to workspace
        </Link>
      </aside>

      <main className="admin-main">
        <header className="admin-header">
          <div>
            <p className="admin-eyebrow">Control plane · Local environment</p>
            <h1>Platform configuration</h1>
            <p>
              Shape the product identity, module access, and licensing model
              without changing application code.
            </p>
          </div>
          <Link className="admin-preview-link" to="/dashboard">Preview workspace</Link>
        </header>

        <div className="admin-notice">
          <strong>Production checklist</strong>
          <span>
            This UI is intentionally front-end only for the demo. Protect `/admin`
            with server-side authentication before production deployment.
          </span>
        </div>

        <section className="admin-overview">
          <article>
            <span>Enabled modules</span>
            <strong>{enabledModuleCount}<small> / {Object.keys(draft.modules).length}</small></strong>
            <p>Visible in the user workspace</p>
          </article>
          <article>
            <span>Payment provider</span>
            <strong>{draft.payments.provider}</strong>
            <p>{draft.payments.testMode ? 'Test mode enabled' : 'Live payments'}</p>
          </article>
          <article>
            <span>Default AI model</span>
            <strong className="admin-overview-model">{draft.ai.defaultModel}</strong>
            <p>{draft.ai.enabledModels.length} enabled models</p>
          </article>
          <article>
            <span>Configuration state</span>
            <strong>{saved ? 'Saved' : 'Draft'}</strong>
            <p>{saved ? 'Stored in this browser' : 'Changes not published'}</p>
          </article>
        </section>

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
                      Upload logo
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
                <div className="admin-fields">
                  <label className="admin-field-wide">
                    <span>Hero eyebrow</span>
                    <input
                      value={draft.landingPage.content.heroEyebrow}
                      onChange={(event) =>
                        updateLandingContentField('heroEyebrow', event.target.value)
                      }
                    />
                  </label>
                  <label className="admin-field-wide">
                    <span>Hero headline</span>
                    <input
                      value={draft.landingPage.content.headline}
                      onChange={(event) =>
                        updateLandingContentField('headline', event.target.value)
                      }
                    />
                  </label>
                  <label className="admin-field-wide">
                    <span>Hero subheadline</span>
                    <textarea
                      value={draft.landingPage.content.subheadline}
                      onChange={(event) =>
                        updateLandingContentField('subheadline', event.target.value)
                      }
                    />
                  </label>
                  <label>
                    <span>Primary CTA label</span>
                    <input
                      value={draft.landingPage.content.primaryCtaLabel}
                      onChange={(event) =>
                        updateLandingContentField('primaryCtaLabel', event.target.value)
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
                    <span>Features eyebrow</span>
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
                    <span>Features heading</span>
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
                    <span>Features body</span>
                    <textarea
                      value={draft.landingPage.content.featuresBody}
                      onChange={(event) =>
                        updateLandingContentField('featuresBody', event.target.value)
                      }
                    />
                  </label>
                  <label>
                    <span>Workflow eyebrow</span>
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
                    <span>Workflow heading</span>
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
                  <label>
                    <span>Open source eyebrow</span>
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
                    <span>Open source heading</span>
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
                    <span>Open source body</span>
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
                  <label>
                    <span>Admin CTA label</span>
                    <input
                      value={draft.landingPage.content.adminCtaLabel}
                      onChange={(event) =>
                        updateLandingContentField('adminCtaLabel', event.target.value)
                      }
                    />
                  </label>
                </div>

                <div className="admin-landing-proof-grid">
                  {draft.landingPage.content.proofItems.map((item, index) => (
                    <div key={`${item.value}-${index}`} className="admin-landing-proof-card">
                      <strong>Proof item {index + 1}</strong>
                      <div className="admin-fields">
                        <label>
                          <span>Value</span>
                          <input
                            value={item.value}
                            onChange={(event) =>
                              updateLandingProofItem(index, 'value', event.target.value)
                            }
                          />
                        </label>
                        <label className="admin-field-wide">
                          <span>Label</span>
                          <input
                            value={item.label}
                            onChange={(event) =>
                              updateLandingProofItem(index, 'label', event.target.value)
                            }
                          />
                        </label>
                      </div>
                    </div>
                  ))}
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
                Configure checkout, subscription pricing, and payment event routing.
              </p>
            </div>
            <div className="admin-management-content">
              <div className="admin-management-status">
                <span className={draft.payments.enabled ? 'is-online' : ''}>
                  <i />
                  {draft.payments.enabled ? 'Payments enabled' : 'Payments disabled'}
                </span>
                <button
                  type="button"
                  onClick={() =>
                    setPaymentNotice(
                      `Test checkout created with ${draft.payments.provider} in ${
                        draft.payments.testMode ? 'test' : 'live'
                      } mode.`,
                    )
                  }
                >
                  Run test checkout
                </button>
              </div>

              {paymentNotice ? (
                <div className="admin-management-notice" role="status">
                  {paymentNotice}
                </div>
              ) : null}

              <div className="admin-payment-metrics">
                <article><span>Monthly recurring</span><strong>$12,640</strong><small>+14.2% this month</small></article>
                <article><span>Active subscriptions</span><strong>164</strong><small>3 past due</small></article>
                <article><span>Successful payments</span><strong>98.7%</strong><small>Last 30 days</small></article>
              </div>

              <div className="admin-fields">
                <label>
                  <span>Payment provider</span>
                  <select
                    value={draft.payments.provider}
                    onChange={(event) =>
                      updatePaymentField(
                        'provider',
                        event.target.value as PaymentConfig['provider'],
                      )
                    }
                  >
                    <option value="stripe">Stripe</option>
                    <option value="paddle">Paddle</option>
                    <option value="manual">Manual invoicing</option>
                  </select>
                </label>
                <label>
                  <span>Billing currency</span>
                  <select
                    value={draft.payments.currency}
                    onChange={(event) =>
                      updatePaymentField(
                        'currency',
                        event.target.value as PaymentConfig['currency'],
                      )
                    }
                  >
                    <option value="CAD">CAD</option>
                    <option value="USD">USD</option>
                  </select>
                </label>
                <label>
                  <span>Monthly price</span>
                  <input
                    inputMode="decimal"
                    value={draft.payments.monthlyPrice}
                    onChange={(event) =>
                      updatePaymentField('monthlyPrice', event.target.value)
                    }
                  />
                </label>
                <label>
                  <span>Annual price</span>
                  <input
                    inputMode="decimal"
                    value={draft.payments.annualPrice}
                    onChange={(event) =>
                      updatePaymentField('annualPrice', event.target.value)
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
                  />
                </label>
                <label className="admin-switch-row">
                  <span>
                    <strong>Accept payments</strong>
                    <small>Show checkout and subscription actions to users.</small>
                  </span>
                  <input
                    type="checkbox"
                    checked={draft.payments.enabled}
                    onChange={(event) =>
                      updatePaymentField('enabled', event.target.checked)
                    }
                  />
                </label>
                <label className="admin-switch-row">
                  <span>
                    <strong>Test mode</strong>
                    <small>Use sandbox credentials and non-billable transactions.</small>
                  </span>
                  <input
                    type="checkbox"
                    checked={draft.payments.testMode}
                    onChange={(event) =>
                      updatePaymentField('testMode', event.target.checked)
                    }
                  />
                </label>
              </div>

              <div className="admin-transaction-panel">
                <div>
                  <strong>Recent transactions</strong>
                  <span>Demo transaction feed</span>
                </div>
                {recentTransactions.map(([invoice, customer, amount, status, date]) => (
                  <article key={invoice}>
                    <b>{invoice}</b>
                    <span>{customer}</span>
                    <strong>{amount}</strong>
                    <em className={`status-${status.toLowerCase()}`}>{status}</em>
                    <small>{date}</small>
                  </article>
                ))}
              </div>
            </div>
          </section>

          <section className="admin-card admin-management-card" id="ai-models">
            <div className="admin-section-copy">
              <p className="admin-section-number">07</p>
              <h2>AI model management</h2>
              <p>
                Choose providers and models used by document generation workflows.
              </p>
            </div>
            <div className="admin-management-content">
              <div className="admin-management-status admin-ai-status">
                <span className={aiTestStatus === 'connected' ? 'is-online' : ''}>
                  <i />
                  {draft.ai.mockModeEnabled
                    ? 'Mock mode enabled'
                    : aiTestStatus === 'testing'
                      ? 'Testing connection'
                      : aiTestStatus === 'connected'
                        ? 'Connection healthy'
                        : 'Connection not tested'}
                </span>
                <button
                  type="button"
                  disabled={aiTestStatus === 'testing'}
                  onClick={testAIConnection}
                >
                  {aiTestStatus === 'testing' ? 'Testing…' : 'Test connection'}
                </button>
              </div>

              <div className="admin-secret-note">
                <strong>Current generation mode: {generationModeLabel}</strong>
                <p>
                  {draft.ai.mockModeEnabled
                    ? 'Quick Generate will return deterministic demo output until you switch back to the live backend.'
                    : 'Quick Generate will send generation requests to the Python backend and use the configured model stack.'}
                </p>
              </div>

              <div className="admin-fields">
                <label>
                  <span>Primary provider</span>
                  <select
                    value={draft.ai.provider}
                    onChange={(event) =>
                      updateAIField(
                        'provider',
                        event.target.value as AIConfig['provider'],
                      )
                    }
                  >
                    <option value="openai">OpenAI</option>
                    <option value="anthropic">Anthropic</option>
                    <option value="google">Google</option>
                    <option value="custom">OpenAI-compatible</option>
                  </select>
                </label>
                <label>
                  <span>Default generation model</span>
                  <select
                    value={draft.ai.defaultModel}
                    onChange={(event) =>
                      updateAIField('defaultModel', event.target.value)
                    }
                  >
                    {draft.ai.enabledModels.map((model) => (
                      <option key={model}>{model}</option>
                    ))}
                  </select>
                </label>
                <label>
                  <span>Generation mode</span>
                  <select
                    value={draft.ai.mockModeEnabled ? 'mock' : 'live'}
                    onChange={(event) =>
                      updateAIField('mockModeEnabled', event.target.value === 'mock')
                    }
                  >
                    <option value="live">Live backend</option>
                    <option value="mock">Mock mode</option>
                  </select>
                  <small>
                    Mock mode returns deterministic demo output for Quick Generate
                    and skips live model usage inside the Python backend.
                  </small>
                </label>
                <label className="admin-field-wide">
                  <span>Server API endpoint</span>
                  <input
                    value={draft.ai.apiBaseUrl}
                    onChange={(event) =>
                      updateAIField('apiBaseUrl', event.target.value)
                    }
                  />
                </label>
                <label>
                  <span>Server secret reference</span>
                  <input
                    value={draft.ai.apiKeyReference}
                    onChange={(event) =>
                      updateAIField('apiKeyReference', event.target.value)
                    }
                  />
                  <small>Environment-variable name only. Never store the secret in the browser.</small>
                </label>
                <label>
                  <span>Temperature</span>
                  <input
                    type="number"
                    min="0"
                    max="1"
                    step="0.1"
                    value={draft.ai.temperature}
                    onChange={(event) =>
                      updateAIField('temperature', event.target.value)
                    }
                  />
                </label>
              </div>

              <div className="admin-model-catalog">
                <div>
                  <strong>Available models</strong>
                  <span>{draft.ai.enabledModels.length} enabled</span>
                </div>
                {modelCatalog.map((model) => {
                  const enabled = draft.ai.enabledModels.includes(model.id)
                  return (
                    <label key={model.id}>
                      <span className="admin-model-provider">{model.provider.charAt(0)}</span>
                      <span>
                        <strong>{model.id}</strong>
                        <small>{model.provider} · {model.context} context · {model.use}</small>
                      </span>
                      {draft.ai.defaultModel === model.id ? <b>Default</b> : null}
                      <input
                        type="checkbox"
                        checked={enabled}
                        onChange={() => toggleModel(model.id)}
                      />
                    </label>
                  )
                })}
              </div>

              <div className="admin-secret-note">
                <strong>Server-side credentials required</strong>
                <p>
                  {draft.ai.mockModeEnabled
                    ? 'Mock mode is currently active, so live provider credentials are not required for local demos.'
                    : 'The open-source frontend stores only configuration references. Connect `/api/ai` to a secured backend before enabling production generation.'}
                </p>
              </div>
            </div>
          </section>

          <section className="admin-card" id="legal">
            <div className="admin-section-copy">
              <p className="admin-section-number">08</p>
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
              <p className="admin-section-number">09</p>
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
      </main>
    </div>
  )
}
