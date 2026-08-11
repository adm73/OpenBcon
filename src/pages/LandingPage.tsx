import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { PublicSiteFooter, PublicSiteHeader } from '../components/PublicSiteChrome'
import { defaultPlatformConfig } from '../config/platform'
import { usePlatformConfig } from '../config/usePlatformConfig'
import { dashboardMetrics, landingHighlights } from '../data/demo'
import { useTranslation } from '../i18n'
import { getPlatformDisplayName, getPlatformInitial } from '../lib/platformBrand'
import { loadFundingProgramCountViaApi } from '../lib/fundingProgramsApi'
import { renderFormattedContent } from '../lib/legalContent'

function formatLandingPrice(amount: string, currency: 'CAD' | 'USD') {
  const normalizedAmount = Number.parseFloat(amount.replace(/,/gu, ''))

  if (!Number.isFinite(normalizedAmount)) {
    return `${currency} ${amount}`
  }

  return new Intl.NumberFormat('en-CA', {
    style: 'currency',
    currency,
    maximumFractionDigits: normalizedAmount % 1 === 0 ? 0 : 2,
  }).format(normalizedAmount)
}

export function LandingPage() {
  const { config } = usePlatformConfig()
  const { t } = useTranslation()
  const { content: configuredContent } = config.landingPage
  const defaultContent = defaultPlatformConfig.landingPage.content
  const [trackedProgramCount, setTrackedProgramCount] = useState<number | null>(null)

  useEffect(() => {
    let isCurrent = true

    loadFundingProgramCountViaApi()
      .then((count) => {
        if (isCurrent) setTrackedProgramCount(count)
      })
      .catch(() => {
        // Keep the configured proof value when the public catalog is unavailable.
      })

    return () => {
      isCurrent = false
    }
  }, [])

  const content = {
    ...configuredContent,
    heroEyebrow:
      configuredContent.heroEyebrow === defaultContent.heroEyebrow
        ? t('publicSite.heroEyebrow')
        : configuredContent.heroEyebrow,
    headline:
      configuredContent.headline === defaultContent.headline
        ? t('publicSite.content.headline')
        : configuredContent.headline,
    subheadline:
      configuredContent.subheadline === defaultContent.subheadline
        ? t('publicSite.content.subheadline')
        : configuredContent.subheadline,
    primaryCtaLabel:
      configuredContent.primaryCtaLabel === defaultContent.primaryCtaLabel
        ? t('publicSite.content.primaryCta')
        : configuredContent.primaryCtaLabel,
    secondaryCtaLabel:
      configuredContent.secondaryCtaLabel === defaultContent.secondaryCtaLabel
        ? t('publicSite.content.secondaryCta')
        : configuredContent.secondaryCtaLabel,
    featuresEyebrow:
      configuredContent.featuresEyebrow === defaultContent.featuresEyebrow
        ? t('publicSite.content.featuresEyebrow')
        : configuredContent.featuresEyebrow,
    featuresHeading:
      configuredContent.featuresHeading === defaultContent.featuresHeading
        ? t('publicSite.content.featuresHeading')
        : configuredContent.featuresHeading,
    featuresBody:
      configuredContent.featuresBody === defaultContent.featuresBody
        ? t('publicSite.content.featuresBody')
        : configuredContent.featuresBody,
    workflowEyebrow:
      configuredContent.workflowEyebrow === defaultContent.workflowEyebrow
        ? t('publicSite.content.workflowEyebrow')
        : configuredContent.workflowEyebrow,
    workflowHeading:
      configuredContent.workflowHeading === defaultContent.workflowHeading
        ? t('publicSite.content.workflowHeading')
        : configuredContent.workflowHeading,
    openSourceEyebrow:
      configuredContent.openSourceEyebrow === defaultContent.openSourceEyebrow
        ? t('publicSite.content.openSourceEyebrow')
        : configuredContent.openSourceEyebrow,
    openSourceHeading:
      configuredContent.openSourceHeading === defaultContent.openSourceHeading
        ? t('publicSite.content.openSourceHeading')
        : configuredContent.openSourceHeading,
    openSourceBody:
      configuredContent.openSourceBody === defaultContent.openSourceBody
        ? t('publicSite.content.openSourceBody')
        : configuredContent.openSourceBody,
    adminCtaLabel:
      configuredContent.adminCtaLabel === defaultContent.adminCtaLabel
        ? t('publicSite.content.adminCta')
        : configuredContent.adminCtaLabel,
    proofItems: configuredContent.proofItems.map((item, index) => {
      const defaultItem = defaultContent.proofItems[index]
      return {
        value:
          index === 0 && defaultItem?.value === item.value && trackedProgramCount !== null
            ? `${new Intl.NumberFormat('en-CA').format(trackedProgramCount)}+`
            : defaultItem?.value === item.value
              ? t(`publicSite.proofItems.${index}.value`, { defaultValue: item.value })
            : item.value,
        label:
          defaultItem?.label === item.label
            ? t(`publicSite.proofItems.${index}.label`, { defaultValue: item.label })
            : item.label,
      }
    }),
  }
  const platformName = getPlatformDisplayName(config)
  const platformInitial = getPlatformInitial(config)
  const activePricingItems = config.payments.priceCatalog.filter((item) => item.active)

  useEffect(() => {
    document.title = `${platformName} | Funding-ready business documents`
  }, [platformName])

  return (
    <div className="landing-v2">
      <PublicSiteHeader />

      <main>
        <section className="landing-v2-hero">
          <div className="landing-v2-copy">
            <p><span /> {content.heroEyebrow}</p>
            <h1>{content.headline}</h1>
            <p>{content.subheadline}</p>
            <div className="landing-v2-actions">
              <Link to="/dashboard">{content.primaryCtaLabel} <b>→</b></Link>
              <Link to="/signup">{content.secondaryCtaLabel}</Link>
            </div>
            <div className="landing-v2-proof">
              {content.proofItems.map((item) => (
                <span key={`${item.value}-${item.label}`}>
                  <b>{item.value}</b> {item.label}
                </span>
              ))}
            </div>
          </div>

          <div className="landing-v2-product">
            <div className="landing-v2-windowbar">
              <span><i /><i /><i /></span>
              <small>{t('publicSite.preview.workspace')}</small>
              <b>{t('publicSite.preview.live')}</b>
            </div>
            <div className="landing-v2-preview">
              <aside>
                <strong><span>{platformInitial}</span> {platformName}</strong>
                <i className="is-active">{t('publicSite.preview.overview')}</i>
                <i>{t('publicSite.preview.fundingReadiness')}</i>
                <i>{t('publicSite.preview.applications')}</i>
                <i>{t('publicSite.preview.quickBuild')}</i>
              </aside>
              <section>
                <small>{t('publicSite.preview.readinessLabel')}</small>
                <h2>{t('publicSite.preview.readinessHeadline')}</h2>
                <div className="landing-v2-preview-score">
                  <strong>72</strong>
                  <span>{t('publicSite.preview.almostReady')}<br /><b>{t('publicSite.preview.thisMonth')}</b></span>
                </div>
                <div className="landing-v2-preview-bars">
                  <i><b style={{ width: '84%' }} /></i>
                  <i><b style={{ width: '68%' }} /></i>
                  <i><b style={{ width: '76%' }} /></i>
                </div>
              </section>
            </div>
          </div>
        </section>

        <section className="landing-v2-trust">
          <span>{t('publicSite.trust.designedFor')}</span>
          <strong>{t('publicSite.trust.founders')}</strong>
          <strong>{t('publicSite.trust.advisors')}</strong>
          <strong>{t('publicSite.trust.economicDevelopment')}</strong>
          <strong>{t('publicSite.trust.consultants')}</strong>
        </section>

        <section className="landing-v2-features" id="features">
          <div className="landing-v2-section-copy">
            <p>{content.featuresEyebrow}</p>
            <h2>{content.featuresHeading}</h2>
            <span>{content.featuresBody}</span>
          </div>
          <div className="landing-v2-feature-grid">
            {landingHighlights.map((item, index) => {
              const defaultItem = landingHighlights[index]
              const localizedItem = {
                label:
                  item.label === defaultItem.label
                    ? t(`publicSite.features.items.${index}.label`, { defaultValue: item.label })
                    : item.label,
                body:
                  item.body === defaultItem.body
                    ? t(`publicSite.features.items.${index}.body`, { defaultValue: item.body })
                    : item.body,
              }

              return (
              <article key={localizedItem.label}>
                <span>0{index + 1}</span>
                <h3>{localizedItem.label}</h3>
                <p>{localizedItem.body}</p>
                <b>{t('publicSite.features.cta')}</b>
              </article>
              )
            })}
          </div>
        </section>

        <section className="landing-v2-workflow" id="workflow">
          <div>
            <p>{content.workflowEyebrow}</p>
            <h2>{content.workflowHeading}</h2>
          </div>
          <ol>
            <li>
              <span>01</span>
              <div><strong>{t('publicSite.workflow.0.title')}</strong><p>{t('publicSite.workflow.0.body')}</p></div>
            </li>
            <li>
              <span>02</span>
              <div><strong>{t('publicSite.workflow.1.title')}</strong><p>{t('publicSite.workflow.1.body')}</p></div>
            </li>
            <li>
              <span>03</span>
              <div><strong>{t('publicSite.workflow.2.title')}</strong><p>{t('publicSite.workflow.2.body')}</p></div>
            </li>
          </ol>
        </section>

        <section className="landing-v2-pricing" id="pricing">
          <div className="landing-v2-section-copy">
            <p>{t('publicSite.pricing.eyebrow')}</p>
            <h2>{t('publicSite.pricing.heading')}</h2>
            <span>{t('publicSite.pricing.body')}</span>
          </div>
          <div className="landing-v2-pricing-grid">
            {activePricingItems.length > 0 ? (
              activePricingItems.map((item) => (
                <article
                  key={item.id}
                  className={
                    item.billingType === 'monthly'
                      ? 'landing-v2-pricing-card is-featured'
                      : 'landing-v2-pricing-card'
                  }
                >
                  <h3>{item.name}</h3>
                  <div
                    className="landing-v2-pricing-description"
                    dangerouslySetInnerHTML={{
                      __html: renderFormattedContent(
                        item.description || `${platformName} ${item.offeringType} offering.`,
                        item.descriptionFormat,
                      ),
                    }}
                  />
                  <strong>{formatLandingPrice(item.amount, item.currency)}</strong>
                  <small>
                    {item.billingType === 'one-time'
                      ? t('publicSite.pricing.oneTime')
                      : item.billingType === 'annual'
                        ? t('publicSite.pricing.annual')
                        : t('publicSite.pricing.monthly')}
                  </small>
                  <div className="landing-v2-actions">
                    <Link to="/signup">{t('publicSite.pricing.getStarted')}</Link>
                  </div>
                </article>
              ))
            ) : (
              <article className="landing-v2-pricing-card is-empty">
                <div className="landing-v2-pricing-topline">
                  <span>{t('publicSite.pricing.topline')}</span>
                </div>
                <h3>{t('publicSite.pricing.emptyTitle')}</h3>
                <p>{t('publicSite.pricing.emptyBody')}</p>
                <div className="landing-v2-actions">
                  <Link to="/login?next=/admin#pricing">{t('publicSite.pricing.adminCta')}</Link>
                </div>
              </article>
            )}
          </div>
        </section>

        <section className="landing-v2-open" id="opensource">
          <div className="landing-v2-open-copy">
            <p>{content.openSourceEyebrow}</p>
            <h2>{content.openSourceHeading}</h2>
            <span>{content.openSourceBody}</span>
            <div className="landing-v2-actions">
              <a href={config.commercialLicenseUrl}>
              {t('publicSite.openSource.commercialLicense')} · {config.commercialLicensePrice}
              </a>
              <Link to="/login?next=/admin">{content.adminCtaLabel}</Link>
            </div>
          </div>
          <div className="landing-v2-license-card">
            <span>{t('publicSite.openSource.communityEdition')}</span>
            <strong>{t('publicSite.openSource.license')}</strong>
            <p>{t('publicSite.openSource.description')}</p>
            <hr />
            {dashboardMetrics.map((metric, index) => (
              <div key={metric.label}><span>{t(`publicSite.openSource.metrics.${index}.label`, { defaultValue: metric.label })}</span><b>{metric.value}</b></div>
            ))}
          </div>
        </section>
      </main>

      <PublicSiteFooter />
    </div>
  )
}
