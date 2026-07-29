export type AuthRole = 'Workspace Admin' | 'Founder'

export type AuthUser = {
  id: string
  fullName: string
  email: string
  password: string
  companyName: string
  role: AuthRole
  createdAt: string
}

type AuthSession = {
  userId: string
  email: string
  signedInAt: string
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

const seededUsers: AuthUser[] = [
  {
    id: 'user-admin-1',
    fullName: 'Alex Morgan',
    email: 'admin@bconomics.ai',
    password: 'REDACTED',
    companyName: 'Bconomics',
    role: 'Workspace Admin',
    createdAt: '2026-07-01T09:00:00.000Z',
  },
]

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

export function loadAuthUsers() {
  const storedUsers = loadStoredJson<AuthUser[]>(authUsersStorageKey, [])
  if (storedUsers.length > 0) {
    return storedUsers
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

export function registerUser(input: {
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
    role: 'Founder',
    createdAt: new Date().toISOString(),
  }

  saveAuthUsers([...users, nextUser])
  persistSession(nextUser)
  return nextUser
}

export function loginUser(input: { email: string; password: string }) {
  const email = normalizeEmail(input.email)
  const user = loadAuthUsers().find((item) => normalizeEmail(item.email) === email)

  if (!user || user.password !== input.password) {
    throw new Error('The email or password is incorrect.')
  }

  persistSession(user)
  return user
}

export function clearAuthSession() {
  if (!canUseStorage()) {
    return
  }

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

export function requestPasswordReset(emailInput: string) {
  const email = normalizeEmail(emailInput)
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

export function resetPassword(input: { token: string; password: string }) {
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
