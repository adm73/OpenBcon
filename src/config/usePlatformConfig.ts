import { useContext } from 'react'
import { PlatformConfigContext } from './platform-config-context'

export function usePlatformConfig() {
  const context = useContext(PlatformConfigContext)

  if (!context) {
    throw new Error('usePlatformConfig must be used inside PlatformConfigProvider')
  }

  return context
}
