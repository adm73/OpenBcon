import {
  secureConfigValuePlaceholder,
  type AIModelConfig,
  type GoogleOAuthConfig,
  type PaymentConfig,
  type PlatformConfig,
  type SMTPConfig,
} from './platform'
const secureConfigDatabaseName = 'bconomics-local-secure-config'
const secureConfigStoreName = 'entries'
const secureSecretsPayloadKey = 'bconomics-platform-config-secrets-v1'
const secureSecretsEncryptionKeyKey = 'bconomics-platform-config-secrets-key-v1'

const securePaymentFields = [
  'testSecretKeyReference',
  'liveSecretKeyReference',
  'testPublishableKeyReference',
  'livePublishableKeyReference',
  'webhookSecretReference',
] as const

type SecurePaymentField = (typeof securePaymentFields)[number]
type StoredSecureSecrets = Partial<Pick<PaymentConfig, SecurePaymentField>> & {
  authentication?: {
    googleOAuth?: Pick<GoogleOAuthConfig, 'clientSecret'>
    smtp?: Pick<SMTPConfig, 'password'>
  }
  aiModelKeys?: Array<Pick<AIModelConfig, 'id' | 'apiKey'>>
}

type EncryptedPayload = {
  version: 1
  iv: string
  ciphertext: string
}

function isEnvironmentReference(value: string) {
  return /^[A-Z][A-Z0-9_]*$/u.test(value.trim())
}

function isAPIKeyTemplate(value: string) {
  return value.trim() === '{{apiKey}}'
}

function toBase64(bytes: Uint8Array) {
  let binary = ''
  for (const byte of bytes) {
    binary += String.fromCharCode(byte)
  }
  return window.btoa(binary)
}

function fromBase64(value: string) {
  const binary = window.atob(value)
  const bytes = new Uint8Array(binary.length)
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index)
  }
  return bytes
}

function openSecureConfigDatabase() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = window.indexedDB.open(secureConfigDatabaseName, 1)

    request.onupgradeneeded = () => {
      const database = request.result
      if (!database.objectStoreNames.contains(secureConfigStoreName)) {
        database.createObjectStore(secureConfigStoreName)
      }
    }

    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error ?? new Error('Failed to open IndexedDB.'))
  })
}

async function readDatabaseValue<T>(key: string) {
  const database = await openSecureConfigDatabase()

  return new Promise<T | undefined>((resolve, reject) => {
    const transaction = database.transaction(secureConfigStoreName, 'readonly')
    const store = transaction.objectStore(secureConfigStoreName)
    const request = store.get(key)

    request.onsuccess = () => resolve(request.result as T | undefined)
    request.onerror = () =>
      reject(request.error ?? new Error('Failed to read secure config entry.'))

    transaction.oncomplete = () => database.close()
    transaction.onerror = () => database.close()
    transaction.onabort = () => database.close()
  })
}

async function writeDatabaseValue(key: string, value: unknown) {
  const database = await openSecureConfigDatabase()

  return new Promise<void>((resolve, reject) => {
    const transaction = database.transaction(secureConfigStoreName, 'readwrite')
    const store = transaction.objectStore(secureConfigStoreName)
    store.put(value, key)

    transaction.oncomplete = () => {
      database.close()
      resolve()
    }
    transaction.onerror = () => {
      database.close()
      reject(transaction.error ?? new Error('Failed to write secure config entry.'))
    }
    transaction.onabort = () => {
      database.close()
      reject(transaction.error ?? new Error('Secure config write was aborted.'))
    }
  })
}

async function deleteDatabaseValue(key: string) {
  const database = await openSecureConfigDatabase()

  return new Promise<void>((resolve, reject) => {
    const transaction = database.transaction(secureConfigStoreName, 'readwrite')
    const store = transaction.objectStore(secureConfigStoreName)
    store.delete(key)

    transaction.oncomplete = () => {
      database.close()
      resolve()
    }
    transaction.onerror = () => {
      database.close()
      reject(transaction.error ?? new Error('Failed to delete secure config entry.'))
    }
    transaction.onabort = () => {
      database.close()
      reject(transaction.error ?? new Error('Secure config delete was aborted.'))
    }
  })
}

