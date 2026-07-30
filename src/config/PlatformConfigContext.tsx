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
  removePersistentItem,
  setPersistentItem,
} from '../persistence/storage'

export function PlatformConfigProvider({ children }: { children: ReactNode }) {
  const [config, setConfig] = useState(loadPlatformConfig)

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
    }
  }, [config])

  useEffect(() => {
    let active = true

    void loadLocalPlatformSecureConfig(config).then((resolvedConfig) => {
      if (!active) return

      const currentSerialized = JSON.stringify(config)
      const resolvedSerialized = JSON.stringify(resolvedConfig)
      if (currentSerialized === resolvedSerialized) return

      setConfig(resolvedConfig)
    })

    return () => {
      active = false
    }
  }, [config])

  function updateConfig(nextConfig: PlatformConfig) {
    setConfig(nextConfig)
    void persistLocalPlatformSecureConfig(nextConfig)
    setPersistentItem(
      platformConfigStorageKey,
      JSON.stringify(sanitizePlatformConfigForPersistence(nextConfig)),
    )
  }

  function resetConfig() {
    setConfig(defaultPlatformConfig)
    void clearLocalPlatformSecureConfig()
    removePersistentItem(platformConfigStorageKey)
  }

  return (
    <PlatformConfigContext.Provider value={{ config, updateConfig, resetConfig }}>
      {children}
    </PlatformConfigContext.Provider>
  )
}
