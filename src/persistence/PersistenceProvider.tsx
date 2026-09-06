import { useEffect, useState, type ReactNode } from 'react'
import {
  hydratePersistentStorage,
  type PersistenceMode,
} from './storage'

export function PersistenceProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false)
  const [mode, setMode] = useState<PersistenceMode>('local')

  useEffect(() => {
    let active = true
    // The workspace must remain usable while the API or database is starting.
    // Hydration has its own request timeouts, but this guard also protects the
    // app from a stalled browser fetch or an unexpected provider failure.
    const fallbackTimer = window.setTimeout(() => {
      if (!active) return
      setMode('local')
      setReady(true)
    }, 5_000)

    hydratePersistentStorage()
      .then((nextMode) => {
        if (!active) return
        setMode(nextMode)
        setReady(true)
      })
      .catch(() => {
        if (!active) return
        setMode('local')
        setReady(true)
      })
      .finally(() => window.clearTimeout(fallbackTimer))
    return () => {
      active = false
      window.clearTimeout(fallbackTimer)
    }
  }, [])

  if (!ready) {
    return (
      <main className="persistence-loading">
        <span>B</span>
        <strong>Opening your workspace</strong>
        <small>Connecting to secure storage...</small>
      </main>
    )
  }

  return (
    <>
      {children}
      <span className="persistence-mode" data-mode={mode} aria-hidden="true" />
    </>
  )
}
