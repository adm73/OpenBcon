import { createHash, randomBytes } from 'node:crypto'
import type { Request, Response } from 'express'
import type { Pool } from 'pg'
import { environment } from './config'
import type { RequestContext } from './stateRepository'

export const authSessionCookieName = 'bconomics_session'

type QueryClient = Pick<Pool, 'query'>

export function hashToken(token: string) {
  return createHash('sha256').update(token).digest('hex')
}

function readCookie(request: Request, name: string) {
  const header = request.headers.cookie
  if (!header) return null

  for (const part of header.split(';')) {
    const [key, ...valueParts] = part.trim().split('=')
    if (key !== name) continue
    try {
      return decodeURIComponent(valueParts.join('='))
    } catch {
      return null
    }
  }

  return null
}

function cookieValue(token: string, maxAgeSeconds: number) {
  const attributes = [
    `${authSessionCookieName}=${encodeURIComponent(token)}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    `Max-Age=${maxAgeSeconds}`,
  ]
  if (environment.NODE_ENV === 'production') attributes.push('Secure')
  return attributes.join('; ')
}

export function setSessionCookie(response: Response, token: string) {
  response.append(
    'Set-Cookie',
    cookieValue(token, environment.AUTH_SESSION_TTL_DAYS * 24 * 60 * 60),
  )
}

export function clearSessionCookie(response: Response) {
  response.append('Set-Cookie', cookieValue('', 0))
}

export async function createSession(
  database: QueryClient,
  userId: string,
  workspaceId: string,
) {
  const token = randomBytes(32).toString('base64url')
  await database.query(
    `
      INSERT INTO auth_sessions (user_id, workspace_id, token_hash, expires_at)
      VALUES ($1, $2, $3, now() + ($4 * interval '1 day'))
    `,
    [userId, workspaceId, hashToken(token), environment.AUTH_SESSION_TTL_DAYS],
  )
  return token
}

export async function revokeSession(
  database: QueryClient,
  request: Request,
) {
  const token = readCookie(request, authSessionCookieName)
  if (!token) return

  await database.query(
    'DELETE FROM auth_sessions WHERE token_hash = $1',
    [hashToken(token)],
  )
}

export async function resolveRequestContext(
  database: QueryClient,
  request: Request,
): Promise<RequestContext | null> {
  const token = readCookie(request, authSessionCookieName)
  if (!token) {
    if (environment.NODE_ENV !== 'production') {
      return {
        userId: environment.DEMO_USER_ID,
        workspaceId: environment.DEMO_WORKSPACE_ID,
        role: 'admin',
      }
    }
    return null
  }

  const result = await database.query<{
    user_id: string
    workspace_id: string
    user_role: string
    member_role: string
  }>(
    `
      SELECT
        sessions.user_id,
        sessions.workspace_id,
        users.role AS user_role,
        members.role AS member_role
      FROM auth_sessions AS sessions
      JOIN app_users AS users
        ON users.id = sessions.user_id
      JOIN workspace_members AS members
        ON members.workspace_id = sessions.workspace_id
       AND members.user_id = sessions.user_id
      WHERE sessions.token_hash = $1
        AND sessions.expires_at > now()
        AND users.status = 'active'
        AND EXISTS (
          SELECT 1
          FROM workspaces
          WHERE workspaces.id = sessions.workspace_id
            AND workspaces.status = 'active'
        )
      LIMIT 1
    `,
    [hashToken(token)],
  )

  const session = result.rows[0]
  if (!session) return null

  await database.query(
    'UPDATE auth_sessions SET last_seen_at = now() WHERE token_hash = $1',
    [hashToken(token)],
  )

  return {
    userId: String(session.user_id),
    workspaceId: String(session.workspace_id),
    role: session.user_role === 'admin' ? 'admin' : session.member_role,
  }
}

export async function requireRequestContext(
  database: QueryClient,
  request: Request,
  response: Response,
) {
  const context = await resolveRequestContext(database, request)
  if (!context) {
    response.status(401).json({
      error: 'unauthorized',
      message: 'A valid authenticated session is required.',
    })
    return null
  }
  return context
}
