import type { DocumentStore } from './documentStore'
import { environment } from './config'
import { decryptStoredConfigValue } from './secureState'

type JsonRecord = Record<string, unknown>

export type RuntimeGoogleOAuthConfig = {
  enabled: boolean
  clientId: string
  clientSecret: string
  redirectUri: string
}

export type RuntimeSMTPConfig = {
  enabled: boolean
  host: string
  port: number
  secure: boolean
  username: string
  password: string
  from: string
}

export type RuntimeAuthConfig = {
  googleOAuth: RuntimeGoogleOAuthConfig
  smtp: RuntimeSMTPConfig
}

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function getRecord(value: unknown, key: string) {
  const candidate = isRecord(value) ? value[key] : undefined
  return isRecord(candidate) ? candidate : null
}

function getString(value: unknown, key: string) {
  const candidate = isRecord(value) ? value[key] : undefined
  return typeof candidate === 'string' ? candidate.trim() : ''
}

function getBoolean(value: unknown, key: string, fallback: boolean) {
  const candidate = isRecord(value) ? value[key] : undefined
  return typeof candidate === 'boolean' ? candidate : fallback
}

function resolveSecret(value: string, fallback: string) {
  if (!value) return fallback
  try {
    return decryptStoredConfigValue(value)
  } catch {
    return value
  }
}

export async function getRuntimeAuthConfig(
  documentStore: DocumentStore,
): Promise<RuntimeAuthConfig> {
  let storedConfig: unknown = null
  try {
    storedConfig = await documentStore.findStateValue(
      'platform',
      'platform',
      'bconomics-platform-config-v1',
    )
  } catch {
    storedConfig = null
  }

  const storedAuth = getRecord(storedConfig, 'authentication')
  const storedGoogle = getRecord(storedAuth, 'googleOAuth')
  const storedSMTP = getRecord(storedAuth, 'smtp')
  const hasStoredGoogle = Boolean(
    storedGoogle &&
      (getBoolean(storedGoogle, 'enabled', false) ||
        getString(storedGoogle, 'clientId') ||
        getString(storedGoogle, 'clientSecret') ||
        getString(storedGoogle, 'redirectUri')),
  )
  const hasStoredSMTP = Boolean(
    storedSMTP &&
      (getBoolean(storedSMTP, 'enabled', false) ||
        getString(storedSMTP, 'host') ||
        getString(storedSMTP, 'username') ||
        getString(storedSMTP, 'password') ||
        getString(storedSMTP, 'from')),
  )

  return {
    googleOAuth: {
      enabled: hasStoredGoogle
        ? getBoolean(storedGoogle, 'enabled', false)
        : Boolean(
            environment.GOOGLE_OAUTH_CLIENT_ID &&
              environment.GOOGLE_OAUTH_CLIENT_SECRET,
          ),
      clientId: hasStoredGoogle
        ? getString(storedGoogle, 'clientId')
        : environment.GOOGLE_OAUTH_CLIENT_ID ?? '',
      clientSecret: hasStoredGoogle
        ? resolveSecret(
            getString(storedGoogle, 'clientSecret'),
            environment.GOOGLE_OAUTH_CLIENT_SECRET ?? '',
          )
        : environment.GOOGLE_OAUTH_CLIENT_SECRET ?? '',
      redirectUri: hasStoredGoogle
        ? getString(storedGoogle, 'redirectUri') ||
          `${environment.DASHBOARD_APP_URL}/api/auth/google/callback`
        : environment.GOOGLE_OAUTH_REDIRECT_URI ??
          `${environment.DASHBOARD_APP_URL}/api/auth/google/callback`,
    },
    smtp: {
      enabled: hasStoredSMTP
        ? getBoolean(storedSMTP, 'enabled', false)
        : environment.EMAIL_PROVIDER === 'smtp',
      host: hasStoredSMTP
        ? getString(storedSMTP, 'host')
        : environment.SMTP_HOST ?? '',
      port: hasStoredSMTP
        ? Number(getString(storedSMTP, 'port')) || 587
        : environment.SMTP_PORT,
      secure: hasStoredSMTP
        ? getBoolean(storedSMTP, 'secure', false)
        : environment.SMTP_SECURE,
      username: hasStoredSMTP
        ? getString(storedSMTP, 'username')
        : environment.SMTP_USER ?? '',
      password: hasStoredSMTP
        ? resolveSecret(
            getString(storedSMTP, 'password'),
            environment.SMTP_PASSWORD ?? '',
          )
        : environment.SMTP_PASSWORD ?? '',
      from: hasStoredSMTP
        ? getString(storedSMTP, 'from') || environment.EMAIL_FROM
        : environment.EMAIL_FROM,
    },
  }
}
