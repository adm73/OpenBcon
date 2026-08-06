import { createContext } from 'react'
import type { PlatformConfig } from './platform'

export type PlatformConfigContextValue = {
  config: PlatformConfig
  secureConfigReady: boolean
  updateConfig: (nextConfig: PlatformConfig) => void
  resetConfig: () => void
}

export const PlatformConfigContext =
  createContext<PlatformConfigContextValue | null>(null)
