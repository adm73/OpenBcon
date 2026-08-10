const OPEN_BCON_COMMITS_URL =
  'https://api.github.com/repos/adm73/OpenBcon/commits/main'
const OPEN_BCON_TAGS_URL =
  'https://api.github.com/repos/adm73/OpenBcon/tags?per_page=100'

const updateCheckTimeoutMs = 5000

export type UpdateCheckResult = {
  currentCommit: string
  currentTag: string
  latestCommit: string
  latestShortCommit: string
  latestTag: string
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

type GitHubTagResponse = {
  name?: unknown
  commit?: {
    sha?: unknown
  }
}

function normalizeCommit(value: string | undefined) {
  const normalized = value?.trim().toLowerCase() ?? ''
  return /^[0-9a-f]{7,40}$/u.test(normalized) ? normalized : ''
}

function isReleaseTag(value: string) {
  return /^v?\d+\.\d+(?:\.\d+)?(?:[-+][0-9a-z.-]+)?$/iu.test(value)
}

function releaseTagParts(value: string) {
  const match = value.match(/^v?(\d+)\.(\d+)(?:\.(\d+))?/iu)
  return match ? [Number(match[1]), Number(match[2]), Number(match[3] ?? 0)] : [0, 0, 0]
}

function compareReleaseTags(left: string, right: string) {
  const leftParts = releaseTagParts(left)
  const rightParts = releaseTagParts(right)
  for (let index = 0; index < leftParts.length; index += 1) {
    if (leftParts[index] !== rightParts[index]) return leftParts[index] - rightParts[index]
  }
  return left.localeCompare(right)
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

    let releaseTags: GitHubTagResponse[] = []
    try {
      const tagsResponse = await fetcher(OPEN_BCON_TAGS_URL, {
        headers: {
          Accept: 'application/vnd.github+json',
          'User-Agent': 'OpenBcon-update-check',
        },
        signal: controller.signal,
      })
      if (tagsResponse.ok) {
        const tagsPayload = (await tagsResponse.json()) as unknown
        if (Array.isArray(tagsPayload)) {
          releaseTags = tagsPayload.filter(
            (tag): tag is GitHubTagResponse => Boolean(tag && typeof tag === 'object'),
          )
        }
      }
    } catch {
      // A tag lookup should not prevent the commit-based update check.
    }

    const versionTags = releaseTags
      .map((tag) => (typeof tag.name === 'string' ? tag.name.trim() : ''))
      .filter((tag) => isReleaseTag(tag))
    const latestTag = [...versionTags].sort(compareReleaseTags).at(-1) ?? ''
    const matchingTag = normalizedCurrentCommit
      ? releaseTags.find((tag) => {
          const tagCommit = typeof tag.commit?.sha === 'string' ? normalizeCommit(tag.commit.sha) : ''
          const tagName = typeof tag.name === 'string' ? tag.name.trim() : ''
          return tagCommit.startsWith(normalizedCurrentCommit) && isReleaseTag(tagName)
        })
      : undefined
    const currentTag = typeof matchingTag?.name === 'string' ? matchingTag.name.trim() : ''

    return {
      currentCommit: normalizedCurrentCommit || 'unknown',
      currentTag,
      latestCommit,
      latestShortCommit: latestCommit.slice(0, 12),
      latestTag,
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
