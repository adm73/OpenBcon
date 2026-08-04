const OPEN_BCON_COMMITS_URL =
  'https://api.github.com/repos/adm73/OpenBcon/commits/main'

const updateCheckTimeoutMs = 5000

export type UpdateCheckResult = {
  currentCommit: string
  latestCommit: string
  latestShortCommit: string
  latestMessage: string
  latestUrl: string
  latestCommittedAt: string
  updateAvailable: boolean | null
}

type GitHubCommitResponse = {
  sha?: unknown
  html_url?: unknown
  commit?: {
    message?: unknown
    author?: {
      date?: unknown
    }
  }
}

function normalizeCommit(value: string | undefined) {
  const normalized = value?.trim().toLowerCase() ?? ''
  return /^[0-9a-f]{7,40}$/u.test(normalized) ? normalized : ''
}

export async function checkForOpenBconUpdates(
  currentCommit: string | undefined,
  fetcher: typeof fetch = fetch,
): Promise<UpdateCheckResult> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), updateCheckTimeoutMs)

  try {
    const response = await fetcher(OPEN_BCON_COMMITS_URL, {
      headers: {
        Accept: 'application/vnd.github+json',
        'User-Agent': 'OpenBcon-update-check',
      },
      signal: controller.signal,
    })

    if (!response.ok) {
      throw new Error(`GitHub returned HTTP ${response.status}.`)
    }

    const payload = (await response.json()) as GitHubCommitResponse
    const latestCommit = typeof payload.sha === 'string' ? payload.sha.toLowerCase() : ''
    if (!/^[0-9a-f]{40}$/u.test(latestCommit)) {
      throw new Error('GitHub returned an invalid commit identifier.')
    }

    const latestMessage =
      typeof payload.commit?.message === 'string'
        ? payload.commit.message.split('\n', 1)[0].trim()
        : 'Latest OpenBcon commit'
    const latestUrl =
      typeof payload.html_url === 'string' ? payload.html_url : 'https://github.com/adm73/OpenBcon/commits/main'
    const latestCommittedAt =
      typeof payload.commit?.author?.date === 'string'
        ? payload.commit.author.date
        : ''
    const normalizedCurrentCommit = normalizeCommit(currentCommit)

    return {
      currentCommit: normalizedCurrentCommit || 'unknown',
      latestCommit,
      latestShortCommit: latestCommit.slice(0, 12),
      latestMessage,
      latestUrl,
      latestCommittedAt,
      updateAvailable: normalizedCurrentCommit
        ? !latestCommit.startsWith(normalizedCurrentCommit)
        : null,
    }
  } finally {
    clearTimeout(timeout)
  }
}
