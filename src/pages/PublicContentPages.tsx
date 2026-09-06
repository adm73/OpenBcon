import { useEffect, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { PublicSiteFooter, PublicSiteHeader } from '../components/PublicSiteChrome'
import { usePlatformConfig } from '../config/usePlatformConfig'
import { getPlatformDisplayName } from '../lib/platformBrand'
import { useTranslation } from '../i18n'
import { loadResourceRecords } from '../data/fundingSources'

function usePublicPageTitle(title: string) {
  const { config } = usePlatformConfig()
  const platformName = getPlatformDisplayName(config)

  useEffect(() => {
    document.title = `${title} | ${platformName}`
  }, [platformName, title])
}

const caseStudyKeys = ['founder', 'advisor', 'economicDevelopment'] as const

export function CaseStudiesPage() {
  const { config } = usePlatformConfig()
  const { t } = useTranslation()
  usePublicPageTitle(t('publicSite.caseStudies.pageTitle'))
  const syncedCaseStudies = useMemo(() => {
    const sourceIds = config.dataSources
      .filter((source) => source.enabled && source.module === 'case-studies')
      .map((source) => source.id)
    return loadResourceRecords('case-studies', sourceIds)
  }, [config.dataSources])

  return (
    <div className="landing-v2 public-editorial-page">
      <PublicSiteHeader />
      <main className="public-editorial-main public-case-studies-main">
        <header className="public-editorial-heading">
          <p className="public-editorial-eyebrow">{t('publicSite.caseStudies.eyebrow')}</p>
          <h1>{t('publicSite.caseStudies.heading')}</h1>
          <p>{t('publicSite.caseStudies.description')}</p>
        </header>

        <section className="public-case-studies-grid" aria-label={t('publicSite.caseStudies.listLabel')}>
          {(syncedCaseStudies.length ? syncedCaseStudies : caseStudyKeys).map((item, index) => {
            const isSynced = typeof item !== 'string'
            const key = isSynced ? item.id : item
            const label = isSynced ? item.category : t(`publicSite.caseStudies.items.${item}.label`)
            const title = isSynced ? item.title : t(`publicSite.caseStudies.items.${item}.title`)
            const body = isSynced ? item.description : t(`publicSite.caseStudies.items.${item}.body`)

            return (
            <article className="public-case-study-card" key={key}>
              <div className={`public-case-study-art is-${index + 1}`} aria-hidden="true">
                <span>{String(index + 1).padStart(2, '0')}</span>
                <strong>oB</strong>
              </div>
              <div className="public-case-study-copy">
                <p className="public-case-study-label">{label}</p>
                <h2>{title}</h2>
                <p>{body}</p>
                <Link to="/programs" className="public-editorial-link">
                  {t('publicSite.caseStudies.explore')} <span aria-hidden="true">→</span>
                </Link>
              </div>
            </article>
            )
          })}
        </section>
      </main>
      <PublicSiteFooter />
    </div>
  )
}

const valueKeys = ['clarity', 'openness', 'momentum'] as const

export function AboutUsPage() {
  const { t } = useTranslation()
  usePublicPageTitle(t('publicSite.aboutUs.pageTitle'))

  return (
    <div className="landing-v2 public-editorial-page">
      <PublicSiteHeader />
      <main className="public-editorial-main public-about-main">
        <header className="public-editorial-heading">
          <p className="public-editorial-eyebrow">{t('publicSite.aboutUs.eyebrow')}</p>
          <h1>{t('publicSite.aboutUs.heading')}</h1>
          <p>{t('publicSite.aboutUs.description')}</p>
        </header>

        <section className="public-about-story">
          <div className="public-about-story-mark" aria-hidden="true">
            <span>oB</span>
          </div>
          <div>
            <p className="public-editorial-eyebrow">{t('publicSite.aboutUs.storyEyebrow')}</p>
            <h2>{t('publicSite.aboutUs.storyHeading')}</h2>
            <p>{t('publicSite.aboutUs.storyBody')}</p>
            <p>{t('publicSite.aboutUs.storyBodyTwo')}</p>
          </div>
        </section>

        <section className="public-about-values" aria-label={t('publicSite.aboutUs.valuesHeading')}>
          <div className="public-about-section-heading">
            <p className="public-editorial-eyebrow">{t('publicSite.aboutUs.valuesEyebrow')}</p>
            <h2>{t('publicSite.aboutUs.valuesHeading')}</h2>
          </div>
          <div className="public-about-values-grid">
            {valueKeys.map((key, index) => (
              <article key={key}>
                <span>{String(index + 1).padStart(2, '0')}</span>
                <h3>{t(`publicSite.aboutUs.values.${key}.title`)}</h3>
                <p>{t(`publicSite.aboutUs.values.${key}.body`)}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="public-about-cta">
          <div>
            <p className="public-editorial-eyebrow">{t('publicSite.aboutUs.ctaEyebrow')}</p>
            <h2>{t('publicSite.aboutUs.ctaHeading')}</h2>
          </div>
          <Link to="/programs" className="public-editorial-button">
            {t('publicSite.aboutUs.cta')} <span aria-hidden="true">→</span>
          </Link>
        </section>
      </main>
      <PublicSiteFooter />
    </div>
  )
}
