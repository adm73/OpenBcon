export type AuthRole = 'admin' | 'default'

export type AuthUser = {
  id: string
  fullName: string
  email: string
  password: string
  companyName: string
  role: AuthRole
  createdAt: string
  emailVerified?: boolean
}

type AuthSession = {
  userId: string
  email: string
  signedInAt: string
}

type DatabaseLoginResponse = {
  user: Omit<AuthUser, 'password'>
}

type DatabaseCurrentUserResponse = DatabaseLoginResponse & {
  context?: {
    userId: string
    workspaceId: string
    role: string
  }
}

export type RegistrationPending = {
  verificationRequired: true
  email: string
  previewVerificationUrl?: string
}

type PasswordResetRecord = {
  email: string
  expiresAt: number
}

const authUsersStorageKey = 'bconomics-auth-users-v1'
const authSessionStorageKey = 'bconomics-session'
const authUserStorageKey = 'bconomics-auth-user'
const passwordResetStorageKey = 'bconomics-password-resets-v1'
const defaultResetLifetimeMs = 30 * 60 * 1000
export const authUserUpdatedEvent = 'bconomics-auth-user-updated'
const authApiBaseUrl = import.meta.env.VITE_API_URL ?? '/api'
const allowLocalAuthFallback =
  import.meta.env.DEV || import.meta.env.VITE_ALLOW_LOCAL_AUTH_FALLBACK === 'true'
export const localAuthFallbackEnabled = allowLocalAuthFallback

const seededUsers: AuthUser[] = []

function canUseStorage() {
  return typeof window !== 'undefined'
}

function loadStoredJson<T>(key: string, fallback: T): T {
  if (!canUseStorage()) {
    return fallback
  }

  const rawValue = window.localStorage.getItem(key)
  if (!rawValue) {
    return fallback
  }

  try {
    return JSON.parse(rawValue) as T
  } catch {
    window.localStorage.removeItem(key)
    return fallback
  }
}

function writeStoredJson(key: string, value: unknown) {
  if (!canUseStorage()) {
    return
  }

  window.localStorage.setItem(key, JSON.stringify(value))
}

function normalizeEmail(email: string) {
  return email.trim().toLowerCase()
}

function normalizeAuthRole(role: unknown): AuthRole {
  return role === 'admin' || role === 'Admin' || role === 'owner' || role === 'Owner'
    ? 'admin'
    : 'default'
}

export function loadAuthUsers() {
  const storedUsers = loadStoredJson<AuthUser[]>(authUsersStorageKey, [])
  if (storedUsers.length > 0) {
    const normalizedUsers = storedUsers.map((user) => ({
      ...user,
      role: normalizeAuthRole(user.role),
    }))
    if (normalizedUsers.some((user, index) => user.role !== storedUsers[index]?.role)) {
      saveAuthUsers(normalizedUsers)
    }
    return normalizedUsers
  }

  writeStoredJson(authUsersStorageKey, seededUsers)
  return seededUsers
}

function saveAuthUsers(users: AuthUser[]) {
  writeStoredJson(authUsersStorageKey, users)
}

export function hasActiveSession() {
  return getCurrentSession() !== null
}

export function getCurrentSession(): AuthSession | null {
  if (!canUseStorage()) {
    return null
  }

  return loadStoredJson<AuthSession | null>(authSessionStorageKey, null)
}

export function getCurrentAuthUser() {
  const session = getCurrentSession()
  if (!session) {
    return null
  }

  return loadAuthUsers().find((user) => user.id === session.userId) ?? null
}

export function isCurrentUserAdmin() {
  return getCurrentAuthUser()?.role === 'admin'
}

export async function refreshCurrentAuthUser() {
  try {
    const response = await fetch(`${authApiBaseUrl}/auth/me`, {
      credentials: 'include',
      signal: AbortSignal.timeout(3_000),
    })
    if (!response.ok) return null

    const payload = (await response.json()) as DatabaseCurrentUserResponse
    const user: AuthUser = {
      ...payload.user,
      role: normalizeAuthRole(payload.user.role),
      password: '',
    }
    const users = loadAuthUsers().filter((item) => item.id !== user.id)
    saveAuthUsers([...users, user])
    persistSession(user)
    window.dispatchEvent(new Event(authUserUpdatedEvent))
    return user
  } catch {
    return null
  }
}

