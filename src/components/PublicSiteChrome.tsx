import { useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import { hasActiveSession } from '../auth/session'
import { usePlatformConfig } from '../config/usePlatformConfig'
import { getPlatformDisplayName, getPlatformInitial } from '../lib/platformBrand'
import { defaultPlatformConfig } from '../config/platform'
import {
  languageOptions,
  normalizeLocale,
  useLocale,
  useTranslation,
} from '../i18n'
import {
  OPEN_BCON_REPO_URL,
  shouldShowOpenBconAttribution,
} from '../licensing/openBconAttribution'

const TTE_WEBSITE_URL = 'https://www.tritrient.com'

type PublicNavIconName =
  | 'home'
  | 'programs'
  | 'case-studies'
  | 'documents'
  | 'about'
  | 'features'
  | 'workflow'
  | 'pricing'
  | 'open-source'

function PublicNavIcon({ name }: { name: PublicNavIconName }) {
  const commonProps = {
    className: 'public-nav-icon',
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.8,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    'aria-hidden': true,
  }

  switch (name) {
    case 'home':
      return <svg {...commonProps}><path d="m3 10 9-7 9 7" /><path d="M5 9v11h14V9" /><path d="M9 20v-6h6v6" /></svg>
    case 'programs':
      return <svg {...commonProps}><rect x="4" y="5" width="16" height="14" rx="2" /><path d="M8 9h8M8 13h5M8 16h3" /></svg>
    case 'case-studies':
      return <svg {...commonProps}><path d="M4 19V5M4 19h16" /><path d="m7 15 4-4 3 2 5-6" /></svg>
    case 'documents':
      return <svg {...commonProps}><path d="M6 3h8l4 4v14H6z" /><path d="M14 3v5h5M9 13h6M9 17h6" /></svg>
    case 'about':
      return <svg {...commonProps}><circle cx="12" cy="12" r="9" /><path d="M12 10v6M12 7h.01" /></svg>
    case 'features':
      return <svg {...commonProps}><path d="m12 3 1.5 5.5L19 10l-5.5 1.5L12 17l-1.5-5.5L5 10l5.5-1.5z" /><path d="m19 16 .6 2.4L22 19l-2.4.6L19 22l-.6-2.4L16 19l2.4-.6z" /></svg>
    case 'workflow':
      return <svg {...commonProps}><circle cx="6" cy="12" r="2" /><circle cx="18" cy="6" r="2" /><circle cx="18" cy="18" r="2" /><path d="M8 12h5M15.8 7.1l-4.6 3.7M11.2 13.2l4.6 3.7" /></svg>
    case 'pricing':
      return <svg {...commonProps}><circle cx="12" cy="12" r="9" /><path d="M12 7v10M15 9.5c-.6-.7-1.5-1-3-1-1.5 0-2.5.7-2.5 1.7 0 2.8 5.5 1 5.5 3.8 0 1.1-1 1.8-2.7 1.8-1.4 0-2.4-.4-3.1-1.1" /></svg>
    case 'open-source':
      return <svg {...commonProps}><path d="M8 8 4 12l4 4M16 8l4 4-4 4M14 5l-4 14" /></svg>
  }
}

function renderPublicLink(
  href: string,
  label: string,
  key: string,
  className?: string,
) {
  const resolvedHref = href.startsWith('#') ? `/${href}` : href
  const isExternal = /^https?:\/\//i.test(resolvedHref) || resolvedHref.startsWith('mailto:')

  if (isExternal) {
    return (
      <a
        className={className}
        href={resolvedHref}
        key={key}
        target="_blank"
        rel="noreferrer"
      >
        {label}
      </a>
    )
  }

  if (resolvedHref.startsWith('/')) {
    return (
      <Link className={className} to={resolvedHref} key={key}>
        {label}
      </Link>
    )
  }

  return (
    <a className={className} href={resolvedHref} key={key}>
      {label}
    </a>
  )
}

export function PublicSiteHeader() {
  const homepageMenuRef = useRef<HTMLDetailsElement | null>(null)
  const { config } = usePlatformConfig()
  const { locale, setLocale } = useLocale()
  const { t } = useTranslation()
  const isSignedIn = hasActiveSession()
  const platformName = getPlatformDisplayName(config)
  const platformInitial = getPlatformInitial(config)
  const { header } = config.landingPage

  useEffect(() => {
    const closeHomepageMenu = (event: PointerEvent) => {
      const menu = homepageMenuRef.current
      if (menu?.open && !menu.contains(event.target as Node)) {
        menu.open = false
      }
    }

    document.addEventListener('pointerdown', closeHomepageMenu)
    return () => document.removeEventListener('pointerdown', closeHomepageMenu)
  }, [])

  return (
    <header className="landing-v2-header">
      <Link className="landing-v2-brand" to="/">
        <span>
          {config.platformLogo ? (
            <img src={config.platformLogo} alt={`${platformName} logo`} />
          ) : (
            platformInitial
          )}
        </span>
        <strong>{platformName}</strong>
      </Link>
      <nav>
        <div className="public-nav-menu">
          <a className="public-nav-link public-nav-home" href="/#">
            <PublicNavIcon name="home" />
            {t('publicSite.nav.home')}
          </a>
          <details ref={homepageMenuRef}>
            <summary aria-label={t('publicSite.nav.openHomepageMenu')}>
              <span aria-hidden="true">⌄</span>
            </summary>
            <div className="public-nav-submenu">
              <a className="public-nav-submenu-link" href="/#features"><PublicNavIcon name="features" />{t('publicSite.nav.features')}</a>
              <a className="public-nav-submenu-link" href="/#workflow"><PublicNavIcon name="workflow" />{t('publicSite.nav.workflow')}</a>
              <a className="public-nav-submenu-link" href="/#pricing"><PublicNavIcon name="pricing" />{t('publicSite.nav.pricing')}</a>
              <a className="public-nav-submenu-link" href="/#opensource"><PublicNavIcon name="open-source" />{t('publicSite.nav.openSource')}</a>
            </div>
          </details>
        </div>
        <a className="public-nav-link" href="/programs"><PublicNavIcon name="programs" />{t('publicSite.nav.programs')}</a>
        <a className="public-nav-link" href="/#case-studies"><PublicNavIcon name="case-studies" />{t('publicSite.nav.caseStudies')}</a>
        <a className="public-nav-link" href="/#documents"><PublicNavIcon name="documents" />{t('publicSite.nav.documents')}</a>
        <a className="public-nav-link" href="/#about-us"><PublicNavIcon name="about" />{t('publicSite.nav.aboutUs')}</a>
      </nav>
      <div className="landing-v2-header-actions">
        <label className="public-language-picker">
          <span className="sr-only">{t('settings.language')}</span>
          <select
            aria-label={t('settings.language')}
            value={locale}
            onChange={(event) => setLocale(normalizeLocale(event.target.value))}
          >
            {languageOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <Link to={isSignedIn ? '/dashboard' : '/login'}>
          {isSignedIn
            ? header.dashboardLabel === defaultPlatformConfig.landingPage.header.dashboardLabel
              ? t('publicSite.nav.dashboard')
              : header.dashboardLabel
            : header.signInLabel === defaultPlatformConfig.landingPage.header.signInLabel
              ? t('publicSite.nav.signIn')
              : header.signInLabel}
        </Link>
      </div>
    </header>
  )
}

export function PublicSiteFooter() {
  const { config } = usePlatformConfig()
  const { t } = useTranslation()
  const platformName = getPlatformDisplayName(config)
  const platformInitial = getPlatformInitial(config)
  const showOpenBconAttribution = shouldShowOpenBconAttribution(config)
  const currentYear = new Date().getFullYear()
  const { footer } = config.landingPage
  const defaultFooter = defaultPlatformConfig.landingPage.footer

  return (
    <footer className="landing-v2-footer">
      <div className="landing-v2-footer-top">
        <div className="landing-v2-footer-brand-block">
          <Link className="landing-v2-brand" to="/">
            <span>
              {config.platformLogo ? (
                <img src={config.platformLogo} alt={`${platformName} logo`} />
              ) : (
                platformInitial
              )}
            </span>
            <strong>{platformName}</strong>
          </Link>
          <p className="landing-v2-footer-description">
            {footer.description === defaultFooter.description
              ? t('publicSite.footer.description')
              : footer.description}
          </p>
        </div>
        <div className="landing-v2-footer-navs">
          <div className="landing-v2-footer-column">
            <span>
              {footer.sitemapLabel === defaultFooter.sitemapLabel
                ? t('publicSite.footer.sitemap')
                : footer.sitemapLabel}
            </span>
            {footer.sitemapItems.map((item) =>
              renderPublicLink(
                item.href,
                item.label === defaultFooter.sitemapItems.find((candidate) => candidate.id === item.id)?.label
                  ? t(`publicSite.nav.${item.id}`, { defaultValue: item.label })
                  : item.label,
                `footer-${item.id}`,
              ),
            )}
          </div>
          <div className="landing-v2-footer-column">
            <span>
              {footer.platformLabel === defaultFooter.platformLabel
                ? t('publicSite.footer.platform')
                : footer.platformLabel}
            </span>
            {footer.platformItems.map((item) =>
              renderPublicLink(
                item.href,
                item.label === defaultFooter.platformItems.find((candidate) => candidate.id === item.id)?.label
                  ? t(`publicSite.nav.${item.id}`, { defaultValue: item.label })
                  : item.label,
                `platform-${item.id}`,
              ),
            )}
          </div>
        </div>
      </div>

      <div className="landing-v2-footer-bottom">
        <div className="landing-v2-footer-copyright">
          <span>
            Copyright &copy; {currentYear}{' '}
            <a href={TTE_WEBSITE_URL} target="_blank" rel="noreferrer">
              T.T.E
            </a>
          </span>
        </div>
        <div className="landing-v2-footer-links">
          {renderPublicLink(
            footer.privacyPolicy.href,
            footer.privacyPolicy.label === defaultFooter.privacyPolicy.label
              ? t('publicSite.footer.privacy')
              : footer.privacyPolicy.label,
            'privacy-policy-link',
          )}
          {renderPublicLink(
            footer.termsOfService.href,
            footer.termsOfService.label === defaultFooter.termsOfService.label
              ? t('publicSite.footer.terms')
              : footer.termsOfService.label,
            'terms-of-service-link',
          )}
        </div>
        {showOpenBconAttribution ? (
          <div className="landing-v2-footer-powered">
            <span>{t('publicSite.footer.poweredBy')}</span>
            <a
              className="openbcon-attribution-link"
              href={OPEN_BCON_REPO_URL}
              target="_blank"
              rel="noreferrer"
            >
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path
                  fill="currentColor"
                  d="M12 .5C5.65.5.5 5.66.5 12.03c0 5.09 3.29 9.4 7.86 10.92.58.11.79-.25.79-.56 0-.28-.01-1.2-.02-2.18-3.2.7-3.88-1.37-3.88-1.37-.52-1.34-1.28-1.69-1.28-1.69-1.05-.72.08-.7.08-.7 1.16.09 1.77 1.2 1.77 1.2 1.03 1.78 2.69 1.27 3.35.97.1-.75.4-1.27.73-1.56-2.55-.29-5.24-1.29-5.24-5.74 0-1.27.45-2.31 1.19-3.12-.12-.29-.51-1.46.11-3.04 0 0 .97-.31 3.17 1.19a10.9 10.9 0 0 1 5.78 0c2.2-1.5 3.17-1.19 3.17-1.19.62 1.58.23 2.75.11 3.04.74.81 1.19 1.85 1.19 3.12 0 4.46-2.7 5.45-5.28 5.73.41.36.78 1.08.78 2.18 0 1.57-.01 2.84-.01 3.23 0 .31.21.68.8.56a11.55 11.55 0 0 0 7.85-10.92C23.5 5.66 18.35.5 12 .5Z"
                />
              </svg>
              <span>GitHub</span>
            </a>
          </div>
        ) : (
          <div />
        )}
      </div>
    </footer>
  )
}
