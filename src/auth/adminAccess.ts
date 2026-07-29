const adminAccessSessionKey = 'bconomics-admin-access-v1'
const adminAccessWindowMs = 30 * 60 * 1000

type AdminAccessGrant = {
  grantedAt: number
  source: 'workspace' | 'access-code'
}

function readStoredGrant(): AdminAccessGrant | null {
  if (typeof window === 'undefined') {
    return null
  }

  const rawValue = window.sessionStorage.getItem(adminAccessSessionKey)
  if (!rawValue) {
    return null
  }

  try {
    return JSON.parse(rawValue) as AdminAccessGrant
  } catch {
    window.sessionStorage.removeItem(adminAccessSessionKey)
    return null
  }
}

export function hasAdminAccess() {
  const grant = readStoredGrant()
  if (!grant) {
    return false
  }

  if (Date.now() - grant.grantedAt > adminAccessWindowMs) {
    revokeAdminAccess()
    return false
  }

  return true
}

export function grantAdminAccess(source: AdminAccessGrant['source'] = 'workspace') {
  if (typeof window === 'undefined') {
    return
  }

  const grant: AdminAccessGrant = {
    grantedAt: Date.now(),
    source,
  }

  window.sessionStorage.setItem(adminAccessSessionKey, JSON.stringify(grant))
}

export function revokeAdminAccess() {
  if (typeof window === 'undefined') {
    return
  }

  window.sessionStorage.removeItem(adminAccessSessionKey)
}

export function getAdminAccessCode() {
  return (import.meta.env.VITE_ADMIN_ACCESS_CODE as string | undefined)?.trim() ?? ''
}