export function updateCurrentAuthUserProfile(input: {
  fullName: string
  email: string
  role: string
}) {
  const session = getCurrentSession()
  if (!session || !canUseStorage()) {
    return null
  }

  const users = loadAuthUsers()
  const currentUser = users.find((user) => user.id === session.userId)
  if (!currentUser) {
    return null
  }

  const normalizedEmail = normalizeEmail(input.email)
  const nextUser: AuthUser = {
    ...currentUser,
    fullName: input.fullName.trim() || currentUser.fullName,
    email: normalizedEmail || currentUser.email,
    role: normalizeAuthRole(input.role.trim() || currentUser.role),
  }

  saveAuthUsers(
    users.map((user) => (user.id === currentUser.id ? nextUser : user)),
  )

  writeStoredJson(authSessionStorageKey, {
    ...session,
    email: nextUser.email,
  } satisfies AuthSession)
  writeStoredJson(authUserStorageKey, {
    id: nextUser.id,
    fullName: nextUser.fullName,
    email: nextUser.email,
    companyName: nextUser.companyName,
    role: nextUser.role,
  })
  window.dispatchEvent(new Event(authUserUpdatedEvent))
  return nextUser
}

function persistSession(user: AuthUser) {
  if (!canUseStorage()) {
    return
  }

  const session: AuthSession = {
    userId: user.id,
    email: user.email,
    signedInAt: new Date().toISOString(),
  }

  writeStoredJson(authSessionStorageKey, session)
  writeStoredJson(authUserStorageKey, {
    id: user.id,
    fullName: user.fullName,
    email: user.email,
    companyName: user.companyName,
    role: user.role,
  })
}

function registerUserLocally(input: {
  fullName: string
  email: string
  password: string
  companyName: string
}) {
  const users = loadAuthUsers()
  const email = normalizeEmail(input.email)

  if (users.some((user) => normalizeEmail(user.email) === email)) {
    throw new Error('An account with this email already exists.')
  }

  const nextUser: AuthUser = {
    id: `user-${Date.now()}`,
    fullName: input.fullName.trim(),
    email,
    password: input.password,
    companyName: input.companyName.trim(),
    role: 'default',
    createdAt: new Date().toISOString(),
  }

  saveAuthUsers([...users, nextUser])
  persistSession(nextUser)
  return nextUser
}

export async function registerUser(input: {
  fullName: string
  email: string
  password: string
  companyName: string
}): Promise<AuthUser | RegistrationPending> {
  try {
    const response = await fetch(`${authApiBaseUrl}/auth/register`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify(input),
    })

    if (response.ok) {
      const payload = (await response.json()) as DatabaseLoginResponse | RegistrationPending
      if ('verificationRequired' in payload && payload.verificationRequired) {
        return payload
      }
      if (!('user' in payload)) {
        throw new Error('The registration response was invalid.')
      }
      const user: AuthUser = {
        ...payload.user,
        password: '',
      }
      const users = loadAuthUsers().filter((item) => item.id !== user.id)
      saveAuthUsers([...users, user])
      persistSession(user)
      return user
    }

    const payload = (await response.json().catch(() => null)) as
      | { message?: string }
      | null
    if (!allowLocalAuthFallback || response.status !== 404) {
      throw new Error(payload?.message ?? 'Unable to create the account.')
    }
  } catch (error) {
    if (!allowLocalAuthFallback || !(error instanceof TypeError)) {
      throw error
    }
  }

  return registerUserLocally(input)
}

export async function resendVerificationEmail(email: string) {
  const response = await fetch(`${authApiBaseUrl}/auth/resend-verification`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
    },
    credentials: 'include',
    body: JSON.stringify({ email }),
  })
  const payload = (await response.json().catch(() => null)) as
    | { previewVerificationUrl?: string; message?: string }
    | null
  if (!response.ok) {
    throw new Error(payload?.message ?? 'Unable to send the verification email.')
  }
  return payload ?? {}
}

export function startGoogleSignIn(nextPath = '/dashboard') {
  if (!canUseStorage()) return
  const safePath = nextPath.startsWith('/') && !nextPath.startsWith('//') && !nextPath.includes('\\')
    ? nextPath
    : '/dashboard'
  window.location.assign(`${authApiBaseUrl}/auth/google/start?next=${encodeURIComponent(safePath)}`)
}

function loginUserLocally(input: { email: string; password: string }) {
  const email = normalizeEmail(input.email)
  const user = loadAuthUsers().find((item) => normalizeEmail(item.email) === email)

  if (!user || user.password !== input.password) {
    throw new Error('The email or password is incorrect.')
  }

  persistSession(user)
  return user
}

