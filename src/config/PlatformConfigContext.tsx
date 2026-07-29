import {
  useEffect,
  useState,
  type ReactNode,
} from 'react'
import {
  defaultPlatformConfig,
  loadPlatformConfig,
  platformConfigStorageKey,
  type PlatformConfig,
} from './platform'
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

  function updateConfig(nextConfig: PlatformConfig) {
    setConfig(nextConfig)
    setPersistentItem(platformConfigStorageKey, JSON.stringify(nextConfig))
  }

  function resetConfig() {
    setConfig(defaultPlatformConfig)
    removePersistentItem(platformConfigStorageKey)
  }

  return (
    <PlatformConfigContext.Provider value={{ config, updateConfig, resetConfig }}>
      {children}
    </PlatformConfigContext.Provider>
  )
}
