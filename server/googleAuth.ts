import { randomBytes } from 'node:crypto'
import type { Request, Response } from 'express'
import { environment } from './config'
import type { RuntimeGoogleOAuthConfig } from './runtimeAuthConfig'

export const googleStateCookieName = 'bconomics_google_state'
export const googleNextCookieName = 'bconomics_google_next'
export const googleModeCookieName = 'bconomics_google_mode'

export type GoogleProfile = {
  sub: string
  email: string
  email_verified: boolean
  name?: string
  picture?: string
}

function getEnvironmentGoogleConfig(): RuntimeGoogleOAuthConfig {
  return {
    enabled: Boolean(
      environment.GOOGLE_OAUTH_CLIENT_ID &&
        environment.GOOGLE_OAUTH_CLIENT_SECRET,
    ),
    clientId: environment.GOOGLE_OAUTH_CLIENT_ID ?? '',
    clientSecret: environment.GOOGLE_OAUTH_CLIENT_SECRET ?? '',
    redirectUri:
      environment.GOOGLE_OAUTH_REDIRECT_URI ??
      `${environment.PUBLIC_APP_URL}/api/auth/google/callback`,
  }
}

export function isGoogleOAuthConfigured(
  config: RuntimeGoogleOAuthConfig = getEnvironmentGoogleConfig(),
) {
  return Boolean(
    config.enabled && config.clientId && config.clientSecret && config.redirectUri,
  )
}

export function getGoogleRedirectUri(
  config: RuntimeGoogleOAuthConfig = getEnvironmentGoogleConfig(),
) {
  return config.redirectUri
}

export function createGoogleState() {
  return randomBytes(32).toString('base64url')
}

export function getGoogleAuthorizationUrl(
  state: string,
  config: RuntimeGoogleOAuthConfig = getEnvironmentGoogleConfig(),
) {
  if (!isGoogleOAuthConfigured(config)) {
    throw new Error('Google OAuth is not configured.')
  }
  const params = new URLSearchParams({
    client_id: config.clientId,
    redirect_uri: getGoogleRedirectUri(config),
    response_type: 'code',
    scope: 'openid email profile',
    state,
    prompt: 'select_account',
  })
  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`
}

export async function exchangeGoogleCode(
  code: string,
  config: RuntimeGoogleOAuthConfig = getEnvironmentGoogleConfig(),
) {
  if (!isGoogleOAuthConfigured(config)) {
    throw new Error('Google OAuth is not configured.')
  }

  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: config.clientId,
      client_secret: config.clientSecret,
      redirect_uri: getGoogleRedirectUri(config),
      grant_type: 'authorization_code',
    }),
  })
  if (!response.ok) {
    throw new Error('Google authorization could not be completed.')
  }
  const payload = (await response.json()) as { access_token?: string }
  if (!payload.access_token) {
    throw new Error('Google did not return an access token.')
  }

  const profileResponse = await fetch('https://openidconnect.googleapis.com/v1/userinfo', {
    headers: { authorization: `Bearer ${payload.access_token}` },
  })
  if (!profileResponse.ok) {
    throw new Error('Google profile could not be loaded.')
  }
  const profile = (await profileResponse.json()) as GoogleProfile
  if (!profile.sub || !profile.email || profile.email_verified !== true) {
    throw new Error('Google did not return a verified email address.')
  }
  return profile
}

function cookie(name: string, value: string, maxAgeSeconds: number) {
  const attributes = [
    `${name}=${encodeURIComponent(value)}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    `Max-Age=${maxAgeSeconds}`,
  ]
  if (environment.NODE_ENV === 'production') attributes.push('Secure')
  return attributes.join('; ')
}

export function setGoogleFlowCookies(
  response: Response,
  state: string,
  next: string,
  mode: 'test' | 'live',
) {
  response.setHeader('Set-Cookie', [
    cookie(googleStateCookieName, state, 10 * 60),
    cookie(googleNextCookieName, next, 10 * 60),
    cookie(googleModeCookieName, mode, 10 * 60),
  ])
}

export function clearGoogleFlowCookies(response: Response) {
  response.append('Set-Cookie', cookie(googleStateCookieName, '', 0))
  response.append('Set-Cookie', cookie(googleNextCookieName, '', 0))
  response.append('Set-Cookie', cookie(googleModeCookieName, '', 0))
}

export function readCookie(request: Request, name: string) {
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