async function getOrCreateEncryptionKey() {
  const existing = await readDatabaseValue<number[]>(secureSecretsEncryptionKeyKey)
  const keyBytes = existing
    ? new Uint8Array(existing)
    : window.crypto.getRandomValues(new Uint8Array(32))

  if (!existing) {
    await writeDatabaseValue(
      secureSecretsEncryptionKeyKey,
      Array.from(keyBytes),
    )
  }

  return window.crypto.subtle.importKey(
    'raw',
    keyBytes,
    'AES-GCM',
    false,
    ['encrypt', 'decrypt'],
  )
}

function extractSecureSecrets(config: PlatformConfig): StoredSecureSecrets {
  const paymentSecrets = Object.fromEntries(
    securePaymentFields.flatMap((field) => {
      const value = config.payments[field].trim()

      if (
        !value ||
        value === secureConfigValuePlaceholder ||
        isAPIKeyTemplate(value) ||
        isEnvironmentReference(value)
      ) {
        return []
      }

      return [[field, value]]
    }),
  ) as StoredSecureSecrets

  const aiModelKeys = config.ai.models.flatMap((model) => {
    const value = model.apiKey.trim()
    if (
      !value ||
      value === secureConfigValuePlaceholder ||
      isAPIKeyTemplate(value) ||
      isEnvironmentReference(value)
    ) {
      return []
    }
    return [{ id: model.id, apiKey: value }]
  })

  const googleClientSecret = config.authentication.googleOAuth.clientSecret.trim()
  const smtpPassword = config.authentication.smtp.password.trim()
  const authentication = {
    ...(googleClientSecret &&
    googleClientSecret !== secureConfigValuePlaceholder &&
    !isAPIKeyTemplate(googleClientSecret) &&
    !isEnvironmentReference(googleClientSecret)
      ? { googleOAuth: { clientSecret: googleClientSecret } }
      : {}),
    ...(smtpPassword &&
    smtpPassword !== secureConfigValuePlaceholder &&
    !isAPIKeyTemplate(smtpPassword) &&
    !isEnvironmentReference(smtpPassword)
      ? { smtp: { password: smtpPassword } }
      : {}),
  }

  return {
    ...paymentSecrets,
    ...(Object.keys(authentication).length > 0 ? { authentication } : {}),
    ...(aiModelKeys.length > 0 ? { aiModelKeys } : {}),
  }
}

function mergeSecureSecrets(
  config: PlatformConfig,
  secrets: StoredSecureSecrets,
) {
  const nextPayments = { ...config.payments }

  for (const field of securePaymentFields) {
    const currentValue = nextPayments[field].trim()
    const secretValue = secrets[field]?.trim()

    if (!secretValue) continue
    if (currentValue && currentValue !== secureConfigValuePlaceholder) continue

    nextPayments[field] = secretValue
  }

  const nextModels = config.ai.models.map((model) => {
    const storedModel = secrets.aiModelKeys?.find((candidate) => candidate.id === model.id)
    const currentValue = model.apiKey.trim()
    if (
      !storedModel?.apiKey ||
      (currentValue &&
        currentValue !== secureConfigValuePlaceholder &&
        !isAPIKeyTemplate(currentValue))
    ) {
      return model
    }
    return { ...model, apiKey: storedModel.apiKey }
  })

  const nextAuthentication = { ...config.authentication }
  const storedGoogleClientSecret = secrets.authentication?.googleOAuth?.clientSecret
  const storedSMTPPassword = secrets.authentication?.smtp?.password
  if (
    storedGoogleClientSecret &&
    (!nextAuthentication.googleOAuth.clientSecret ||
      nextAuthentication.googleOAuth.clientSecret === secureConfigValuePlaceholder)
  ) {
    nextAuthentication.googleOAuth = {
      ...nextAuthentication.googleOAuth,
      clientSecret: storedGoogleClientSecret,
    }
  }
  if (
    storedSMTPPassword &&
    (!nextAuthentication.smtp.password ||
      nextAuthentication.smtp.password === secureConfigValuePlaceholder)
  ) {
    nextAuthentication.smtp = {
      ...nextAuthentication.smtp,
      password: storedSMTPPassword,
    }
  }

  return {
    ...config,
    authentication: nextAuthentication,
    payments: nextPayments,
    ai: { ...config.ai, models: nextModels },
  } satisfies PlatformConfig
}

