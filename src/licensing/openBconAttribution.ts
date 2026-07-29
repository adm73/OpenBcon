import type { PlatformConfig } from '../config/platform'

export const OPEN_BCON_REPO_URL = 'https://github.com/adm73/OpenBcon'

export function hasCommercialLicenseAccess() {
  return String(import.meta.env.VITE_COMMERCIAL_LICENSED).toLowerCase() === 'true'
}

export function shouldShowOpenBconAttribution(config: PlatformConfig) {
  if (!hasCommercialLicenseAccess()) {
    return true
  }

  return config.openBconAttributionVisible
}
