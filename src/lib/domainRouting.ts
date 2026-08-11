const configuredOrigin = (value: string | undefined) => {
  if (!value) return ''
  try {
    return new URL(value).origin
  } catch {
    return ''
  }
}

const publicOrigin = configuredOrigin(import.meta.env.VITE_PUBLIC_SITE_URL)
const dashboardOrigin = configuredOrigin(import.meta.env.VITE_DASHBOARD_APP_URL)

const workspacePaths = new Set([
  '/login',
  '/signup',
  '/forgot-password',
  '/reset-password',
  '/admin',
  '/dashboard',
  '/discovery',
  '/quick-build',
  '/strategic-reports',
  '/my-companies',
  '/funding-shortlist',
  '/my-applications',
  '/grants-loans',
  '/templates',
  '/social-resources',
  '/tools',
  '/settings',
])

export function isWorkspacePath(pathname: string) {
  return workspacePaths.has(pathname)
}

export function isDashboardHost() {
  if (typeof window === 'undefined') return false
  if (dashboardOrigin && dashboardOrigin !== window.location.origin) {
    return window.location.origin === dashboardOrigin
  }
  return window.location.hostname.startsWith('dashboard.')
}

function absoluteHref(origin: string, path: string) {
  if (!origin || (typeof window !== 'undefined' && origin === window.location.origin)) {
    return path
  }
  try {
    return new URL(path, `${origin}/`).toString()
  } catch {
    return path
  }
}

export function publicSiteHref(path = '/') {
  return absoluteHref(publicOrigin, path)
}

export function dashboardHref(path = '/dashboard') {
  return absoluteHref(dashboardOrigin, path)
}
