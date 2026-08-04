import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto'
import { environment } from './config'

const encryptedValuePrefix = 'enc::v1'
export const secureConfigValuePlaceholder = '__stored_securely__'

const sensitivePlatformConfigPaths = [
  ['payments', 'testSecretKeyReference'],
  ['payments', 'liveSecretKeyReference'],
  ['payments', 'testPublishableKeyReference'],
  ['payments', 'livePublishableKeyReference'],
  ['payments', 'webhookSecretReference'],
] as const

type JsonRecord = Record<string, unknown>

function cloneJson<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}

function isJsonRecord(value: unknown): value is JsonRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isEnvironmentReference(value: string) {
  return /^[A-Z][A-Z0-9_]*$/u.test(value.trim())
}

function isEncryptedValue(value: string) {
  return value.startsWith(`${encryptedValuePrefix}:`)
}

function getDerivedEncryptionKey() {
  const source = environment.APP_STATE_ENCRYPTION_KEY?.trim() ?? ''
  if (!source) return null
  return createHash('sha256').update(source).digest()
}

function encryptValue(value: string) {
  const key = getDerivedEncryptionKey()
  if (!key) {
    throw new Error(
      'APP_STATE_ENCRYPTION_KEY must be configured before storing raw payment keys.',
    )
  }

  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', key, iv)
  const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()])
  const authTag = cipher.getAuthTag()

  return `${encryptedValuePrefix}:${iv.toString('base64url')}:${authTag.toString('base64url')}:${encrypted.toString('base64url')}`
}

export function decryptStoredConfigValue(value: string) {
  if (!isEncryptedValue(value)) return value

  const key = getDerivedEncryptionKey()
  if (!key) {
    throw new Error(
      'APP_STATE_ENCRYPTION_KEY must be configured before reading encrypted payment keys.',
    )
  }

  const [, ivPart, authTagPart, encryptedPart] = value.split(':')
  if (!ivPart || !authTagPart || !encryptedPart) {
    throw new Error('Encrypted payment key payload is malformed.')
  }

  const decipher = createDecipheriv(
    'aes-256-gcm',
    key,
    Buffer.from(ivPart, 'base64url'),
  )
  decipher.setAuthTag(Buffer.from(authTagPart, 'base64url'))

  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(encryptedPart, 'base64url')),
    decipher.final(),
  ])

  return decrypted.toString('utf8')
}

function getNestedString(
  value: unknown,
  path: readonly string[],
) {
  let cursor: unknown = value
  for (const segment of path) {
    if (!isJsonRecord(cursor)) return undefined
    cursor = cursor[segment]
  }
  return typeof cursor === 'string' ? cursor : undefined
}

function setNestedString(
  value: unknown,
  path: readonly string[],
  nextValue: string,
) {
  if (!isJsonRecord(value)) return

  let cursor: JsonRecord = value
  for (const segment of path.slice(0, -1)) {
    const nextCursor = cursor[segment]
    if (!isJsonRecord(nextCursor)) {
      cursor[segment] = {}
    }
    cursor = cursor[segment] as JsonRecord
  }

  cursor[path[path.length - 1] as string] = nextValue
}

function normalizeSensitiveValueForStorage(
  nextValue: string | undefined,
  existingValue: string | undefined,
) {
  const trimmed = nextValue?.trim() ?? ''

  if (!trimmed) return ''
  if (trimmed === secureConfigValuePlaceholder) return existingValue?.trim() ?? ''
  if (isEnvironmentReference(trimmed)) return trimmed
  if (isEncryptedValue(trimmed)) return trimmed

  return encryptValue(trimmed)
}

function normalizeSensitiveValueForClient(nextValue: string | undefined) {
  const trimmed = nextValue?.trim() ?? ''

  if (!trimmed) return ''
  if (isEnvironmentReference(trimmed)) return trimmed
  if (trimmed === secureConfigValuePlaceholder) return trimmed

  return secureConfigValuePlaceholder
}

function secureAIModelKeysForPersistence(
  nextConfig: JsonRecord,
  existingConfig: unknown,
) {
  const models = nextConfig.aiModels
  if (!Array.isArray(models)) return

  const existingModels = isJsonRecord(existingConfig) && Array.isArray(existingConfig.aiModels)
    ? existingConfig.aiModels
    : []

  nextConfig.aiModels = models.map((model, index) => {
    if (!isJsonRecord(model)) return model
    const existingModel = isJsonRecord(existingModels[index]) ? existingModels[index] : undefined
    return {
      ...model,
      apiKey: normalizeSensitiveValueForStorage(
        typeof model.apiKey === 'string' ? model.apiKey : undefined,
        typeof existingModel?.apiKey === 'string' ? existingModel.apiKey : undefined,
      ),
    }
  })
}

function redactAIModelKeysForClient(nextConfig: JsonRecord) {
  if (!Array.isArray(nextConfig.aiModels)) return

  nextConfig.aiModels = nextConfig.aiModels.map((model) => {
    if (!isJsonRecord(model)) return model
    return {
      ...model,
      apiKey: normalizeSensitiveValueForClient(
        typeof model.apiKey === 'string' ? model.apiKey : undefined,
      ),
    }
  })
}

export function securePlatformConfigForPersistence(
  nextValue: unknown,
  existingValue: unknown,
) {
  const nextConfig = cloneJson(nextValue)

  if (isJsonRecord(nextConfig)) {
    secureAIModelKeysForPersistence(nextConfig, existingValue)
  }

  for (const path of sensitivePlatformConfigPaths) {
    const current = getNestedString(nextConfig, path)
    const existing = getNestedString(existingValue, path)
    setNestedString(
      nextConfig,
      path,
      normalizeSensitiveValueForStorage(current, existing),
    )
  }

  return nextConfig
}

export function redactPlatformConfigForClient(value: unknown) {
  const nextConfig = cloneJson(value)

  if (isJsonRecord(nextConfig)) {
    redactAIModelKeysForClient(nextConfig)
  }

  for (const path of sensitivePlatformConfigPaths) {
    const current = getNestedString(nextConfig, path)
    setNestedString(nextConfig, path, normalizeSensitiveValueForClient(current))
  }

  return nextConfig
}

export function mergePlatformConfigSecretsForRuntime(
  overrideValue: unknown,
  storedValue: unknown,
) {
  if (!storedValue) return overrideValue

  const nextConfig = cloneJson(overrideValue)

  for (const path of sensitivePlatformConfigPaths) {
    const current = getNestedString(nextConfig, path)
    const stored = getNestedString(storedValue, path)

    if (
      current === undefined ||
      current.trim() === secureConfigValuePlaceholder
    ) {
      if (stored) setNestedString(nextConfig, path, stored)
    }
  }

  return nextConfig
}
