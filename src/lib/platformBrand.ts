import type { PlatformConfig } from '../config/platform'

export function getPlatformDisplayName(config: PlatformConfig) {
  return config.platformName.trim() || 'OpenBcon'
}

export function getPlatformInitial(config: PlatformConfig) {
  return getPlatformDisplayName(config).charAt(0).toUpperCase() || 'O'
}