export async function loginUser(input: { email: string; password: string }) {
  try {
    const response = await fetch(`${authApiBaseUrl}/auth/login`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify(input),
    })

    if (response.ok) {
      const payload = (await response.json()) as DatabaseLoginResponse
      const user: AuthUser = {
        ...payload.user,
        password: '',
      }
      const users = loadAuthUsers().filter((item) => item.id !== user.id)
      saveAuthUsers([...users, user])
      persistSession(user)
      return user
    }

    if (!allowLocalAuthFallback || response.status !== 404) {
      const payload = (await response.json().catch(() => null)) as
        | { message?: string }
        | null
      throw new Error(payload?.message ?? 'The email or password is incorrect.')
    }
  } catch (error) {
    if (!allowLocalAuthFallback || !(error instanceof TypeError)) {
      throw error
    }
  }

  return loginUserLocally(input)
}

export function clearAuthSession() {
  if (!canUseStorage()) {
    return
  }

  void fetch(`${authApiBaseUrl}/auth/logout`, {
    method: 'POST',
    credentials: 'include',
  }).catch(() => undefined)

  window.localStorage.removeItem(authSessionStorageKey)
  window.localStorage.removeItem(authUserStorageKey)
  window.localStorage.removeItem('bconomics-auth')
  window.localStorage.removeItem('bconomics-access-token')
  window.localStorage.removeItem('bconomics-refresh-token')
}

function loadPasswordResets() {
  return loadStoredJson<Record<string, PasswordResetRecord>>(passwordResetStorageKey, {})
}

function savePasswordResets(value: Record<string, PasswordResetRecord>) {
  writeStoredJson(passwordResetStorageKey, value)
}

export async function requestPasswordReset(emailInput: string): Promise<{
  email: string
  token: string | null
  previewResetUrl?: string
}> {
  const email = normalizeEmail(emailInput)
  try {
    const response = await fetch(`${authApiBaseUrl}/auth/request-password-reset`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify({ email }),
    })

    if (response.ok) {
      const payload = (await response.json().catch(() => null)) as
        | { previewResetUrl?: string }
        | null
      return {
        email,
        token: null,
        ...(payload?.previewResetUrl ? { previewResetUrl: payload.previewResetUrl } : {}),
      }
    }

    if (!allowLocalAuthFallback || response.status !== 404) {
      const payload = (await response.json().catch(() => null)) as
        | { message?: string }
        | null
      throw new Error(payload?.message ?? 'Unable to request a password reset.')
    }
  } catch (error) {
    if (!allowLocalAuthFallback || !(error instanceof TypeError)) {
      throw error
    }
  }

  const user = loadAuthUsers().find((item) => normalizeEmail(item.email) === email)
  const token = `reset-${Math.random().toString(36).slice(2, 10)}`

  if (!user) {
    return {
      email,
      token: null,
    }
  }

  const resets = loadPasswordResets()
  resets[token] = {
    email,
    expiresAt: Date.now() + defaultResetLifetimeMs,
  }
  savePasswordResets(resets)

  return {
    email,
    token,
  }
}

export function validatePasswordResetToken(token: string) {
  const resets = loadPasswordResets()
  const record = resets[token]
  if (!record) {
    return null
  }

  if (record.expiresAt < Date.now()) {
    delete resets[token]
    savePasswordResets(resets)
    return null
  }

  return record
}

export async function resetPassword(input: { token: string; password: string }) {
  try {
    const response = await fetch(`${authApiBaseUrl}/auth/reset-password`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify(input),
    })

    if (response.ok) {
      return null
    }

    if (!allowLocalAuthFallback || response.status !== 404) {
      const payload = (await response.json().catch(() => null)) as
        | { message?: string }
        | null
      throw new Error(payload?.message ?? 'Unable to reset the password.')
    }
  } catch (error) {
    if (!allowLocalAuthFallback || !(error instanceof TypeError)) {
      throw error
    }
  }

  const record = validatePasswordResetToken(input.token)
  if (!record) {
    throw new Error('This reset link is invalid or has expired.')
  }

  const users = loadAuthUsers()
  const nextUsers = users.map((user) =>
    normalizeEmail(user.email) === record.email
      ? { ...user, password: input.password }
      : user,
  )
  saveAuthUsers(nextUsers)

  const resets = loadPasswordResets()
  delete resets[input.token]
  savePasswordResets(resets)

  return nextUsers.find((user) => normalizeEmail(user.email) === record.email) ?? null
}

export function getUserInitials(fullName: string) {
  return fullName
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join('')
}
