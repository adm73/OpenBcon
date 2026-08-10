import i18n from 'i18next'
import {
  I18nextProvider,
  initReactI18next,
  useTranslation,
} from 'react-i18next'
import { useLocation } from 'react-router-dom'
import { useEffect, useState, type ReactNode } from 'react'
import enCA from './locales/en-CA'
import frCA from './locales/fr-CA'
import zhCN from './locales/zh-CN'

export const supportedLocales = ['en-CA', 'fr-CA', 'zh-CN'] as const
export type SupportedLocale = (typeof supportedLocales)[number]

export const languageOptions: Array<{ value: SupportedLocale; label: string }> = [
  { value: 'en-CA', label: 'English' },
  { value: 'fr-CA', label: 'Français' },
  { value: 'zh-CN', label: '简体中文' },
]

export const languageStorageKey = 'bconomics-locale-v1'
export const workspaceLanguageStorageKey = languageStorageKey
export const publicLanguageStorageKey = 'bconomics-public-locale-v1'

const languageAliases: Record<string, SupportedLocale> = {
  en: 'en-CA',
  english: 'en-CA',
  'en-ca': 'en-CA',
  fr: 'fr-CA',
  french: 'fr-CA',
  français: 'fr-CA',
  'fr-ca': 'fr-CA',
  zh: 'zh-CN',
  chinese: 'zh-CN',
  '简体中文': 'zh-CN',
  'zh-cn': 'zh-CN',
}

export function normalizeLocale(value: unknown): SupportedLocale {
  const normalized = String(value ?? '').trim().toLowerCase()
  return languageAliases[normalized] ?? 'en-CA'
}

function isPublicPath(pathname: string): boolean {
  return pathname === '/' || pathname === '/programs'
}

function getStorageKey(pathname: string): string {
  return isPublicPath(pathname)
    ? publicLanguageStorageKey
    : workspaceLanguageStorageKey
}

function loadInitialLocale(): SupportedLocale {
  if (typeof window === 'undefined') return 'en-CA'

  const storedLocale = window.localStorage.getItem(getStorageKey(window.location.pathname))
  if (storedLocale) return normalizeLocale(storedLocale)

  if (isPublicPath(window.location.pathname)) return 'en-CA'

  try {
    const platformConfig = JSON.parse(
      window.localStorage.getItem('bconomics-platform-config-v1') ?? '{}',
    ) as { language?: string }
    if (platformConfig.language) return normalizeLocale(platformConfig.language)

    const settings = JSON.parse(
      window.localStorage.getItem('bconomics-user-settings-v1') ?? '{}',
    ) as { language?: string }
    if (settings.language) return normalizeLocale(settings.language)
  } catch {
    // Ignore malformed legacy settings and use the browser locale.
  }

  return 'en-CA'
}

void i18n.use(initReactI18next).init({
  resources: {
    'en-CA': { translation: enCA },
    'fr-CA': { translation: frCA },
    'zh-CN': { translation: zhCN },
  },
  lng: loadInitialLocale(),
  fallbackLng: 'en-CA',
  interpolation: { escapeValue: false },
})

export function LanguageProvider({ children }: { children: ReactNode }) {
  const location = useLocation()
  const [locale, setLocaleState] = useState<SupportedLocale>(loadInitialLocale)
  const storageKey = getStorageKey(location.pathname)

  useEffect(() => {
    const handleLanguageChanged = (nextLanguage: string) => {
      setLocaleState(normalizeLocale(nextLanguage))
    }

    i18n.on('languageChanged', handleLanguageChanged)
    return () => {
      i18n.off('languageChanged', handleLanguageChanged)
    }
  }, [])

  useEffect(() => {
    const storedLocale = window.localStorage.getItem(storageKey)
    if (storedLocale && normalizeLocale(storedLocale) !== locale) {
      void i18n.changeLanguage(normalizeLocale(storedLocale))
      return
    }

    document.documentElement.lang = locale
    window.localStorage.setItem(storageKey, locale)
  }, [locale, storageKey])

  return (
    <I18nextProvider i18n={i18n}>
      {children}
    </I18nextProvider>
  )
}

export function useLocale() {
  const location = useLocation()
  const storageKey = getStorageKey(location.pathname)
  const [locale, setLocaleState] = useState<SupportedLocale>(
    () => normalizeLocale(i18n.language),
  )

  useEffect(() => {
    const handleLanguageChanged = (nextLanguage: string) => {
      setLocaleState(normalizeLocale(nextLanguage))
    }
    i18n.on('languageChanged', handleLanguageChanged)
    return () => {
      i18n.off('languageChanged', handleLanguageChanged)
    }
  }, [])

  return {
    locale,
    setLocale: (nextLocale: SupportedLocale) => {
      window.localStorage.setItem(storageKey, nextLocale)
      void i18n.changeLanguage(nextLocale)
    },
  }
}

export { useTranslation }