async function encryptSecureSecrets(secrets: StoredSecureSecrets) {
  const key = await getOrCreateEncryptionKey()
  const iv = window.crypto.getRandomValues(new Uint8Array(12))
  const payload = new TextEncoder().encode(JSON.stringify(secrets))
  const ciphertext = await window.crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    payload,
  )

  const encryptedPayload: EncryptedPayload = {
    version: 1,
    iv: toBase64(iv),
    ciphertext: toBase64(new Uint8Array(ciphertext)),
  }

  window.localStorage.setItem(
    secureSecretsPayloadKey,
    JSON.stringify(encryptedPayload),
  )
}

async function decryptSecureSecrets(payload: EncryptedPayload) {
  const key = await getOrCreateEncryptionKey()
  const plaintext = await window.crypto.subtle.decrypt(
    {
      name: 'AES-GCM',
      iv: fromBase64(payload.iv),
    },
    key,
    fromBase64(payload.ciphertext),
  )

  return JSON.parse(
    new TextDecoder().decode(new Uint8Array(plaintext)),
  ) as StoredSecureSecrets
}

async function syncRemoteAIModelKeys(config: PlatformConfig) {
  const models = config.ai.models.flatMap((model) => {
    const apiKey = model.apiKey.trim()
    if (
      !apiKey ||
      apiKey === secureConfigValuePlaceholder ||
      isAPIKeyTemplate(apiKey) ||
      isEnvironmentReference(apiKey)
    ) {
      return []
    }
    return [{ id: model.id, apiKey }]
  })

  if (models.length === 0) return

  try {
    await fetch('/api/platform/ai-secrets', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify({ models }),
    })
  } catch {
    // Local secure storage remains the fallback when the API is unavailable.
  }
}

export async function persistLocalPlatformSecureConfig(config: PlatformConfig) {
  if (
    typeof window === 'undefined' ||
    !window.crypto?.subtle ||
    !window.indexedDB
  ) {
    return
  }

  const secrets = extractSecureSecrets(config)

  if (Object.keys(secrets).length === 0) {
    window.localStorage.removeItem(secureSecretsPayloadKey)
    return
  }

  await encryptSecureSecrets(secrets)
  await syncRemoteAIModelKeys(config)
}

export async function loadLocalPlatformSecureConfig(config: PlatformConfig) {
  if (
    typeof window === 'undefined' ||
    !window.crypto?.subtle ||
    !window.indexedDB
  ) {
    return config
  }

  const savedPayload = window.localStorage.getItem(secureSecretsPayloadKey)
  if (!savedPayload) return config

  try {
    const parsedPayload = JSON.parse(savedPayload) as EncryptedPayload
    const secrets = await decryptSecureSecrets(parsedPayload)
    return mergeSecureSecrets(config, secrets)
  } catch {
    return config
  }
}

export async function clearLocalPlatformSecureConfig() {
  if (typeof window === 'undefined') return

  window.localStorage.removeItem(secureSecretsPayloadKey)

  if (!window.indexedDB) return

  await deleteDatabaseValue(secureSecretsEncryptionKeyKey)
}
