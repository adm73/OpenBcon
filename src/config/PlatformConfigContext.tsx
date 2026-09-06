import {
  useEffect,
  useState,
  type ReactNode,
} from 'react'
import {
  defaultPlatformConfig,
  loadPlatformConfig,
  platformConfigStorageKey,
  sanitizePlatformConfigForPersistence,
  type PlatformConfig,
} from './platform'
import {
  clearLocalPlatformSecureConfig,
  loadLocalPlatformSecureConfig,
  persistLocalPlatformSecureConfig,
} from './localSecureConfig'
import { PlatformConfigContext } from './platform-config-context'
import {
  canadianFundingDataSourceId,
  canadianFundingDataSourceName,
} from '../data/fundingSources'
import {
  removePersistentItem,
  setPersistentItem,
} from '../persistence/storage'

export function PlatformConfigProvider({ children }: { children: ReactNode }) {
  const [config, setConfig] = useState(loadPlatformConfig)
  const [secureConfigReady, setSecureConfigReady] = useState(false)

  useEffect(() => {
    document.documentElement.style.setProperty('--platform-primary', config.primaryColor)
    document.documentElement.style.setProperty('--platform-sidebar', config.sidebarColor)
  }, [config.primaryColor, config.sidebarColor])

  useEffect(() => {
    const existingValue = window.localStorage.getItem(platformConfigStorageKey)
    if (!existingValue) return

    const sanitizedValue = JSON.stringify(
      sanitizePlatformConfigForPersistence(config),
    )

    if (existingValue !== sanitizedValue) {
      window.localStorage.setItem(platformConfigStorageKey, sanitizedValue)

      try {
        const previousConfig = JSON.parse(existingValue) as {
          dataSources?: Array<{ id?: string; name?: string }>
          advisoryHub?: {
            schemaVersion?: number
            documentTypes?: Array<{ id?: string }>
            sections?: Array<{ documentTypeId?: string }>
          }
        }
        const renamedCanadianSource = previousConfig.dataSources?.some(
          (source) =>
            source.id === canadianFundingDataSourceId &&
            source.name !== canadianFundingDataSourceName,
        )
        const hadInterviewGuide = previousConfig.advisoryHub?.documentTypes?.some(
          (documentType) => documentType.id?.trim() === 'interview-guide',
        )
        const hasInterviewGuide = config.advisoryHub.documentTypes.some(
          (documentType) => documentType.id === 'interview-guide',
        )
        const hadInterviewGuideSections = previousConfig.advisoryHub?.sections?.some(
          (section) => section.documentTypeId?.trim() === 'interview-guide',
        )
        const hasInterviewGuideSections = config.advisoryHub.sections.some(
          (section) => section.documentTypeId === 'interview-guide',
        )
        const advisoryHubSchemaMigrated =
          Number(previousConfig.advisoryHub?.schemaVersion ?? 1) <
          config.advisoryHub.schemaVersion

        if (
          renamedCanadianSource ||
          advisoryHubSchemaMigrated ||
          (!hadInterviewGuide && hasInterviewGuide) ||
          (!hadInterviewGuideSections && hasInterviewGuideSections)
        ) {
          setPersistentItem(platformConfigStorageKey, sanitizedValue)
        }
      } catch {
        // Keep the normalized local config even if an older cache is malformed.
      }
    }
  }, [config])

  useEffect(() => {
    let active = true

    void loadLocalPlatformSecureConfig(config)
      .then((resolvedConfig) => {
        if (!active) return

        const currentSerialized = JSON.stringify(config)
        const resolvedSerialized = JSON.stringify(resolvedConfig)
        setSecureConfigReady(true)
        void persistLocalPlatformSecureConfig(resolvedConfig)
        if (currentSerialized === resolvedSerialized) return

        setConfig(resolvedConfig)
      })
      .catch(() => {
        if (active) setSecureConfigReady(true)
      })

    return () => {
      active = false
    }
  }, [config])

  function updateConfig(nextConfig: PlatformConfig) {
    setConfig(nextConfig)
    setSecureConfigReady(true)
    void persistLocalPlatformSecureConfig(nextConfig)
    setPersistentItem(
      platformConfigStorageKey,
      JSON.stringify(sanitizePlatformConfigForPersistence(nextConfig)),
    )
  }

  function updateConfigLocally(nextConfig: PlatformConfig) {
    setConfig(nextConfig)
    setSecureConfigReady(true)
    void persistLocalPlatformSecureConfig(nextConfig)
    window.localStorage.setItem(
      platformConfigStorageKey,
      JSON.stringify(sanitizePlatformConfigForPersistence(nextConfig)),
    )
  }

  function resetConfig() {
    setConfig(defaultPlatformConfig)
    setSecureConfigReady(true)
    void clearLocalPlatformSecureConfig()
    removePersistentItem(platformConfigStorageKey)
  }

  return (
    <PlatformConfigContext.Provider
      value={{
        config,
        secureConfigReady,
        updateConfig,
        updateConfigLocally,
        resetConfig,
      }}
    >
      {children}
    </PlatformConfigContext.Provider>
  )
}
