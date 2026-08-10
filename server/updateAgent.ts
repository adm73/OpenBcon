import { environment } from './config'

export type UpdateAgentStatus = {
  status: 'idle' | 'running' | 'succeeded' | 'failed'
  phase: string
  message: string
  currentCommit: string
  targetCommit: string
  startedAt: string | null
  finishedAt: string | null
}

const updateAgentTimeoutMs = 5000

function updateAgentBaseUrl() {
  return environment.OPENBCON_UPDATE_AGENT_URL?.trim().replace(/\/$/u, '') ?? ''
}

export function isOpenBconUpdateAgentConfigured() {
  return Boolean(updateAgentBaseUrl() && environment.OPENBCON_UPDATE_TOKEN)
}

async function callUpdateAgent(
  path: string,
  init: RequestInit = {},
  fetcher: typeof fetch = fetch,
) {
  const baseUrl = updateAgentBaseUrl()
  if (!baseUrl || !environment.OPENBCON_UPDATE_TOKEN) {
    throw new Error(
      'Automatic updates are not configured for this deployment. Run the deployment script once to enable the update service.',
    )
  }

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), updateAgentTimeoutMs)
  try {
    const response = await fetcher(`${baseUrl}${path}`, {
      ...init,
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        'X-OpenBcon-Update-Token': environment.OPENBCON_UPDATE_TOKEN,
        ...(init.headers ?? {}),
      },
      signal: controller.signal,
    })
    const payload = (await response.json().catch(() => ({}))) as {
      message?: unknown
    } & Partial<UpdateAgentStatus>
    if (!response.ok) {
      throw new Error(
        typeof payload.message === 'string'
          ? payload.message
          : `The update service returned HTTP ${response.status}.`,
      )
    }
    return payload
  } finally {
    clearTimeout(timeout)
  }
}

export function requestOpenBconUpdate(
  targetCommit: string | undefined,
  fetcher: typeof fetch = fetch,
) {
  return callUpdateAgent(
    '/update',
    {
      method: 'POST',
      body: JSON.stringify({ targetCommit: targetCommit ?? '' }),
    },
    fetcher,
  )
}

export function readOpenBconUpdateStatus(fetcher: typeof fetch = fetch) {
  return callUpdateAgent('/status', {}, fetcher) as Promise<UpdateAgentStatus>
}
