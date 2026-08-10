import { describe, expect, it, vi } from 'vitest'
import { checkForOpenBconUpdates } from './updateCheck'

describe('OpenBcon update checks', () => {
  it('marks a build as current when its commit is the latest commit', async () => {
    const latestCommit = 'a'.repeat(40)
    const fetcher = vi.fn(async (url: Parameters<typeof fetch>[0]) => {
      if (String(url).includes('/tags?')) {
        return new Response(JSON.stringify([{
          name: 'v2.5',
          commit: { sha: latestCommit },
        }]), { status: 200 })
      }
      return new Response(JSON.stringify({
        sha: latestCommit,
        html_url: 'https://github.com/adm73/OpenBcon/commit/latest',
        commit: {
          message: 'fix: improve update checks\n\nDetails',
          author: { date: '2026-08-04T12:00:00.000Z' },
        },
      }), { status: 200 })
    })

    const result = await checkForOpenBconUpdates(latestCommit.slice(0, 12), fetcher)

    expect(result).toMatchObject({
      currentCommit: latestCommit.slice(0, 12),
      currentTag: 'v2.5',
      latestShortCommit: latestCommit.slice(0, 12),
      latestTag: 'v2.5',
      latestMessage: 'fix: improve update checks',
      updateAvailable: false,
    })
    expect(fetcher).toHaveBeenCalledTimes(2)
  })

  it('reports an update when the build commit differs', async () => {
    const fetcher = vi.fn(async () => new Response(JSON.stringify({
      sha: 'b'.repeat(40),
      commit: { message: 'feat: update console' },
    }), { status: 200 }))

    const result = await checkForOpenBconUpdates('a'.repeat(12), fetcher)

    expect(result.updateAvailable).toBe(true)
    expect(result.latestUrl).toBe('https://github.com/adm73/OpenBcon/commits/main')
  })

  it('leaves update availability unknown for an unstamped build', async () => {
    const fetcher = vi.fn(async () => new Response(JSON.stringify({
      sha: 'c'.repeat(40),
    }), { status: 200 }))

    const result = await checkForOpenBconUpdates('unknown', fetcher)

    expect(result.currentCommit).toBe('unknown')
    expect(result.updateAvailable).toBeNull()
  })
})
